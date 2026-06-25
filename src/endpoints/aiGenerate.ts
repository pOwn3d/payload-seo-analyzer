/**
 * AI Meta Generation endpoint.
 * Generates meta title + meta description from page content using heuristic extraction.
 * No external AI API needed — pure algorithmic approach.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { generateMetaTitle, generateMetaDescription } from '../helpers/metaGeneration.js'
import { parseJsonBody } from '../helpers/parseBody.js'

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------
export function createAiGenerateHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      const body = await parseJsonBody(req)

      const title = typeof body.title === 'string' ? body.title : ''
      const focusKeyword = typeof body.focusKeyword === 'string' ? body.focusKeyword : undefined
      const content = typeof body.content === 'string' ? body.content : ''
      const slug = typeof body.slug === 'string' ? body.slug : ''

      if (!title && !content) {
        return Response.json(
          { error: 'At least title or content is required' },
          { status: 400 },
        )
      }

      const metaTitle = generateMetaTitle(title, focusKeyword, slug)
      const metaDescription = generateMetaDescription(content, focusKeyword, slug)

      return Response.json({ metaTitle, metaDescription })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-generate error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
