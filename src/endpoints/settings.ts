/**
 * SEO Settings endpoint handler.
 * GET — returns current settings from the seo-settings collection.
 * PATCH — updates (or creates) the singleton settings document.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'

export function createSettingsHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // GET — return current settings
      if (req.method === 'GET') {
        const result = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })
        const settings = result.docs[0] || {}
        return Response.json({ settings })
      }

      // PATCH — update settings
      if (req.method === 'PATCH') {
        const rawBody = await (req as any).json()

        // Whitelist allowed fields — strip everything else
        const ALLOWED_FIELDS = ['siteName', 'ignoredSlugs', 'disabledRules', 'thresholds', 'sitemap', 'breadcrumb']
        const body: Record<string, unknown> = {}
        for (const key of ALLOWED_FIELDS) {
          if (rawBody[key] !== undefined) {
            body[key] = rawBody[key]
          }
        }

        // Find existing or create
        const result = await req.payload.find({
          collection: 'seo-settings',
          limit: 1,
          overrideAccess: true,
        })

        let settings
        if (result.docs.length > 0) {
          settings = await req.payload.update({
            collection: 'seo-settings',
            id: result.docs[0].id,
            data: body,
            overrideAccess: true,
          })
        } else {
          settings = await req.payload.create({
            collection: 'seo-settings',
            data: body,
            overrideAccess: true,
          })
        }

        return Response.json({ settings, success: true })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error('[seo-plugin/settings] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
