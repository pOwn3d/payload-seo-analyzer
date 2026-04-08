/**
 * External Links Check endpoint handler.
 * Scans all pages/posts for external links, then verifies each URL
 * with a HEAD request to detect broken external links.
 * Uses an in-memory cache with 1-hour TTL.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { promises as dns } from 'dns'
import { seoCache } from '../cache.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'
import { parseJsonBody } from '../helpers/parseBody.js'

// ---------------------------------------------------------------------------
// In-memory cache with 1-hour TTL
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CachedResult {
  status: number
  ok: boolean
  error?: string
  checkedAt: number
}

const linkCache = new Map<string, CachedResult>()

// Maximum unique URLs to check per scan
const MAX_URLS = 100

// ---------------------------------------------------------------------------
// Recursive Lexical node traversal to extract external URLs
// ---------------------------------------------------------------------------

function extractExternalLinks(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []

  const n = node as Record<string, unknown>
  const links: string[] = []

  // Standard Lexical link node
  if (n.type === 'link' && n.fields && typeof n.fields === 'object') {
    const fields = n.fields as Record<string, unknown>
    if (typeof fields.url === 'string') {
      const url = fields.url
      if (url.startsWith('http://') || url.startsWith('https://')) {
        links.push(url)
      }
    }
  }

  // Lexical autolink node
  if (n.type === 'autolink' && n.fields && typeof n.fields === 'object') {
    const fields = n.fields as Record<string, unknown>
    if (typeof fields.url === 'string') {
      const url = fields.url
      if (url.startsWith('http://') || url.startsWith('https://')) {
        links.push(url)
      }
    }
  }

  // Recurse into children
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      links.push(...extractExternalLinks(child))
    }
  }

  // Recurse into root (Lexical root node)
  if (n.root && typeof n.root === 'object') {
    links.push(...extractExternalLinks(n.root))
  }

  return links
}

// ---------------------------------------------------------------------------
// Extract all external links from a Payload document
// ---------------------------------------------------------------------------

function extractDocExternalLinks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  siteUrl?: string,
): string[] {
  const allLinks: string[] = []

  // Hero richText
  if (doc.hero?.richText) {
    allLinks.push(...extractExternalLinks(doc.hero.richText))
  }

  // Layout blocks
  const blocks = Array.isArray(doc.layout) ? doc.layout : []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue

    // Direct richText on block
    if (block.richText) {
      allLinks.push(...extractExternalLinks(block.richText))
    }

    // Columns with richText
    if (Array.isArray(block.columns)) {
      for (const col of block.columns) {
        if (col?.richText) {
          allLinks.push(...extractExternalLinks(col.richText))
        }
      }
    }
  }

  // Post content (Lexical richText)
  if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
    allLinks.push(...extractExternalLinks(doc.content))
  }

  // Filter out the site's own domain if provided
  if (siteUrl) {
    try {
      const siteHost = new URL(siteUrl).host
      return allLinks.filter((url) => {
        try {
          return new URL(url).host !== siteHost
        } catch {
          return true
        }
      })
    } catch {
      // Invalid siteUrl — return all
    }
  }

  return allLinks
}

// ---------------------------------------------------------------------------
// SSRF protection: block requests to private/internal IP ranges
// ---------------------------------------------------------------------------

/** Check if a resolved IP address is in a private/reserved range */
function isPrivateIP(ip: string): boolean {
  // Localhost variants
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true

  // Private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    if (a === 10) return true                              // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true       // 172.16.0.0/12
    if (a === 192 && b === 168) return true                 // 192.168.0.0/16
    if (a === 169 && b === 254) return true                 // 169.254.0.0/16 (link-local)
    if (a === 0) return true                                // 0.0.0.0/8
    if (a === 127) return true                              // 127.0.0.0/8
  }

  // IPv6 private ranges (simplified)
  const ipv6 = ip.toLowerCase()
  if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true  // Unique local
  if (ipv6.startsWith('fe80')) return true                          // Link-local
  if (ipv6 === '::1' || ipv6 === '::') return true                // Loopback / unspecified

  return false
}

/** Hostname-level checks (localhost aliases, raw IP literals) */
function isPrivateUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname

    // Block localhost variants
    if (hostname === 'localhost') return true

    // Check raw IP in hostname (strip brackets for IPv6)
    const rawIp = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
    return isPrivateIP(rawIp)
  } catch {
    // If URL parsing fails, block the request as a precaution
    return true
  }
}

/** Resolve hostname via DNS and check if the resolved IP is private (DNS rebinding protection) */
async function resolveAndCheckPrivate(hostname: string): Promise<boolean> {
  try {
    const { address } = await dns.lookup(hostname)
    return isPrivateIP(address)
  } catch {
    // DNS resolution failed — treat as private (block)
    return true
  }
}

