/**
 * robots.txt endpoint handlers.
 * GET — Dynamically generates robots.txt from seo-settings configuration.
 * POST — Saves custom robots.txt rules to seo-settings (admin only).
 */

import type { PayloadHandler } from 'payload'
import { parseJsonBody } from '../helpers/parseBody.js'

/** Check if the user has admin role */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  return false
}

/**
 * GET handler — generates robots.txt dynamically from seo-settings.
 * Public endpoint, no authentication required.
 */
export function createRobotsHandler(targetCollections: string[]): PayloadHandler {
  return async (req) => {
    try {
      const settings = await req.payload.find({
        collection: 'seo-settings',
        limit: 1,
        overrideAccess: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = settings.docs[0] as Record<string, any> | undefined

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

      let content = `User-agent: *\n`
      content += `Allow: /\n`
      content += `Disallow: /admin/*\n`
      content += `Disallow: /api/*\n`

      // Add custom rules from settings
      if (config?.robotsCustomRules) {
        content += config.robotsCustomRules + '\n'
      }

      // Add sitemap reference
      content += `\nSitemap: ${serverUrl}/sitemap.xml\n`

      return new Response(content, {
        headers: { 'Content-Type': 'text/plain' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] robots.txt generation error: ${message}`)
      return new Response('# Error generating robots.txt\nUser-agent: *\nAllow: /\n', {
        headers: { 'Content-Type': 'text/plain' },
        status: 500,
      })
    }
  }
}

/**
 * POST handler — saves custom robots.txt rules to seo-settings.
 * Requires authenticated admin user.
 */
export function createRobotsUpdateHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (!isAdmin(req.user)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 })
      }

      const body = await parseJsonBody(req)
      const robotsCustomRules = typeof body.robotsCustomRules === 'string' ? body.robotsCustomRules : ''

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
          data: { robotsCustomRules },
          overrideAccess: true,
        })
      } else {
        settings = await req.payload.create({
          collection: 'seo-settings',
          data: { robotsCustomRules },
          overrideAccess: true,
        })
      }

      return Response.json({ settings, success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] robots.txt update error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
