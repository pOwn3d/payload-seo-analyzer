/**
 * Internal Linking Suggestions endpoint.
 * Analyzes page content and suggests relevant internal links from other pages.
 *
 * The editor polls this while typing, so the corpus it matches against is built
 * once and cached (`suggest-links-index:<locale>`, invalidated on every save via
 * CACHE_BASES) and read with a field projection — only title, slug and
 * focusKeyword are needed, not the whole Lexical tree of every document.
 * The endpoint itself is registered behind the shared rate limiter.
 */

import type { PayloadHandler } from 'payload'
import {
  normalizeForComparison,
} from '../helpers.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'
import { seoCache } from '../cache.js'
import { isSeoPanelUser } from '../helpers/isAdmin.js'
import { safeCacheLocale } from '../helpers/safeCacheLocale.js'

interface LinkSuggestion {
  title: string
  slug: string
  collection: string
  score: number
  contextPhrase: string
  matchType: 'keyword' | 'title' | 'slug'
}

/** One corpus entry, pre-normalized so the per-keystroke pass is pure string work. */
interface IndexEntry {
  id: string
  collectionLabel: string
  sourceType: 'collection' | 'global'
  sourceSlug: string
  title: string
  slug: string
  normalizedKeyword: string
  titleWords: string[]
  slugParts: string[]
}

/** Cache base — must stay in sync with CACHE_BASES in hooks/trackSeoScore.ts. */
export const SUGGEST_LINKS_CACHE_BASE = 'suggest-links-index'

export function createSuggestLinksHandler(collections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!isSeoPanelUser(req)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
      }

      const body = await parseJsonBody(req)

      const documentId = body.documentId as string | number | undefined
      const currentCollection = typeof body.collection === 'string' ? body.collection.trim() : undefined
      const content = typeof body.content === 'string' ? body.content.trim() : undefined

      if (!content) {
        return Response.json({ suggestions: [] })
      }

      const normalizedContent = normalizeForComparison(content)
      const suggestions: LinkSuggestion[] = []

      const reqLocale = safeCacheLocale(req)
      const cacheKey = reqLocale
        ? `${SUGGEST_LINKS_CACHE_BASE}:${reqLocale}`
        : SUGGEST_LINKS_CACHE_BASE

      let index = seoCache.get<IndexEntry[]>(cacheKey)
      if (!index) {
        // Only these three fields are ever read below — never load the bodies.
        const allFetched = await fetchAllDocs(req.payload, {
          collections,
          globals,
          depth: 0,
          select: { title: true, slug: true, focusKeyword: true },
        })

        index = []
        for (const { doc, sourceType, sourceSlug } of allFetched) {
          const docTitle = (doc.title as string) || (sourceType === 'global' ? sourceSlug : '')
          const docSlug = (doc.slug as string) || ''
          if (!docTitle && !docSlug) continue
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docKeyword = ((doc as any).focusKeyword as string) || ''

          index.push({
            id: String(doc.id ?? ''),
            collectionLabel: sourceType === 'global' ? `global:${sourceSlug}` : sourceSlug,
            sourceType,
            sourceSlug,
            title: docTitle,
            slug: docSlug,
            normalizedKeyword: docKeyword ? normalizeForComparison(docKeyword) : '',
            titleWords: normalizeForComparison(docTitle)
              .split(/\s+/)
              .filter((w) => w.length > 3),
            slugParts: docSlug.split('-').filter((w) => w.length > 3),
          })
        }
        seoCache.set(cacheKey, index)
      }

      for (const entry of index) {
        // Skip current document
        if (
          entry.sourceType === 'collection' &&
          entry.id === String(documentId) &&
          entry.sourceSlug === currentCollection
        ) {
          continue
        }

        const { collectionLabel, title: docTitle, slug: docSlug } = entry

        let score = 0
        let bestMatchType: LinkSuggestion['matchType'] = 'slug'
        let contextPhrase = ''

        // 1. Focus keyword match (highest priority)
        const normalizedKw = entry.normalizedKeyword
        if (normalizedKw.length > 2 && normalizedContent.includes(normalizedKw)) {
          score += 3
          bestMatchType = 'keyword'
          contextPhrase = extractContext(normalizedContent, normalizedKw, content)
        }

        // 2. Title words match
        const titleWords = entry.titleWords
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
        const slugParts = entry.slugParts
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
            collection: collectionLabel,
            score,
            contextPhrase: contextPhrase || '',
            matchType: bestMatchType,
          })
        }
      }

      // Sort by score descending, take top 10
      suggestions.sort((a, b) => b.score - a.score)
      const topSuggestions = suggestions.slice(0, 10)

      return Response.json({ suggestions: topSuggestions })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] suggest-links error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
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
