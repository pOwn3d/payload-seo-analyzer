/**
 * AI Meta Rewrite endpoint.
 * Generates optimized meta title/description using either:
 * - Heuristic extraction (default, no API key needed)
 * - Claude AI API (when anthropicApiKey is provided)
 *
 * Accepts: collection, id, field (title|description), optional anthropicApiKey.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware.
 */

import type { PayloadHandler } from 'payload'
import { extractDocContent as extractDocContentHelper } from '../helpers/extractDocContent.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import {
  truncateWords,
  generateMetaTitle as heuristicTitle,
  generateMetaDescription as heuristicDescription,
} from '../helpers/metaGeneration.js'

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

async function callClaudeApi(
  apiKey: string,
  field: 'title' | 'description',
  pageTitle: string,
  pageContent: string,
  focusKeyword: string,
): Promise<string> {
  const maxChars = field === 'title' ? 60 : 160
  const fieldLabel = field === 'title' ? 'meta title' : 'meta description'

  const systemPrompt = `You are an SEO expert. Generate an optimized ${fieldLabel} for a web page.
Rules:
- Maximum ${maxChars} characters
- Include the focus keyword naturally if provided
- Write in the same language as the page content
- Be compelling and click-worthy
- Do not use quotes around the result
- Return ONLY the ${fieldLabel} text, nothing else`

  const userPrompt = `Page title: ${pageTitle}
Focus keyword: ${focusKeyword || '(none)'}
Page content (first 2000 chars): ${pageContent.substring(0, 2000)}

Generate the optimized ${fieldLabel}:`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      system: systemPrompt,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
  }

  const text = data.content?.[0]?.text || ''
  // Ensure it respects max length
  return truncateWords(text.trim(), maxChars)
}

// ---------------------------------------------------------------------------
// Extract text content from a document (delegates to shared helper)
// ---------------------------------------------------------------------------

function extractDocContent(doc: Record<string, unknown>): string {
  return extractDocContentHelper(doc).text
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export function createAiRewriteHandler(targetCollections?: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await parseJsonBody(req)

      const collection = typeof body.collection === 'string' ? body.collection.trim() : undefined
      const id = typeof body.id === 'string' ? body.id.trim() : undefined
      const field = (body.field as 'title' | 'description') || undefined

      if (!collection || !id || !field) {
        return Response.json(
          { error: 'Missing required fields: collection, id, field' },
          { status: 400 },
        )
      }

      if (field !== 'title' && field !== 'description') {
        return Response.json(
          { error: 'Field must be "title" or "description"' },
          { status: 400 },
        )
      }

      // Validate collection against allowed target collections
      if (targetCollections && !targetCollections.includes(collection)) {
        return Response.json({ error: 'Collection not allowed' }, { status: 403 })
      }

      // Fetch the document
      let doc: Record<string, unknown>
      try {
        const result = await req.payload.findByID({
          collection,
          id,
          depth: 1,
          overrideAccess: true,
        })
        doc = result as Record<string, unknown>
      } catch {
        return Response.json({ error: `Document not found: ${collection}/${id}` }, { status: 404 })
      }

      const title = (doc.title as string) || ''
      const slug = (doc.slug as string) || ''
      const focusKeyword = (doc.focusKeyword as string) || ''
      const pageContent = extractDocContent(doc)

      let result: string
      let method: 'heuristic' | 'ai'

      // Read API key from environment variable (never from client request)
      const apiKey = process.env.ANTHROPIC_API_KEY

      if (apiKey) {
        // Use Claude API
        try {
          result = await callClaudeApi(apiKey, field, title, pageContent, focusKeyword)
          method = 'ai'
        } catch (error) {
          req.payload.logger.error(`[seo] ai-rewrite Claude API error: ${error instanceof Error ? error.message : 'unknown'}`)
          // Fallback to heuristic
          result = field === 'title'
            ? heuristicTitle(title, focusKeyword, slug)
            : heuristicDescription(pageContent, focusKeyword, slug)
          method = 'heuristic'
        }
      } else {
        // Heuristic mode (no ANTHROPIC_API_KEY configured)
        result = field === 'title'
          ? heuristicTitle(title, focusKeyword, slug)
          : heuristicDescription(pageContent, focusKeyword, slug)
        method = 'heuristic'
      }

      return Response.json({
        field,
        value: result,
        method,
        length: result.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-rewrite error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
