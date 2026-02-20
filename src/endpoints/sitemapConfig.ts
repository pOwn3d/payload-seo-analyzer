/**
 * Sitemap Config endpoint handler.
 * GET — returns sitemap configuration from seo-settings + a preview
 * of generated sitemap entries for all pages/posts.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriorityOverride {
  slugPattern: string
  priority: number
  changefreq?: string
}

interface SitemapPreviewEntry {
  url: string
  collection: string
  title: string
  changefreq: string
  priority: number
  lastmod: string
}

// ---------------------------------------------------------------------------
// Simple glob matching: supports trailing * (startsWith)
// ---------------------------------------------------------------------------

function matchPattern(slug: string, pattern: string): boolean {
  // Exact match
  if (pattern === slug) return true

  // Wildcard at end: "blog/*" matches "blog/article-1"
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return slug.startsWith(prefix)
  }

  return false
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

export function createSitemapConfigHandler(targetCollections: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // 1. Fetch settings
      let excludedSlugs: string[] = []
      let defaultChangefreq = 'weekly'
      let defaultPriority = 0.5
      let priorityOverrides: PriorityOverride[] = []

      try {
        const settingsResult = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })
        const settings = settingsResult.docs?.[0]
        if (settings) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sitemap = (settings as any).sitemap
          if (sitemap && typeof sitemap === 'object') {
            if (Array.isArray(sitemap.excludedSlugs)) {
              excludedSlugs = sitemap.excludedSlugs
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((s: any) => (typeof s === 'string' ? s : s?.slug || ''))
                .filter(Boolean)
            }
            if (typeof sitemap.defaultChangefreq === 'string') {
              defaultChangefreq = sitemap.defaultChangefreq
            }
            if (typeof sitemap.defaultPriority === 'number') {
              defaultPriority = sitemap.defaultPriority
            }
            if (Array.isArray(sitemap.priorityOverrides)) {
              priorityOverrides = sitemap.priorityOverrides
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((o: any) => o && typeof o.slugPattern === 'string')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((o: any) => ({
                  slugPattern: o.slugPattern,
                  priority: typeof o.priority === 'number' ? o.priority : defaultPriority,
                  ...(o.changefreq && { changefreq: o.changefreq }),
                }))
            }
          }
        }
      } catch {
        // SeoSettings might not exist yet — use defaults
      }

      // 2. Fetch all pages + posts
      const excludedSet = new Set(excludedSlugs)
      const preview: SitemapPreviewEntry[] = []
      let totalPages = 0
      let excludedCount = 0

      for (const collectionSlug of targetCollections) {
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
            const slug = (d.slug as string) || ''
            const title = (d.title as string) || ''

            totalPages++

            // Check exclusion
            if (excludedSet.has(slug)) {
              excludedCount++
              continue
            }

            // Compute priority and changefreq for this page
            let pageChangefreq = defaultChangefreq
            let pagePriority = defaultPriority

            // Apply overrides (last match wins)
            for (const override of priorityOverrides) {
              if (matchPattern(slug, override.slugPattern)) {
                pagePriority = override.priority
                if (override.changefreq) {
                  pageChangefreq = override.changefreq
                }
              }
            }

            // Homepage gets highest priority if no override set
            if ((slug === 'home' || slug === '') && !priorityOverrides.some((o) => matchPattern(slug, o.slugPattern))) {
              pagePriority = 1.0
              pageChangefreq = 'daily'
            }

            preview.push({
              url: slug ? `/${slug}` : '/',
              collection: collectionSlug,
              title,
              changefreq: pageChangefreq,
              priority: pagePriority,
              lastmod: d.updatedAt || '',
            })
          }
        } catch {
          // Collection might not exist — skip silently
        }
      }

      // Sort by priority descending, then alphabetically
      preview.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return a.url.localeCompare(b.url)
      })

      return Response.json({
        config: {
          excludedSlugs,
          defaultChangefreq,
          defaultPriority,
          priorityOverrides,
        },
        preview,
        stats: {
          totalPages,
          excludedCount,
          includedCount: totalPages - excludedCount,
        },
      })
    } catch (error) {
      console.error('[seo-plugin/sitemap-config] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
