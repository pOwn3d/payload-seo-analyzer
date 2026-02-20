/**
 * Breadcrumb endpoint handler.
 * GET — generates breadcrumb JSON-LD and a simple items array for a page.
 *
 * Query params:
 *   ?slug=xxx — the page slug (required)
 *   &collection=pages — the collection to look in (default: pages)
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbListItem {
  '@type': 'ListItem'
  position: number
  name: string
  item: string
}

interface BreadcrumbJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: BreadcrumbListItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalize the first letter and replace dashes with spaces */
function humanize(segment: string): string {
  const spaced = segment.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

export function createBreadcrumbHandler(targetCollections: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url || '', 'http://localhost')
      const slug = url.searchParams.get('slug')
      const collection = url.searchParams.get('collection') || 'pages'

      if (!slug) {
        return Response.json({ error: 'Missing ?slug parameter' }, { status: 400 })
      }

      // 1. Fetch breadcrumb settings
      let homeLabel = 'Accueil'
      let enabled = true
      let showOnHome = false

      try {
        const settingsResult = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })
        const settings = settingsResult.docs?.[0]
        if (settings) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bc = (settings as any).breadcrumb
          if (bc && typeof bc === 'object') {
            if (typeof bc.homeLabel === 'string' && bc.homeLabel) homeLabel = bc.homeLabel
            if (typeof bc.enabled === 'boolean') enabled = bc.enabled
            if (typeof bc.showOnHome === 'boolean') showOnHome = bc.showOnHome
          }
        }
      } catch {
        // SeoSettings might not exist yet — use defaults
      }

      if (!enabled) {
        return Response.json({ items: [], jsonLd: null, enabled: false })
      }

      // 2. Check if this is the homepage
      const isHome = slug === 'home' || slug === '' || slug === '/'
      if (isHome && !showOnHome) {
        return Response.json({ items: [], jsonLd: null, enabled: true, isHome: true })
      }

      // 3. Determine base URL
      const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

      // 4. Build breadcrumb items from slug path segments
      const segments = slug.split('/').filter(Boolean)
      const items: BreadcrumbItem[] = [{ name: homeLabel, url: siteUrl }]

      // For each segment, try to find a matching page to get the real title
      for (let i = 0; i < segments.length; i++) {
        const partialSlug = segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1

        let name = humanize(segments[i])

        // Try to find the page by slug in target collections
        for (const collSlug of targetCollections) {
          try {
            const result = await req.payload.find({
              collection: collSlug,
              where: { slug: { equals: partialSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (result.docs.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const doc = result.docs[0] as any
              // Use meta title, then page title, then fallback to humanized segment
              const docTitle = doc.meta?.title || doc.title
              if (typeof docTitle === 'string' && docTitle.trim()) {
                name = docTitle.trim()
              }
              break
            }
          } catch {
            // Collection might not exist — skip silently
          }
        }

        // If this is the requested collection specifically, also try there
        if (!targetCollections.includes(collection)) {
          try {
            const result = await req.payload.find({
              collection,
              where: { slug: { equals: partialSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (result.docs.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const doc = result.docs[0] as any
              const docTitle = doc.meta?.title || doc.title
              if (typeof docTitle === 'string' && docTitle.trim()) {
                name = docTitle.trim()
              }
            }
          } catch {
            // Collection might not exist
          }
        }

        items.push({
          name,
          url: isLast ? `${siteUrl}/${partialSlug}` : `${siteUrl}/${partialSlug}`,
        })
      }

      // 5. Build JSON-LD
      const jsonLd: BreadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem' as const,
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }

      return Response.json({ items, jsonLd, enabled: true })
    } catch (error) {
      console.error('[seo-plugin/breadcrumb] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
