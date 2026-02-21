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
  /** Limit per collection query (default: 500) */
  limit?: number
  /** Depth for population (default: 1) */
  depth?: number
}

/**
 * Fetch all documents from the specified collections and globals.
 * Returns a unified array of { doc, sourceType, sourceSlug }.
 */
export async function fetchAllDocs(
  payload: Payload,
  options: FetchAllDocsOptions,
): Promise<FetchedDoc[]> {
  const { collections, globals = [], limit = 500, depth = 1 } = options
  const results: FetchedDoc[] = []

  // Fetch from collections
  for (const collectionSlug of collections) {
    try {
      const result = await payload.find({
        collection: collectionSlug,
        limit,
        depth,
        overrideAccess: true,
        pagination: false,
      })
      for (const doc of result.docs) {
        results.push({ doc, sourceType: 'collection', sourceSlug: collectionSlug })
      }
    } catch {
      // Collection might not exist — skip
    }
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
