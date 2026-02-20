/**
 * Internal Linking Suggestions endpoint.
 * Analyzes page content and suggests relevant internal links from other pages.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import {
  normalizeForComparison,
  extractTextFromLexical,
  extractHeadingsFromLexical,
} from '../helpers.js'

interface LinkSuggestion {
  title: string
  slug: string
  collection: string
  score: number
  contextPhrase: string
  matchType: 'keyword' | 'title' | 'slug'
}

export function createSuggestLinksHandler(collections: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (req as any).json()
      const { documentId, collection: currentCollection, content } = body as {
        documentId?: string | number
        collection?: string
        content?: string
      }

      if (!content || !content.trim()) {
        return Response.json({ suggestions: [] })
      }

      const normalizedContent = normalizeForComparison(content)
      const suggestions: LinkSuggestion[] = []

      // Fetch all documents from target collections
      for (const collectionSlug of collections) {
        try {
          const result = await req.payload.find({
            collection: collectionSlug,
            limit: 500,
            depth: 1,
            overrideAccess: true,
          })

          for (const doc of result.docs) {
            // Skip current document
            if (String(doc.id) === String(documentId) && collectionSlug === currentCollection) {
              continue
            }

            const docTitle = (doc.title as string) || ''
            const docSlug = (doc.slug as string) || ''
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const docKeyword = (doc as any).focusKeyword || ''

            if (!docTitle && !docSlug) continue

            let score = 0
            let bestMatchType: LinkSuggestion['matchType'] = 'slug'
            let contextPhrase = ''

            // 1. Focus keyword match (highest priority)
            if (docKeyword) {
              const normalizedKw = normalizeForComparison(docKeyword)
              if (normalizedKw.length > 2 && normalizedContent.includes(normalizedKw)) {
                score += 3
                bestMatchType = 'keyword'
                contextPhrase = extractContext(normalizedContent, normalizedKw, content)
              }
            }

            // 2. Title words match
            const titleWords = normalizeForComparison(docTitle)
              .split(/\s+/)
              .filter((w) => w.length > 3)

            if (titleWords.length >= 2) {
              const matchingWords = titleWords.filter((w) => normalizedContent.includes(w))
              if (matchingWords.length >= 2) {
                score += 2
                if (!contextPhrase) {
                  bestMatchType = 'title'
                  contextPhrase = extractContext(normalizedContent, matchingWords[0], content)
                }
              }
            }

            // 3. Slug match
            const slugParts = docSlug.split('-').filter((w) => w.length > 3)
            if (slugParts.length >= 1) {
              const matchingSlugs = slugParts.filter((w) => normalizedContent.includes(w))
              if (matchingSlugs.length >= 1 && score === 0) {
                score += 1
                bestMatchType = 'slug'
                contextPhrase = extractContext(normalizedContent, matchingSlugs[0], content)
              }
            }

            if (score > 0) {
              suggestions.push({
                title: docTitle,
                slug: docSlug,
                collection: collectionSlug,
                score,
                contextPhrase: contextPhrase || '',
                matchType: bestMatchType,
              })
            }
          }
        } catch {
          // Collection might not exist — skip silently
        }
      }

      // Sort by score descending, take top 10
      suggestions.sort((a, b) => b.score - a.score)
      const topSuggestions = suggestions.slice(0, 10)

      return Response.json({ suggestions: topSuggestions })
    } catch (error) {
      console.error('[seo-plugin/suggest-links] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

/**
 * Extract a context phrase around a matched term.
 * Returns ~60 characters around the match from the original (non-normalized) text.
 */
function extractContext(normalizedText: string, matchTerm: string, originalText: string): string {
  const idx = normalizedText.indexOf(matchTerm)
  if (idx === -1) return ''

  // Map position back to original text (approximate — same length since normalization preserves length roughly)
  const start = Math.max(0, idx - 30)
  const end = Math.min(originalText.length, idx + matchTerm.length + 30)

  let phrase = originalText.substring(start, end).trim()

  // Add ellipsis if we're not at the start/end
  if (start > 0) phrase = '...' + phrase
  if (end < originalText.length) phrase = phrase + '...'

  return phrase
}
