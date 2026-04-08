/**
 * SEO Logs endpoint handler.
 * - GET: Returns 404 logs for the admin dashboard (with stats)
 * - POST: Logs a new 404 hit (requires secret header or authenticated admin)
 * - DELETE: Clear/ignore logs
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler, Where } from 'payload'
import { timingSafeEqual } from 'crypto'
import { createRateLimiter, getClientIp } from '../rateLimiter.js'
import { parseJsonBody } from '../helpers/parseBody.js'

const VALID_LOG_TYPES = ['404', 'redirect', 'error']

/** Check if the user has admin role */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  return false
}

export function createSeoLogsHandler(seoLogsSecret?: string): PayloadHandler {
  // Rate limiter for POST: 30 requests per 60 seconds per IP
  const postLimiter = createRateLimiter(30, 60_000)

  return async (req) => {
    const method = req.method?.toUpperCase()

    // POST: Log a hit (requires secret header or authenticated admin)
    if (method === 'POST') {
      try {
        // Rate limit POST requests
        const ip = getClientIp(req)
        if (!postLimiter.check(ip)) {
          return Response.json(
            { error: 'Too Many Requests. Please try again later.' },
            { status: 429 },
          )
        }

        // Auth check: secret header OR authenticated user
        if (seoLogsSecret) {
          const headerSecret = req.headers.get('x-seo-secret')
          if (!headerSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
          // Timing-safe comparison to prevent timing attacks
          const isValid =
            headerSecret.length === seoLogsSecret.length &&
            timingSafeEqual(Buffer.from(headerSecret), Buffer.from(seoLogsSecret))
          if (!isValid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
        } else {
          // No secret configured — require authenticated admin
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
        }

        const body = await parseJsonBody(req)

        const url = typeof body.url === 'string' ? body.url.trim() : undefined
        const type = typeof body.type === 'string' ? body.type.trim() : '404'
        const referrer = typeof body.referrer === 'string' ? body.referrer.trim() : undefined
        const userAgent = typeof body.userAgent === 'string' ? body.userAgent.trim() : undefined

        if (!url) {
          return Response.json({ error: 'Missing url' }, { status: 400 })
        }

        // Validate url length
        if (url.length > 500) {
          return Response.json({ error: 'URL too long (max 500 chars)' }, { status: 400 })
        }

        // Validate type
        if (!VALID_LOG_TYPES.includes(type)) {
          return Response.json({ error: `Invalid type. Must be one of: ${VALID_LOG_TYPES.join(', ')}` }, { status: 400 })
        }

        // Normalize URL
        const normalizedUrl = url.toLowerCase().split('?')[0].split('#')[0]

        // Check if this URL is already logged (upsert: increment count)
        try {
          const existing = await req.payload.find({
            collection: 'seo-logs',
            where: { url: { equals: normalizedUrl } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existing.docs.length > 0) {
            const doc = existing.docs[0]
            await req.payload.update({
              collection: 'seo-logs',
              id: doc.id,
              data: {
                count: ((doc as Record<string, unknown>).count as number || 0) + 1,
                lastSeen: new Date().toISOString(),
                ...(referrer && { referrer }),
                ...(userAgent && { userAgent }),
              },
              overrideAccess: true,
            })
            return Response.json({ success: true, action: 'incremented' })
          }
        } catch {
          // Collection might not exist yet
        }

        // Create new log entry
        await req.payload.create({
          collection: 'seo-logs',
          data: {
            url: normalizedUrl,
            type,
            count: 1,
            lastSeen: new Date().toISOString(),
            referrer: referrer || '',
            userAgent: userAgent || '',
            ignored: false,
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, action: 'created' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to log'
        req.payload.logger.error(`[seo] seo-logs POST error: ${message}`)
        return Response.json({ error: message }, { status: 500 })
      }
    }

    // GET & DELETE: Require auth
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // DELETE: Clear or ignore logs (admin only)
    if (method === 'DELETE') {
      if (!isAdmin(req.user)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 })
      }
      try {
        const urlObj = new URL(req.url as string)
        const id = urlObj.searchParams.get('id')
        const action = urlObj.searchParams.get('action') || 'delete'

        if (id) {
          if (action === 'ignore') {
            await req.payload.update({
              collection: 'seo-logs',
              id,
              data: { ignored: true },
              overrideAccess: true,
            })
            return Response.json({ success: true })
          }

          await req.payload.delete({
            collection: 'seo-logs',
            id,
            overrideAccess: true,
          })
          return Response.json({ success: true })
        }

        // Clear all non-ignored logs in a single bulk delete operation
        const deleteResult = await req.payload.delete({
          collection: 'seo-logs',
          where: { ignored: { not_equals: true } },
          overrideAccess: true,
        })
        const deletedCount = Array.isArray(deleteResult.docs) ? deleteResult.docs.length : 0
        return Response.json({ success: true, deleted: deletedCount })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete'
        req.payload.logger.error(`[seo] seo-logs DELETE error: ${message}`)
        return Response.json({ error: message }, { status: 500 })
      }
    }

    // GET: Return all 404 logs sorted by count (most frequent first)
    try {
      const urlObj = new URL(req.url as string)
      const showIgnored = urlObj.searchParams.get('ignored') === '1'

      const where: Where = showIgnored ? {} : { ignored: { not_equals: true } }

      const result = await req.payload.find({
        collection: 'seo-logs',
        where,
        sort: '-count',
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })

      const logs = result.docs.map((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any
        return {
          id: d.id,
          url: d.url,
          type: d.type,
          count: d.count,
          lastSeen: d.lastSeen,
          referrer: d.referrer,
          userAgent: d.userAgent,
          ignored: d.ignored,
          createdAt: d.createdAt,
        }
      })

      const stats = {
        total: logs.length,
        totalHits: logs.reduce((s, l) => s + (l.count || 0), 0),
        unique404: logs.filter((l) => l.type === '404').length,
      }

      return Response.json({ logs, stats })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] seo-logs GET error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
