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
import { extractTextFromLexical } from '../helpers.js'

// ---------------------------------------------------------------------------
// Heuristic generation (same logic as aiGenerate.ts, self-contained)
// ---------------------------------------------------------------------------

const TITLE_PREFIXES = [
  'Découvrez',
  'Guide',
  'Tout savoir sur',
  'Conseils pour',
  'Les clés pour',
]

const DESC_PREFIXES = [
  'Découvrez',
  'Consultez notre guide sur',
  'Tout savoir sur',
  'Apprenez comment',
  'Explorez',
]

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function truncateWords(text: string, maxLen: number, ellipsis = false): string {
  if (text.length <= maxLen) return text
  const truncated = text.substring(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  const result = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated
  const cleaned = result.replace(/[,;:\-–—]\s*$/, '').trim()
  return ellipsis ? cleaned + '...' : cleaned
}

function extractSentences(content: string): string[] {
  const cleaned = cleanText(content)
  const raw = cleaned.split(/(?<=[.!?])\s+/)
  return raw.filter((s) => s.trim().length >= 20)
}

function pickPrefix(prefixes: string[], slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0
  }
  return prefixes[Math.abs(hash) % prefixes.length]!
}

function heuristicTitle(title: string, focusKeyword: string | undefined, slug: string): string {
  if (!title || !title.trim()) {
    const fromSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return truncateWords(fromSlug, 60)
  }

  let result = title.trim()

  if (focusKeyword && focusKeyword.trim()) {
    const kwLower = focusKeyword.toLowerCase()
    if (!result.toLowerCase().includes(kwLower)) {
      const candidate = `${focusKeyword} — ${result}`
      if (candidate.length <= 60) {
        result = candidate
      } else {
        const prefix = pickPrefix(TITLE_PREFIXES, slug)
        const candidate2 = `${prefix} ${focusKeyword}`
        if (candidate2.length <= 60) result = candidate2
      }
    }
  }

  if (result.length < 40 && !result.startsWith('Découvrez') && !result.startsWith('Guide')) {
    const prefix = pickPrefix(TITLE_PREFIXES, slug)
    const candidate = `${prefix} : ${result}`
    if (candidate.length <= 60) result = candidate
  }

  return truncateWords(result, 60)
}

function heuristicDescription(content: string, focusKeyword: string | undefined, slug: string): string {
  const sentences = extractSentences(content)

  if (sentences.length === 0) {
    if (focusKeyword && focusKeyword.trim()) {
      const prefix = pickPrefix(DESC_PREFIXES, slug)
      return truncateWords(`${prefix} ${focusKeyword}.`, 160)
    }
    return ''
  }

  const prefix = pickPrefix(DESC_PREFIXES, slug)
  let desc = ''

  const firstSentenceLower = sentences[0]!.toLowerCase()
  const startsWithAction = DESC_PREFIXES.some((p) => firstSentenceLower.startsWith(p.toLowerCase()))

  if (startsWithAction) {
    desc = sentences[0]!
  } else {
    let firstClean = sentences[0]!
    const leadingArticle = firstClean.match(/^(Le|La|Les|Un|Une|L'|D')\s*/i)
    if (leadingArticle) {
      firstClean = firstClean.substring(leadingArticle[0].length)
      firstClean = firstClean.charAt(0).toLowerCase() + firstClean.slice(1)
    }
    desc = `${prefix} ${firstClean}`
  }

  for (let i = 1; i < Math.min(sentences.length, 3); i++) {
    const candidate = `${desc} ${sentences[i]}`
    if (candidate.length > 160) break
    desc = candidate
  }

  if (focusKeyword && focusKeyword.trim()) {
    if (!desc.toLowerCase().includes(focusKeyword.toLowerCase())) {
      const withKw = `${desc} ${focusKeyword}.`
      if (withKw.length <= 160) desc = withKw
    }
  }

  if (desc.length > 160) desc = truncateWords(desc, 157, true)
  return desc
}

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
// Extract text content from a document
// ---------------------------------------------------------------------------

function extractDocContent(doc: Record<string, unknown>): string {
  const parts: string[] = []

  const hero = doc.hero as Record<string, unknown> | undefined
  if (hero?.richText) parts.push(extractTextFromLexical(hero.richText, 10))

  const layout = doc.layout as unknown[] | undefined
  if (layout && Array.isArray(layout)) {
    for (const block of layout) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      if (b.richText) parts.push(extractTextFromLexical(b.richText, 10))
      if (b.columns && Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.richText) parts.push(extractTextFromLexical(colObj.richText, 10))
          }
        }
      }
    }
  }

  if (doc.content) parts.push(extractTextFromLexical(doc.content, 10))

  return parts.join(' ').trim()
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export function createAiRewriteHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      let body: {
        collection?: string
        id?: string
        field?: 'title' | 'description'
        anthropicApiKey?: string
      }
      try {
        body = await req.json!()
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const collection = typeof body.collection === 'string' ? body.collection.trim() : undefined
      const id = typeof body.id === 'string' ? body.id.trim() : undefined
      const field = body.field as 'title' | 'description' | undefined
      const anthropicApiKey = typeof body.anthropicApiKey === 'string' ? body.anthropicApiKey : undefined

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

      if (anthropicApiKey) {
        // Use Claude API
        try {
          result = await callClaudeApi(anthropicApiKey, field, title, pageContent, focusKeyword)
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
        // Heuristic mode
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
