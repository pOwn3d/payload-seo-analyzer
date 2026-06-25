/**
 * Fetch all documents from target collections + globals in a uniform format.
 * Reused by audit, cannibalization, linkGraph, keywordResearch, etc.
 */

import type { Payload } from 'payload'

export type DocSourceType = 'collection' | 'global'

export interface FetchedDoc {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
  sourceType: DocSourceType
  sourceSlug: string
}

export interface FetchAllDocsOptions {
  collections: string[]
  globals?: string[]
  /**
   * Hard cap on the TOTAL number of collection docs loaded into memory (across all
   * collections). Defaults to env `SEO_FETCH_MAX_DOCS` or 5000. Bounds memory while
   * paginating through everything below the cap (no silent 500-doc truncation).
   */
  maxDocs?: number
  /** @deprecated alias for `maxDocs` — kept for backwards compatibility. */
  limit?: number
  /** Depth for population (default: 1) */
  depth?: number
}

/** Page size for the internal paginated reads. */
const PAGE_SIZE = 200

/**
 * Fetch all documents from the specified collections and globals.
 * Returns a unified array of { doc, sourceType, sourceSlug }.
 *
 * Paginates through every page (up to `maxDocs`) instead of a single capped
 * `find({ limit, pagination: false })` — the old behaviour silently dropped docs
 * beyond 500, producing false "orphan"/"broken link" results on larger sites.
 */
export async function fetchAllDocs(
  payload: Payload,
  options: FetchAllDocsOptions,
): Promise<FetchedDoc[]> {
  const { collections, globals = [], depth = 1 } = options
  const maxDocs = options.maxDocs ?? options.limit ?? (Number(process.env.SEO_FETCH_MAX_DOCS) || 5000)
  const results: FetchedDoc[] = []
  let reachedCap = false

  // Fetch from collections (paginated)
  for (const collectionSlug of collections) {
    if (reachedCap) break
    try {
      let page = 1
      let hasNextPage = true
      while (hasNextPage && !reachedCap) {
        const result = await payload.find({
          collection: collectionSlug,
          limit: PAGE_SIZE,
          page,
          depth,
          overrideAccess: true,
        })
        for (const doc of result.docs) {
          results.push({ doc, sourceType: 'collection', sourceSlug: collectionSlug })
          if (results.length >= maxDocs) {
            reachedCap = true
            break
          }
        }
        hasNextPage = !!result.hasNextPage
        page++
      }
    } catch {
      // Collection might not exist — skip
    }
  }

  if (reachedCap) {
    payload.logger?.warn(
      `[seo] fetchAllDocs reached the ${maxDocs}-doc cap — results may be incomplete. Raise it via SEO_FETCH_MAX_DOCS.`,
    )
  }

  // Fetch from globals
  for (const globalSlug of globals) {
    try {
      const doc = await payload.findGlobal({
        slug: globalSlug,
        depth,
        overrideAccess: true,
      })
      if (doc) {
        results.push({ doc, sourceType: 'global', sourceSlug: globalSlug })
      }
    } catch {
      // Global might not exist — skip
    }
  }

  return results
}
