/**
 * SEO Check Keyword endpoint handler.
 * Checks if a focus keyword is already used by another page or post.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler, Where } from 'payload'

export function createCheckKeywordHandler(collections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const keyword = url.searchParams.get('keyword')?.trim().toLowerCase()
      const excludeId = url.searchParams.get('excludeId')

      if (!keyword) {
        return Response.json({ error: 'Missing keyword parameter' }, { status: 400 })
      }

      const results: Array<{ title: string; slug: string; collection: string }> = []

      for (const collectionSlug of collections) {
        try {
          // Query directly with focusKeyword filter (uses SQL index, no doc limit)
          const whereClause: Where = {
            focusKeyword: { equals: keyword },
            ...(excludeId ? { id: { not_equals: excludeId } } : {}),
          }

          const primaryResult = await req.payload.find({
            collection: collectionSlug,
            limit: 50,
            depth: 0,
            overrideAccess: true,
            where: whereClause,
          })

          for (const doc of primaryResult.docs) {
            const d = doc as Record<string, unknown>
            results.push({
              title: (d.title as string) || (d.slug as string) || 'Sans titre',
              slug: (d.slug as string) || '',
              collection: collectionSlug,
            })
          }

          // Also check secondary keywords (focusKeywords array field)
          // This requires fetching docs that have this keyword in their array
          const secondaryWhere: Where = {
            'focusKeywords.keyword': { equals: keyword },
            ...(excludeId ? { id: { not_equals: excludeId } } : {}),
          }

          try {
            const secondaryResult = await req.payload.find({
              collection: collectionSlug,
              limit: 50,
              depth: 0,
              overrideAccess: true,
              where: secondaryWhere,
            })

            for (const doc of secondaryResult.docs) {
              const d = doc as Record<string, unknown>
              // Avoid duplicates (doc might match both primary and secondary)
              const slug = (d.slug as string) || ''
              if (!results.some((r) => r.collection === collectionSlug && r.slug === slug)) {
                results.push({
                  title: (d.title as string) || (d.slug as string) || 'Sans titre',
                  slug,
                  collection: collectionSlug,
                })
              }
            }
          } catch {
            // focusKeywords field might not exist on this collection — skip secondary check
          }
        } catch {
          // Collection might not exist or not have focusKeyword field — skip
        }
      }

      // Check globals for keyword duplicates
      for (const globalSlug of globals) {
        try {
          const doc = await req.payload.findGlobal({ slug: globalSlug, depth: 0, overrideAccess: true }) as Record<string, unknown>
          const docKw = typeof doc.focusKeyword === 'string' ? doc.focusKeyword.trim().toLowerCase() : ''
          if (docKw === keyword) {
            results.push({ title: (doc.title as string) || globalSlug, slug: '', collection: `global:${globalSlug}` })
          }
        } catch { /* skip */ }
      }

      return Response.json({ used: results.length > 0, keyword, pages: results })
    } catch (error) {
      console.error('[seo-plugin/check-keyword] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
