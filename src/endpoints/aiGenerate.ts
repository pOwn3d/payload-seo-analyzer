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

// ---------------------------------------------------------------------------
// French CTA prefixes for natural-sounding meta
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

// ---------------------------------------------------------------------------
// Text cleaning helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and normalize whitespace */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Truncate to maxLen, keeping full words. Optionally append ellipsis. */
function truncateWords(text: string, maxLen: number, ellipsis = false): string {
  if (text.length <= maxLen) return text

  const truncated = text.substring(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  const result = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated

  // Remove trailing punctuation fragments
  const cleaned = result.replace(/[,;:\-–—]\s*$/, '').trim()
  return ellipsis ? cleaned + '...' : cleaned
}

/** Extract significant sentences from content (skip very short ones <20 chars) */
function extractSentences(content: string): string[] {
  const cleaned = cleanText(content)
  // Split on sentence boundaries
  const raw = cleaned.split(/(?<=[.!?])\s+/)
  return raw.filter((s) => s.trim().length >= 20)
}

/** Pick a random prefix from a list (deterministic based on slug hash) */
function pickPrefix(prefixes: string[], slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0
  }
  return prefixes[Math.abs(hash) % prefixes.length]!
}

// ---------------------------------------------------------------------------
// Meta title generation
// ---------------------------------------------------------------------------
function generateMetaTitle(title: string, focusKeyword: string | undefined, slug: string): string {
  if (!title || !title.trim()) {
    // Fallback: derive from slug
    const fromSlug = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return truncateWords(fromSlug, 60)
  }

  let result = title.trim()

  // If focusKeyword is provided and not already in title, try to integrate it
  if (focusKeyword && focusKeyword.trim()) {
    const kwLower = focusKeyword.toLowerCase()
    const titleLower = result.toLowerCase()

    if (!titleLower.includes(kwLower)) {
      // Try prepending keyword with a separator
      const candidate = `${focusKeyword} — ${result}`
      if (candidate.length <= 60) {
        result = candidate
      } else {
        // Try adding a CTA prefix with keyword
        const prefix = pickPrefix(TITLE_PREFIXES, slug)
        const candidate2 = `${prefix} ${focusKeyword}`
        if (candidate2.length <= 60) {
          result = candidate2
        }
        // Otherwise keep original title
      }
    }
  }

  // If title is short enough, try adding a CTA prefix
  if (result.length < 40 && !result.startsWith('Découvrez') && !result.startsWith('Guide')) {
    const prefix = pickPrefix(TITLE_PREFIXES, slug)
    const candidate = `${prefix} : ${result}`
    if (candidate.length <= 60) {
      result = candidate
    }
  }

  return truncateWords(result, 60)
}

// ---------------------------------------------------------------------------
// Meta description generation
// ---------------------------------------------------------------------------
function generateMetaDescription(
  content: string,
  focusKeyword: string | undefined,
  slug: string,
): string {
  const sentences = extractSentences(content)

  if (sentences.length === 0) {
    // Fallback: use keyword or slug
    if (focusKeyword && focusKeyword.trim()) {
      const prefix = pickPrefix(DESC_PREFIXES, slug)
      return truncateWords(`${prefix} ${focusKeyword}.`, 160)
    }
    return ''
  }

  // Start building the description
  const prefix = pickPrefix(DESC_PREFIXES, slug)
  let desc = ''

  // Check if the first sentence already starts with a CTA-like word
  const firstSentenceLower = sentences[0]!.toLowerCase()
  const startsWithAction = DESC_PREFIXES.some((p) =>
    firstSentenceLower.startsWith(p.toLowerCase()),
  )

  if (startsWithAction) {
    // Use sentences directly
    desc = sentences[0]!
  } else {
    // Prepend a CTA prefix
    // Clean the first sentence: remove leading "Le/La/Les/Un/Une" for smoother flow
    let firstClean = sentences[0]!
    const leadingArticle = firstClean.match(/^(Le|La|Les|Un|Une|L'|D')\s*/i)
    if (leadingArticle) {
      firstClean = firstClean.substring(leadingArticle[0].length)
      // Lowercase the first char after article removal
      firstClean = firstClean.charAt(0).toLowerCase() + firstClean.slice(1)
    }

    desc = `${prefix} ${firstClean}`
  }

  // Try adding more sentences if there's room
  for (let i = 1; i < Math.min(sentences.length, 3); i++) {
    const candidate = `${desc} ${sentences[i]}`
    if (candidate.length > 160) break
    desc = candidate
  }

  // Include focusKeyword if not already present
  if (focusKeyword && focusKeyword.trim()) {
    const kwLower = focusKeyword.toLowerCase()
    if (!desc.toLowerCase().includes(kwLower)) {
      // Try appending keyword context
      const withKw = `${desc} ${focusKeyword}.`
      if (withKw.length <= 160) {
        desc = withKw
      }
    }
  }

  // Truncate to 160 chars
  if (desc.length > 160) {
    desc = truncateWords(desc, 157, true)
  }

  return desc
}

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
      let body: { title?: string; focusKeyword?: string; content?: string; slug?: string }
      try {
        body = await req.json!()
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const { title = '', focusKeyword, content = '', slug = '' } = body

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
      console.error('[seo-plugin/ai-generate] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