// ---------------------------------------------------------------------------
// Concurrency pool — runs async tasks with a max concurrency limit
// ---------------------------------------------------------------------------

async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  const executing = new Set<Promise<void>>()

  for (let i = 0; i < items.length; i++) {
    const p = fn(items[i]).then((result) => {
      results[i] = result
    })
    const wrapped = p.then(() => { executing.delete(wrapped) })
    executing.add(wrapped)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

// ---------------------------------------------------------------------------
// Check a single URL via HEAD request with 5s AbortController timeout
// ---------------------------------------------------------------------------

async function checkUrl(url: string): Promise<CachedResult> {
  // SSRF protection: never make requests to private/internal networks
  if (isPrivateUrl(url)) {
    return {
      status: 0,
      ok: false,
      error: 'blocked-private-ip',
      checkedAt: Date.now(),
    }
  }

  // DNS rebinding protection: resolve hostname and verify the IP is not private
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.startsWith('[')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname
    if (await resolveAndCheckPrivate(hostname)) {
      return {
        status: 0,
        ok: false,
        error: 'blocked-private-ip',
        checkedAt: Date.now(),
      }
    }
  } catch {
    return {
      status: 0,
      ok: false,
      error: 'blocked-private-ip',
      checkedAt: Date.now(),
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'SeoAnalyzer-LinkChecker/1.0',
      },
    })
    return {
      status: response.status,
      ok: response.ok,
      checkedAt: Date.now(),
    }
  } catch (err: unknown) {
    let errorType = 'connection'
    if (err instanceof Error) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        errorType = 'timeout'
      } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        errorType = 'dns'
      } else if (err.message.includes('ECONNREFUSED')) {
        errorType = 'connection'
      } else if (err.message.includes('certificate') || err.message.includes('SSL')) {
        errorType = 'ssl'
      }
    }
    return {
      status: 0,
      ok: false,
      error: errorType,
      checkedAt: Date.now(),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

export function createExternalLinksHandler(collections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'
      const CACHE_KEY = 'external-links'
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true })
      }

      // Parse optional forceRefresh from request body
      let forceRefresh = false
      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        if (body.forceRefresh) {
          forceRefresh = true
        }
      }

      // Detect site URL for filtering own-domain links
      const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

      // 1. Collect all external links across all documents
      const urlSources = new Map<string, Array<{ title: string; slug: string; collection: string }>>()

      const allFetched = await fetchAllDocs(req.payload, {
        collections,
        globals,
        depth: 0,
      })

      for (const { doc, sourceType, sourceSlug } of allFetched) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any
        const collectionLabel = sourceType === 'global' ? `global:${sourceSlug}` : sourceSlug
        const links = extractDocExternalLinks(d, siteUrl)

        for (const link of links) {
          if (!urlSources.has(link)) {
            urlSources.set(link, [])
          }
          const sources = urlSources.get(link)!
          // Avoid duplicate source pages for the same URL
          const already = sources.some(
            (s) => s.slug === (d.slug || '') && s.collection === collectionLabel,
          )
          if (!already) {
            sources.push({
              title: d.title || sourceSlug,
              slug: d.slug || '',
              collection: collectionLabel,
            })
          }
        }
      }

      // 2. Limit to MAX_URLS unique URLs
      const uniqueUrls = Array.from(urlSources.keys()).slice(0, MAX_URLS)

      // 3. Check each URL (use cache when possible) with concurrency pool of 10
      const now = Date.now()
      const CONCURRENCY = 10

      const results = await asyncPool(CONCURRENCY, uniqueUrls, async (url: string) => {
        // Check cache
        const cached = linkCache.get(url)
        if (!forceRefresh && cached && now - cached.checkedAt < CACHE_TTL_MS) {
          return {
            url,
            status: cached.status,
            ok: cached.ok,
            ...(cached.error && { error: cached.error }),
            sourcePages: urlSources.get(url) || [],
          }
        }

        // Perform check
        const result = await checkUrl(url)
        linkCache.set(url, result)

        // Evict oldest entries if cache exceeds max size
        if (linkCache.size > 1000) {
          const firstKey = linkCache.keys().next().value
          if (firstKey !== undefined) {
            linkCache.delete(firstKey)
          }
        }

        return {
          url,
          status: result.status,
          ok: result.ok,
          ...(result.error && { error: result.error }),
          sourcePages: urlSources.get(url) || [],
        }
      })

      // 4. Compute stats
      const stats = {
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        broken: results.filter((r) => !r.ok && !r.error).length,
        timeout: results.filter((r) => r.error === 'timeout').length,
      }

      // Sort broken/errored first
      results.sort((a, b) => {
        if (a.ok === b.ok) return 0
        return a.ok ? 1 : -1
      })

      const responseData = { results, stats }
      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] external-links error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
