/**
 * Create redirect endpoint handler.
 * Creates 301/302 redirect entries via Payload's collection API.
 * Supports both single and bulk redirect creation.
 * Invalidates sitemap-audit cache after creation.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'

export function createRedirectHandler(redirectsCollection: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const body = await req.json?.() || {}
      const { from, to, type = '301', redirects } = body as {
        from?: string
        to?: string
        type?: string
        redirects?: Array<{ from: string; to: string; type?: string }>
      }

      // Bulk mode: array of redirects
      if (Array.isArray(redirects) && redirects.length > 0) {
        const created: Array<{ from: string; to: string; id: unknown }> = []
        const errors: Array<{ from: string; to: string; error: string }> = []
        let skipped = 0

        for (const r of redirects) {
          if (!r.from || !r.to) {
            errors.push({ from: r.from || '', to: r.to || '', error: 'Missing from or to' })
            continue
          }
          try {
            const fromPath = r.from.startsWith('/') ? r.from : `/${r.from}`
            const toPath = r.to.startsWith('/') ? r.to : `/${r.to}`

            // Dedup check: skip if a redirect with the same `from` already exists
            const existing = await req.payload.find({
              collection: redirectsCollection,
              where: { from: { equals: fromPath } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })

            if (existing.docs.length > 0) {
              skipped++
              continue
            }

            const redirect = await req.payload.create({
              collection: redirectsCollection,
              data: {
                from: fromPath,
                to: toPath,
                type: r.type || '301',
              },
              overrideAccess: true,
            })
            created.push({ from: r.from, to: r.to, id: redirect.id })
          } catch (e) {
            errors.push({
              from: r.from,
              to: r.to,
              error: e instanceof Error ? e.message : 'Unknown error',
            })
          }
        }

        // Invalidate caches that depend on redirect data
        seoCache.invalidateKey('sitemap-audit')
        seoCache.invalidateKey('link-graph')

        return Response.json({
          success: true,
          created: created.length,
          skipped,
          errors: errors.length,
          details: { created, errors },
        })
      }

      // Single mode (backwards compatible)
      if (!from || !to) {
        return Response.json({ error: 'Missing from or to' }, { status: 400 })
      }

      const redirect = await req.payload.create({
        collection: redirectsCollection,
        data: {
          from: from.startsWith('/') ? from : `/${from}`,
          to: to.startsWith('/') ? to : `/${to}`,
          type,
        },
        overrideAccess: true,
      })

      // Invalidate caches that depend on redirect data
      seoCache.invalidateKey('sitemap-audit')
      seoCache.invalidateKey('link-graph')

      return Response.json({ success: true, redirect })
    } catch (error) {
      console.error('[seo-plugin/create-redirect] Error:', error)
      return Response.json({ error: 'Failed to create redirect' }, { status: 500 })
    }
  }
}
