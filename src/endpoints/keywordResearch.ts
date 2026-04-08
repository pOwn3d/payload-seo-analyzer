/**
 * Keyword Research endpoint.
 * Analyzes existing content across target collections to suggest keywords.
 * Uses TF-IDF scoring, stop word filtering, and focusKeyword gap analysis.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'
import {
  getStopWordsFR,
  normalizeForComparison,
  countWords,
} from '../helpers.js'
import { extractDocContent } from '../helpers/extractDocContent.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SuggestionType = 'unused' | 'related' | 'trending' | 'long-tail'

interface Suggestion {
  keyword: string
  type: SuggestionType
  score: number
  frequency: number
  currentlyUsedBy: string[]
  suggestedFor: string[]
}

interface DocData {
  id: string | number
  title: string
  slug: string
  collection: string
  focusKeyword: string
  fullText: string
  wordCount: number
}

// ---------------------------------------------------------------------------
// Text processing utilities
// ---------------------------------------------------------------------------

const STOP_WORDS_SET = new Set<string>()

function getStopWords(): Set<string> {
  if (STOP_WORDS_SET.size === 0) {
    for (const w of getStopWordsFR()) {
      STOP_WORDS_SET.add(w)
    }
    // Additional common French words to filter
    const extras = [
      'plus', 'tout', 'tous', 'toute', 'toutes', 'être', 'avoir',
      'faire', 'comme', 'mais', 'donc', 'car', 'ni', 'si',
      'très', 'bien', 'aussi', 'peut', 'cette', 'ces', 'votre',
      'notre', 'notre', 'vos', 'nos', 'elle', 'elles', 'lui',
      'eux', 'même', 'autres', 'autre', 'entre', 'sans', 'vers',
      'chez', 'sous', 'depuis', 'avant', 'après', 'jusqu',
      'encore', 'déjà', 'toujours', 'jamais', 'rien', 'chaque',
      'peu', 'où', 'quand', 'comment', 'pourquoi', 'quoi',
      'celui', 'celle', 'ceux', 'celles', 'dont',
    ]
    for (const w of extras) {
      STOP_WORDS_SET.add(w)
    }
  }
  return STOP_WORDS_SET
}

/**
 * Tokenize text: lowercase, strip accents, split on non-alpha, filter stop words.
 * Returns tokens of 3+ chars.
 */
function tokenize(text: string): string[] {
  const normalized = normalizeForComparison(text)
  const words = normalized.split(/[^a-z0-9]+/).filter((w) => w.length >= 3)
  const stops = getStopWords()
  return words.filter((w) => !stops.has(w))
}

/**
 * Extract 2-gram and 3-gram phrases from text.
 * Filters out phrases that are entirely stop words.
 */
function extractNgrams(text: string): string[] {
  const normalized = normalizeForComparison(text)
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2)
  const stops = getStopWords()
  const ngrams: string[] = []

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]
    const w2 = words[i + 1]
    // At least one word must NOT be a stop word
    if (!stops.has(w1) || !stops.has(w2)) {
      // Both words must be 2+ chars and the combination meaningful
      if (w1.length >= 2 && w2.length >= 2) {
        ngrams.push(`${w1} ${w2}`)
      }
    }
  }

  // Trigrams
  for (let i = 0; i < words.length - 2; i++) {
    const w1 = words[i]
    const w2 = words[i + 1]
    const w3 = words[i + 2]
    const significant = [w1, w2, w3].filter((w) => !stops.has(w) && w.length >= 3)
    if (significant.length >= 2) {
      ngrams.push(`${w1} ${w2} ${w3}`)
    }
  }

  return ngrams
}

/**
 * Simple stemming for French: strip common suffixes.
 * Not a full stemmer — just enough for keyword grouping.
 */
function simpleStem(word: string): string {
  const normalized = normalizeForComparison(word)
  // Strip common French suffixes
  return normalized
    .replace(/(?:ement|ement|ation|ition|ement|ment|eur|euse|eux|ique|iste|able|ible|tion|sion)$/, '')
    .replace(/(?:es|er|ez|ent|ant|ait|ais|ions|iez|aient)$/, '')
    .replace(/s$/, '')
}

