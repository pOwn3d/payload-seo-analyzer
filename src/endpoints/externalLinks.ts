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
import { isUrlBlocked } from '../helpers/ssrfGuard.js'
import { seoCache } from '../cache.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'
import { safeCacheLocale } from '../helpers/safeCacheLocale.js'

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
// (implementation lives in helpers/ssrfGuard.ts — shared + unit-tested)
// ---------------------------------------------------------------------------

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
  // SSRF protection on the initial URL.
  if (await isUrlBlocked(url)) {
    return { status: 0, ok: false, error: 'blocked-private-ip', checkedAt: Date.now() }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  const MAX_REDIRECTS = 5

  try {
    let currentUrl = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        signal: controller.signal,
        // Manual redirects: re-validate every hop, so a public URL can't 3xx us
        // onto an internal/metadata address (169.254.169.254, localhost, …).
        redirect: 'manual',
        headers: {
          'User-Agent': 'SeoAnalyzer-LinkChecker/1.0',
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location || hop === MAX_REDIRECTS) {
          return { status: response.status, ok: false, error: 'too-many-redirects', checkedAt: Date.now() }
        }
        let nextUrl: string
        try {
          nextUrl = new URL(location, currentUrl).toString()
        } catch {
          return { status: response.status, ok: false, error: 'connection', checkedAt: Date.now() }
        }
        if (await isUrlBlocked(nextUrl)) {
          return { status: 0, ok: false, error: 'blocked-private-ip', checkedAt: Date.now() }
        }
        currentUrl = nextUrl
        continue
      }

      return {
        status: response.status,
        ok: response.ok,
        checkedAt: Date.now(),
      }
    }

    // Redirect budget exhausted without a terminal response.
    return { status: 0, ok: false, error: 'too-many-redirects', checkedAt: Date.now() }
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
      if (!isSeoPanelUser(req)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      // Cache-busting forces the full site-wide recomputation this endpoint caches,
      // so it is reserved to SEO admins — the same gate as /audit?nocache=1. A panel
      // user without the role silently gets the cached result instead of a 403.
      const noCache = url.searchParams.get('nocache') === '1' && isSeoAdminRequest(req)
      // Locale-scoped: content differs per locale, so cache must not collide across locales.
      const reqLocale = safeCacheLocale(req)
      const CACHE_KEY = reqLocale ? `external-links:${reqLocale}` : 'external-links'
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
