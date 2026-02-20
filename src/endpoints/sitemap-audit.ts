/**
 * Sitemap Audit endpoint handler.
 * Performs a full internal link graph analysis to detect orphan pages,
 * weak pages, link hubs, and broken internal links.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'
import { extractAllInternalLinks, normalizeToSlug } from '../helpers/linkExtractor.js'

// ---------------------------------------------------------------------------
// Slug suggestion for broken links (C1)
// Compares slug segments to find the best match among existing slugs.
// ---------------------------------------------------------------------------

function findSuggestedSlug(brokenSlug: string, allSlugs: Set<string>): string | null {
  const brokenParts = brokenSlug.split('-')
  let bestMatch: string | null = null
  let bestRatio = 0

  for (const candidate of allSlugs) {
    if (candidate === brokenSlug) continue
    const candidateParts = candidate.split('-')
    let common = 0
    for (const part of brokenParts) {
      if (candidateParts.includes(part)) common++
    }
    const ratio = common / Math.max(brokenParts.length, candidateParts.length)
    if (ratio >= 0.3 && ratio > bestRatio) {
      bestRatio = ratio
      bestMatch = candidate
    }
  }

  return bestMatch
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

export function createSitemapAuditHandler(
  collections: string[],
  redirectsCollection = 'seo-redirects',
  knownRoutes: string[] = [],
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'

      const CACHE_KEY = 'sitemap-audit'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
      }

      // 0. Load existing redirects to filter out already-redirected broken links
      const existingRedirectSources = new Set<string>()
      try {
        const redirectsResult = await req.payload.find({
          collection: redirectsCollection,
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const r of redirectsResult.docs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rd = r as any
          if (typeof rd.from === 'string') {
            // Normalize: remove leading slash for comparison
            const normalized = rd.from.replace(/^\/+/, '').toLowerCase()
            existingRedirectSources.add(normalized)
          }
        }
      } catch {
        // Redirects collection might not exist yet — proceed without filtering
      }

      // 1. Fetch all documents from target collections
      const allDocs: Array<{
        id: number | string
        title: string
        slug: string
        collection: string
      }> = []

      // Map of slug -> document info for quick lookup
      const slugMap = new Map<string, {
        id: number | string
        title: string
        slug: string
        collection: string
      }>()

      // Map of slug -> outgoing internal links (with anchor text)
      const outgoingMap = new Map<string, Array<{ url: string; slug: string; text: string }>>()

      // Map of slug -> incoming link sources with anchor text
      const incomingMap = new Map<string, Array<{ slug: string; anchorText: string }>>()

      for (const collectionSlug of collections) {
        try {
          const result = await req.payload.find({
            collection: collectionSlug,
            limit: 500,
            depth: 1,
            overrideAccess: true,
          })

          for (const doc of result.docs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = doc as any
            const slug = (d.slug as string) || ''
            const title = (d.title as string) || ''

            const docInfo = {
              id: d.id,
              title,
              slug,
              collection: collectionSlug,
            }
            allDocs.push(docInfo)
            slugMap.set(slug, docInfo)

            // Extract all internal links from this document
            const internalLinks = extractAllInternalLinks(d)
            outgoingMap.set(slug, internalLinks)
          }
        } catch {
          // Collection might not exist — skip silently
        }
      }

      // 2. Build the incoming links map (with anchor text)
      for (const [sourceSlug, links] of outgoingMap.entries()) {
        for (const link of links) {
          const targetSlug = link.slug
          if (!incomingMap.has(targetSlug)) {
            incomingMap.set(targetSlug, [])
          }
          incomingMap.get(targetSlug)!.push({ slug: sourceSlug, anchorText: link.text || '' })
        }
      }

      // 3. Analyze the link graph

      // Orphan pages: 0 incoming links (excluding homepage)
      const orphanPages: Array<{
        id: number | string
        title: string
        slug: string
        collection: string
      }> = []

      // Weak pages: exactly 1 incoming link
      const weakPages: Array<{
        id: number | string
        title: string
        slug: string
        collection: string
        incomingCount: number
        incomingFrom: Array<{ slug: string; anchorText: string }>
      }> = []

      // Link hubs: >10 outgoing links
      const linkHubs: Array<{
        id: number | string
        title: string
        slug: string
        collection: string
        outgoingCount: number
      }> = []

      // Broken links: outgoing link slug not found in any document
      const brokenLinks: Array<{
        sourceId: number | string
        sourceTitle: string
        sourceSlug: string
        targetUrl: string
        targetSlug: string
        collection: string
        suggestedSlug: string | null
      }> = []

      // Slugs that should never be marked as orphan or broken
      // (homepage variants + known dynamic routes like /blog, /posts, etc.)
      const homeSlugs = new Set(['home', '', 'accueil', ...knownRoutes])

      const allSlugs = new Set(allDocs.map((d) => d.slug))

      for (const doc of allDocs) {
        const incomingLinks = incomingMap.get(doc.slug) || []
        // Deduplicate by source slug, keeping first anchor text
        const seenSources = new Set<string>()
        const uniqueIncoming: Array<{ slug: string; anchorText: string }> = []
        for (const inc of incomingLinks) {
          if (!seenSources.has(inc.slug)) {
            seenSources.add(inc.slug)
            uniqueIncoming.push(inc)
          }
        }
        const outgoingLinks = outgoingMap.get(doc.slug) || []

        // Deduplicate outgoing by target slug
        const uniqueOutgoingSlugs = [...new Set(outgoingLinks.map((l) => l.slug))]

        // Orphan detection (skip homepage)
        if (!homeSlugs.has(doc.slug) && uniqueIncoming.length === 0) {
          orphanPages.push({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            collection: doc.collection,
          })
        }

        // Weak page detection (skip homepage)
        if (!homeSlugs.has(doc.slug) && uniqueIncoming.length === 1) {
          weakPages.push({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            collection: doc.collection,
            incomingCount: 1,
            incomingFrom: uniqueIncoming,
          })
        }

        // Link hub detection
        if (uniqueOutgoingSlugs.length > 10) {
          linkHubs.push({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            collection: doc.collection,
            outgoingCount: uniqueOutgoingSlugs.length,
          })
        }

        // Broken link detection (with slug suggestion + redirect filtering)
        for (const link of outgoingLinks) {
          if (!allSlugs.has(link.slug) && !homeSlugs.has(link.slug)) {
            const isHomepage = link.slug === 'home' && allSlugs.has('')
            // Skip if a redirect already exists for this target slug
            const alreadyRedirected = existingRedirectSources.has(link.slug.toLowerCase())
            if (!isHomepage && !alreadyRedirected) {
              brokenLinks.push({
                sourceId: doc.id,
                sourceTitle: doc.title,
                sourceSlug: doc.slug,
                targetUrl: link.url,
                targetSlug: link.slug,
                collection: doc.collection,
                suggestedSlug: findSuggestedSlug(link.slug, allSlugs),
              })
            }
          }
        }
      }

      // Sort results for better UX
      orphanPages.sort((a, b) => a.title.localeCompare(b.title))
      weakPages.sort((a, b) => a.title.localeCompare(b.title))
      linkHubs.sort((a, b) => b.outgoingCount - a.outgoingCount)

      // Deduplicate broken links by sourceSlug + targetSlug
      const seenBroken = new Set<string>()
      const uniqueBrokenLinks = brokenLinks.filter((bl) => {
        const key = `${bl.sourceSlug}::${bl.targetSlug}`
        if (seenBroken.has(key)) return false
        seenBroken.add(key)
        return true
      })

      // 4. Compute stats
      let totalLinks = 0
      for (const links of outgoingMap.values()) {
        totalLinks += links.length
      }

      const totalPages = allDocs.length

      const responseData = {
        orphanPages,
        weakPages,
        linkHubs,
        brokenLinks: uniqueBrokenLinks,
        stats: {
          totalPages,
          totalLinks,
          avgLinksPerPage: totalPages > 0 ? Math.round((totalLinks / totalPages) * 10) / 10 : 0,
          orphanCount: orphanPages.length,
          weakCount: weakPages.length,
          hubCount: linkHubs.length,
          brokenCount: uniqueBrokenLinks.length,
        },
      }

      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('[seo-plugin/sitemap-audit] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
