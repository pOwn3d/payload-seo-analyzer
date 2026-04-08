/**
 * Duplicate Content Detection endpoint (sitewide).
 * Compares pages pairwise using Jaccard similarity on word trigrams.
 * Flags pairs with >70% similarity.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware.
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'
import { extractDocContent } from '../helpers/extractDocContent.js'

interface PageInfo {
  id: string | number
  title: string
  slug: string
  collection: string
}

interface DuplicatePair {
  page1: PageInfo
  page2: PageInfo
  similarity: number
}

// ---------------------------------------------------------------------------
// Trigram-based Jaccard similarity
// ---------------------------------------------------------------------------

/** Generate word trigrams from text */
function getWordTrigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((w) => w.length > 1)

  const trigrams = new Set<string>()
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }
  return trigrams
}

/** Jaccard similarity between two sets */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0

  let intersection = 0
  // Iterate over the smaller set for efficiency
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA]
  for (const item of smaller) {
    if (larger.has(item)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ---------------------------------------------------------------------------
// Text extraction from a Payload document (delegates to shared helper)
// ---------------------------------------------------------------------------

function extractDocText(doc: Record<string, unknown>): string {
  return extractDocContent(doc).text
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

const MAX_DOCS = 200
const SIMILARITY_THRESHOLD = 0.7

export function createDuplicateContentHandler(collections: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url || '', 'http://localhost')
      const noCache = url.searchParams.get('nocache') === '1'
      const threshold = parseFloat(url.searchParams.get('threshold') || '') || SIMILARITY_THRESHOLD
      const CACHE_KEY = `duplicate-content-${threshold}`
      const cached = noCache ? null : seoCache.get<unknown>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...(cached as Record<string, unknown>), cached: true })
      }

      // Fetch all documents (limited)
      const allDocs: Array<{ info: PageInfo; text: string; trigrams: Set<string> }> = []

      for (const collectionSlug of collections) {
        if (allDocs.length >= MAX_DOCS) break

        try {
          const remaining = MAX_DOCS - allDocs.length
          const result = await req.payload.find({
            collection: collectionSlug,
            limit: remaining,
            depth: 1,
            overrideAccess: true,
          })

          for (const doc of result.docs) {
            if (allDocs.length >= MAX_DOCS) break
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = doc as any
            const text = extractDocText(d)

            // Skip docs with very little text (< 50 words)
            const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length
            if (wordCount < 50) continue

            allDocs.push({
              info: {
                id: d.id,
                title: d.title || '(sans titre)',
                slug: d.slug || '',
                collection: collectionSlug,
              },
              text,
              trigrams: getWordTrigrams(text),
            })
          }
        } catch {
          // Collection might not exist — skip
        }
      }

      // Pairwise comparison
      const duplicates: DuplicatePair[] = []

      for (let i = 0; i < allDocs.length; i++) {
        for (let j = i + 1; j < allDocs.length; j++) {
          const similarity = jaccardSimilarity(allDocs[i]!.trigrams, allDocs[j]!.trigrams)

          if (similarity >= threshold) {
            duplicates.push({
              page1: allDocs[i]!.info,
              page2: allDocs[j]!.info,
              similarity: Math.round(similarity * 100) / 100,
            })
          }
        }
      }

      // Sort by similarity (highest first)
      duplicates.sort((a, b) => b.similarity - a.similarity)

      const responseData = {
        duplicates,
        stats: {
          totalDocuments: allDocs.length,
          totalPairs: duplicates.length,
          threshold,
        },
      }

      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] duplicate-content error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
