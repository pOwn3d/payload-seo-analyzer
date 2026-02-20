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

const VALID_LOG_TYPES = ['404', 'redirect', 'error']

export function createSeoLogsHandler(seoLogsSecret?: string): PayloadHandler {
  return async (req) => {
    const method = req.method?.toUpperCase()

    // POST: Log a hit (requires secret header or authenticated admin)
    if (method === 'POST') {
      try {
        // Auth check: secret header OR authenticated user
        if (seoLogsSecret) {
          const headerSecret = req.headers.get('x-seo-secret')
          if (headerSecret !== seoLogsSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
        } else {
          // No secret configured — require authenticated admin
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
        }

        const body = await req.json?.() || {}
        const { url, type = '404', referrer, userAgent } = body as {
          url?: string
          type?: string
          referrer?: string
          userAgent?: string
        }

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
        console.error('[seo-plugin/seo-logs] POST error:', error)
        return Response.json({ error: 'Failed to log' }, { status: 500 })
      }
    }

    // GET & DELETE: Require auth
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // DELETE: Clear or ignore logs
    if (method === 'DELETE') {
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

        // Clear all non-ignored logs
        const all = await req.payload.find({
          collection: 'seo-logs',
          where: { ignored: { not_equals: true } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const doc of all.docs) {
          await req.payload.delete({
            collection: 'seo-logs',
            id: doc.id,
            overrideAccess: true,
          })
        }
        return Response.json({ success: true, deleted: all.docs.length })
      } catch (error) {
        console.error('[seo-plugin/seo-logs] DELETE error:', error)
        return Response.json({ error: 'Failed to delete' }, { status: 500 })
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
      console.error('[seo-plugin/seo-logs] GET error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
