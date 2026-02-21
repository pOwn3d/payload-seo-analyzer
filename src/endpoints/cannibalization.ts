/**
 * Cannibalization detection endpoint.
 * Detects keyword cannibalization across all SEO-enabled collections.
 * Groups pages by shared focusKeyword/focusKeywords and flags conflicts.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'

interface PageEntry {
  id: number | string
  title: string
  slug: string
  collection: string
  score: number
}

interface Conflict {
  keyword: string
  pages: PageEntry[]
}

export function createCannibalizationHandler(collections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'
      const CACHE_KEY = 'cannibalization'
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true })
      }

      // Map: normalized keyword -> list of pages using it
      const keywordMap = new Map<string, PageEntry[]>()

      for (const collectionSlug of collections) {
        try {
          const result = await req.payload.find({
            collection: collectionSlug,
            limit: 500,
            depth: 0,
            overrideAccess: true,
          })

          for (const doc of result.docs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = doc as any
            const pageEntry: PageEntry = {
              id: d.id,
              title: d.title || '(sans titre)',
              slug: d.slug || '',
              collection: collectionSlug,
              score: 0,
            }

            // Collect all keywords for this document
            const keywords: string[] = []

            if (d.focusKeyword && typeof d.focusKeyword === 'string' && d.focusKeyword.trim()) {
              keywords.push(d.focusKeyword.trim().toLowerCase())
            }

            if (Array.isArray(d.focusKeywords)) {
              for (const kw of d.focusKeywords) {
                const keyword =
                  typeof kw === 'string' ? kw : kw?.keyword
                if (keyword && typeof keyword === 'string' && keyword.trim()) {
                  const normalized = keyword.trim().toLowerCase()
                  if (!keywords.includes(normalized)) {
                    keywords.push(normalized)
                  }
                }
              }
            }

            // Add this page to each keyword's entry list
            for (const kw of keywords) {
              if (!keywordMap.has(kw)) {
                keywordMap.set(kw, [])
              }
              keywordMap.get(kw)!.push(pageEntry)
            }
          }
        } catch {
          // Collection might not exist — skip silently
        }
      }

      // Include globals
        for (const globalSlug of globals) {
          try {
            const doc = await req.payload.findGlobal({ slug: globalSlug, depth: 0, overrideAccess: true }) as Record<string, unknown>
            const entry: PageEntry = {
              id: globalSlug,
              title: (doc.title as string) || globalSlug,
              slug: '',
              collection: `global:${globalSlug}`,
              score: 0,
            }
            const kw = typeof doc.focusKeyword === 'string' ? doc.focusKeyword.trim().toLowerCase() : ''
            if (kw) {
              if (!keywordMap.has(kw)) keywordMap.set(kw, [])
              keywordMap.get(kw)!.push(entry)
            }
          } catch { /* skip */ }
        }

      // Try to fetch scores from seo-score-history for enrichment
      const scoreMap = new Map<string, number>()
      try {
        const historyResults = await req.payload.find({
          collection: 'seo-score-history',
          limit: 1000,
          sort: '-snapshotDate',
          depth: 0,
          overrideAccess: true,
        })

        // Keep the most recent score per document
        const seen = new Set<string>()
        for (const h of historyResults.docs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entry = h as any
          const key = `${entry.collection}::${entry.documentId}`
          if (!seen.has(key)) {
            seen.add(key)
            scoreMap.set(key, entry.score || 0)
          }
        }
      } catch {
        // seo-score-history might not exist
      }

      // Filter: only keywords used by 2+ pages are conflicts
      const conflicts: Conflict[] = []
      let totalAffectedPages = 0
      const affectedPageIds = new Set<string>()

      for (const [keyword, pages] of keywordMap.entries()) {
        if (pages.length < 2) continue

        // Enrich pages with scores
        const enrichedPages = pages.map((p) => ({
          ...p,
          score: scoreMap.get(`${p.collection}::${p.id}`) || 0,
        }))

        conflicts.push({ keyword, pages: enrichedPages })

        for (const p of enrichedPages) {
          const pageKey = `${p.collection}::${p.id}`
          if (!affectedPageIds.has(pageKey)) {
            affectedPageIds.add(pageKey)
            totalAffectedPages++
          }
        }
      }

      // Sort conflicts by severity (most pages first, then alphabetically)
      conflicts.sort((a, b) => {
        const diff = b.pages.length - a.pages.length
        if (diff !== 0) return diff
        return a.keyword.localeCompare(b.keyword)
      })

      const responseData = {
        conflicts,
        stats: {
          totalConflicts: conflicts.length,
          totalAffectedPages,
        },
      }
      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false })
    } catch (error) {
      console.error('[seo-plugin/cannibalization] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
