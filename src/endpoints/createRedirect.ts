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
import { parseJsonBody } from '../helpers/parseBody.js'
import { validateRedirectTarget, normalizeFromPath } from '../helpers/redirectSafety.js'

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

export function createRedirectHandler(redirectsCollection: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(req.user)) {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    try {
      const body = await parseJsonBody(req)

      const from = typeof body.from === 'string' ? body.from.trim() : undefined
      const to = typeof body.to === 'string' ? body.to.trim() : undefined
      const type = typeof body.type === 'string' ? body.type.trim() : '301'
      const redirects = Array.isArray(body.redirects) ? body.redirects as Array<{ from: string; to: string; type?: string }> : undefined

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
            const fromPath = normalizeFromPath(r.from)
            if (!fromPath) {
              errors.push({ from: r.from, to: r.to, error: 'Invalid source path' })
              continue
            }
            const toResult = validateRedirectTarget(r.to)
            if (!toResult.valid || !toResult.normalized) {
              errors.push({ from: r.from, to: r.to, error: toResult.reason || 'Invalid destination' })
              continue
            }
            const toPath = toResult.normalized

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

        // Invalidate caches that depend on redirect data (all locale variants)
        seoCache.invalidateByPrefix('sitemap-audit')
        seoCache.invalidateByPrefix('link-graph')

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

      const fromPath = normalizeFromPath(from)
      if (!fromPath) {
        return Response.json({ error: 'Invalid source path' }, { status: 400 })
      }
      const toResult = validateRedirectTarget(to)
      if (!toResult.valid || !toResult.normalized) {
        return Response.json({ error: toResult.reason || 'Invalid destination' }, { status: 400 })
      }

      const redirect = await req.payload.create({
        collection: redirectsCollection,
        data: {
          from: fromPath,
          to: toResult.normalized,
          type,
        },
        overrideAccess: true,
      })

      // Invalidate caches that depend on redirect data (all locale variants)
      seoCache.invalidateByPrefix('sitemap-audit')
      seoCache.invalidateByPrefix('link-graph')

      return Response.json({ success: true, redirect })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create redirect'
      req.payload.logger.error(`[seo] create-redirect error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