// ---------------------------------------------------------------------------
// Extract text from a document (delegates to shared helper)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDocText(doc: any): string {
  return extractDocContent(doc).text
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function createKeywordResearchHandler(targetCollections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'
      const CACHE_KEY = 'keyword-research'
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true })
      }

      // 1. Fetch all documents from target collections
      const allDocs: DocData[] = []

      const allFetched = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        globals,
        depth: 1,
      })

      for (const { doc, sourceType, sourceSlug } of allFetched) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any
        const fullText = extractDocText(d)
        allDocs.push({
          id: sourceType === 'global' ? sourceSlug : d.id,
          title: d.title || '(sans titre)',
          slug: d.slug || '',
          collection: sourceType === 'global' ? `global:${sourceSlug}` : sourceSlug,
          focusKeyword: d.focusKeyword || '',
          fullText,
          wordCount: countWords(fullText),
        })
      }

      if (allDocs.length === 0) {
        return Response.json({
          suggestions: [],
          stats: { totalKeywordsAnalyzed: 0, uniqueTerms: 0, suggestionsCount: 0 },
        })
      }

      // 2. Build term frequency maps
      const totalDocCount = allDocs.length

      // Per-document term frequency
      const docTermFreqs: Map<string, number>[] = []
      // Document frequency: how many docs contain each term
      const docFrequency = new Map<string, number>()
      // Global term frequency
      const globalTermFreq = new Map<string, number>()
      // Track which docs mention each term
      const termDocIndices = new Map<string, Set<number>>()

      for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i]
        const tokens = tokenize(doc.fullText)
        const termFreq = new Map<string, number>()
        const seenTerms = new Set<string>()

        for (const token of tokens) {
          termFreq.set(token, (termFreq.get(token) || 0) + 1)
          globalTermFreq.set(token, (globalTermFreq.get(token) || 0) + 1)

          if (!seenTerms.has(token)) {
            seenTerms.add(token)
            docFrequency.set(token, (docFrequency.get(token) || 0) + 1)
            if (!termDocIndices.has(token)) termDocIndices.set(token, new Set())
            termDocIndices.get(token)!.add(i)
          }
        }

        docTermFreqs.push(termFreq)
      }

      // 3. Extract n-grams across all documents
      const ngramFreq = new Map<string, number>()
      const ngramDocIndices = new Map<string, Set<number>>()

      for (let i = 0; i < allDocs.length; i++) {
        const ngrams = extractNgrams(allDocs[i].fullText)
        const seen = new Set<string>()

        for (const ng of ngrams) {
          ngramFreq.set(ng, (ngramFreq.get(ng) || 0) + 1)
          if (!seen.has(ng)) {
            seen.add(ng)
            if (!ngramDocIndices.has(ng)) ngramDocIndices.set(ng, new Set())
            ngramDocIndices.get(ng)!.add(i)
          }
        }
      }

      // 4. Collect all existing focusKeywords
      const existingKeywords = new Map<string, string[]>() // normalized keyword -> page titles
      for (const doc of allDocs) {
        if (doc.focusKeyword) {
          const normalized = normalizeForComparison(doc.focusKeyword)
          if (!existingKeywords.has(normalized)) existingKeywords.set(normalized, [])
          existingKeywords.get(normalized)!.push(doc.title)
        }
      }

      // 5. Build suggestions
      const suggestions: Suggestion[] = []
      const addedKeywords = new Set<string>()

      // --- 5a. "unused" — terms frequent in content but not used as focusKeyword
      const sortedTerms = Array.from(globalTermFreq.entries())
        .filter(([, freq]) => freq >= 3) // appears at least 3 times
        .sort((a, b) => b[1] - a[1])

      for (const [term, freq] of sortedTerms) {
        if (addedKeywords.has(term)) continue
        if (existingKeywords.has(term)) continue
        if (term.length < 4) continue // skip very short terms

        const df = docFrequency.get(term) || 1
        // TF-IDF-like score: high frequency but not in every doc
        const idf = Math.log(totalDocCount / df)
        const tfidfScore = Math.min(100, Math.round((freq * idf) * 2))

        if (tfidfScore < 10) continue

        // Find pages that could use this keyword (pages that mention it most)
        const docIndices = termDocIndices.get(term) || new Set()
        const suggestedFor = Array.from(docIndices)
          .map((idx) => ({ idx, freq: docTermFreqs[idx].get(term) || 0 }))
          .sort((a, b) => b.freq - a.freq)
          .slice(0, 3)
          .map((e) => allDocs[e.idx].title)

        suggestions.push({
          keyword: term,
          type: 'unused',
          score: tfidfScore,
          frequency: df,
          currentlyUsedBy: [],
          suggestedFor,
        })
        addedKeywords.add(term)

        if (suggestions.filter((s) => s.type === 'unused').length >= 30) break
      }

      // --- 5b. "trending" — most frequent meaningful terms across the site
      for (const [term, freq] of sortedTerms) {
        if (addedKeywords.has(term)) continue
        if (term.length < 4) continue
        const df = docFrequency.get(term) || 0
        if (df < 2) continue // must appear in at least 2 docs

        const usedBy = existingKeywords.get(term) || []
        const docIndices = termDocIndices.get(term) || new Set()
        const suggestedFor = usedBy.length === 0
          ? Array.from(docIndices)
            .slice(0, 3)
            .map((idx) => allDocs[idx].title)
          : []

        suggestions.push({
          keyword: term,
          type: 'trending',
          score: Math.min(100, Math.round(freq * 1.5)),
          frequency: df,
          currentlyUsedBy: usedBy,
          suggestedFor,
        })
        addedKeywords.add(term)

        if (suggestions.filter((s) => s.type === 'trending').length >= 20) break
      }

      // --- 5c. "related" — terms similar to existing focusKeywords (shared stems)
      const keywordStems = new Map<string, string>() // stem -> original keyword
      for (const kw of existingKeywords.keys()) {
        const stem = simpleStem(kw)
        if (stem.length >= 3) {
          keywordStems.set(stem, kw)
        }
      }

      for (const [term] of sortedTerms) {
        if (addedKeywords.has(term)) continue
        if (existingKeywords.has(term)) continue
        if (term.length < 4) continue

        const termStem = simpleStem(term)
        if (termStem.length < 3) continue

        const matchedKw = keywordStems.get(termStem)
        if (!matchedKw) continue

        const df = docFrequency.get(term) || 1
        const usedBy = existingKeywords.get(matchedKw) || []

        const docIndices = termDocIndices.get(term) || new Set()
        const suggestedFor = Array.from(docIndices)
          .slice(0, 3)
          .map((idx) => allDocs[idx].title)

        suggestions.push({
          keyword: term,
          type: 'related',
          score: Math.min(80, Math.round(df * 10)),
          frequency: df,
          currentlyUsedBy: usedBy,
          suggestedFor,
        })
        addedKeywords.add(term)

        if (suggestions.filter((s) => s.type === 'related').length >= 20) break
      }

      // --- 5d. "long-tail" — multi-word phrases from n-grams
      const sortedNgrams = Array.from(ngramFreq.entries())
        .filter(([, freq]) => freq >= 2)
        .sort((a, b) => b[1] - a[1])

      for (const [ngram, freq] of sortedNgrams) {
        if (addedKeywords.has(ngram)) continue
        if (existingKeywords.has(ngram)) continue

        const ngramDocs = ngramDocIndices.get(ngram) || new Set()
        const df = ngramDocs.size

        // Score based on frequency and doc spread
        const score = Math.min(100, Math.round(freq * 3 + df * 5))
        if (score < 10) continue

        const usedBy = existingKeywords.get(ngram) || []
        const suggestedFor = Array.from(ngramDocs)
          .slice(0, 3)
          .map((idx) => allDocs[idx].title)

        suggestions.push({
          keyword: ngram,
          type: 'long-tail',
          score,
          frequency: df,
          currentlyUsedBy: usedBy,
          suggestedFor,
        })
        addedKeywords.add(ngram)

        if (suggestions.filter((s) => s.type === 'long-tail').length >= 30) break
      }

      // Sort all suggestions by score descending
      suggestions.sort((a, b) => b.score - a.score)

      const responseData = {
        suggestions,
        stats: {
          totalKeywordsAnalyzed: existingKeywords.size,
          uniqueTerms: globalTermFreq.size,
          suggestionsCount: suggestions.length,
        },
      }
      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] keyword-research error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
