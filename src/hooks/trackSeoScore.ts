/**
 * SEO Score tracking hook.
 * Automatically records a score snapshot after each document save.
 *
 * Usage (in plugin.ts):
 *   collection.hooks.afterChange = [
 *     ...(collection.hooks?.afterChange || []),
 *     createTrackSeoScoreHook(seoConfig),
 *   ]
 */

import type { CollectionAfterChangeHook, GlobalAfterChangeHook } from 'payload'
import type { SeoConfig } from '../types.js'
import { analyzeSeo } from '../index.js'
import { buildSeoInputFromDoc } from '../endpoints/validate.js'
import { countWords, extractTextFromLexical } from '../helpers.js'
import { seoCache } from '../cache.js'

/** Minimum interval between snapshots in milliseconds (1 hour) */
const RATE_LIMIT_MS = 60 * 60 * 1000

export function createTrackSeoScoreHook(seoConfig?: SeoConfig): CollectionAfterChangeHook {
  return async ({ doc, collection, req }) => {
    // Fire-and-forget — don't block the save
    const doTrack = async () => {
      try {
        const collectionSlug =
          typeof collection === 'string' ? collection : collection?.slug
        if (!collectionSlug || !doc?.id) return

        // Rate limit: check if last snapshot is recent enough
        const recentSnapshots = await req.payload.find({
          collection: 'seo-score-history',
          where: {
            and: [
              { documentId: { equals: String(doc.id) } },
              { collection: { equals: collectionSlug } },
            ],
          },
          sort: '-snapshotDate',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (recentSnapshots.docs.length > 0) {
          const lastSnapshot = recentSnapshots.docs[0] as Record<string, unknown>
          const lastDate = lastSnapshot.snapshotDate
            ? new Date(lastSnapshot.snapshotDate as string).getTime()
            : 0
          if (Date.now() - lastDate < RATE_LIMIT_MS) {
            return // Too soon — skip
          }
        }

        // Build SEO input and run analysis
        const seoInput = buildSeoInputFromDoc(doc, collectionSlug)
        const analysis = analyzeSeo(seoInput, seoConfig)

        // Compute word count for the snapshot
        let fullText = ''
        if (doc.hero?.richText) {
          fullText += extractTextFromLexical(doc.hero.richText) + ' '
        }
        const blocks = Array.isArray(doc.layout) ? doc.layout : []
        for (const block of blocks) {
          if (block?.richText) fullText += extractTextFromLexical(block.richText) + ' '
          if (block?.columns && Array.isArray(block.columns)) {
            for (const col of block.columns) {
              if (col?.richText) fullText += extractTextFromLexical(col.richText) + ' '
            }
          }
          if (block?.blockType === 'services' && Array.isArray(block.services)) {
            for (const svc of block.services) {
              if (svc?.title) fullText += svc.title + ' '
              if (svc?.description) fullText += svc.description + ' '
            }
          }
        }
        if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
          fullText += extractTextFromLexical(doc.content) + ' '
        }
        const wordCount = countWords(fullText.trim())

        // Compute checks summary
        const checksSummary = {
          pass: analysis.checks.filter((c) => c.status === 'pass').length,
          warning: analysis.checks.filter((c) => c.status === 'warning').length,
          fail: analysis.checks.filter((c) => c.status === 'fail').length,
        }

        // Save snapshot
        await req.payload.create({
          collection: 'seo-score-history',
          data: {
            documentId: String(doc.id),
            collection: collectionSlug,
            score: analysis.score,
            level: analysis.level,
            focusKeyword: seoInput.focusKeyword || '',
            wordCount,
            checksSummary,
            snapshotDate: new Date().toISOString(),
          },
          overrideAccess: true,
        })
      } catch (error) {
        // Fire-and-forget: log but never block the save
        console.error('[seo-plugin/trackSeoScore] Error recording snapshot:', error)
      }
    }

    // Invalidate all cached SEO data (audit, sitemap-audit, link-graph, etc.)
    seoCache.invalidate()

    // Run async without awaiting (fire-and-forget)
    void doTrack()

    return doc
  }
}

/**
 * SEO Score tracking hook for Globals.
 * Same fire-and-forget pattern as the collection variant, but uses
 * `global.slug` and stores `collection: 'global:<slug>'` as discriminator.
 */
export function createTrackSeoScoreGlobalHook(seoConfig?: SeoConfig): GlobalAfterChangeHook {
  return async ({ doc, global, req }) => {
    // Fire-and-forget — don't block the save
    const doTrack = async () => {
      try {
        const globalSlug = global?.slug
        if (!globalSlug) return

        const discriminator = `global:${globalSlug}`

        // For globals there is no per-document id, use the slug as documentId
        const documentId = globalSlug

        // Rate limit: check if last snapshot is recent enough
        const recentSnapshots = await req.payload.find({
          collection: 'seo-score-history',
          where: {
            and: [
              { documentId: { equals: documentId } },
              { collection: { equals: discriminator } },
            ],
          },
          sort: '-snapshotDate',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (recentSnapshots.docs.length > 0) {
          const lastSnapshot = recentSnapshots.docs[0] as Record<string, unknown>
          const lastDate = lastSnapshot.snapshotDate
            ? new Date(lastSnapshot.snapshotDate as string).getTime()
            : 0
          if (Date.now() - lastDate < RATE_LIMIT_MS) {
            return // Too soon — skip
          }
        }

        // Build SEO input and run analysis
        const seoInput = {
          ...buildSeoInputFromDoc(doc, discriminator),
          isGlobal: true,
        }
        const analysis = analyzeSeo(seoInput, seoConfig)

        // Compute word count for the snapshot
        let fullText = ''
        if (doc.hero?.richText) {
          fullText += extractTextFromLexical(doc.hero.richText) + ' '
        }
        const blocks = Array.isArray(doc.layout) ? doc.layout : []
        for (const block of blocks) {
          if (block?.richText) fullText += extractTextFromLexical(block.richText) + ' '
          if (block?.columns && Array.isArray(block.columns)) {
            for (const col of block.columns) {
              if (col?.richText) fullText += extractTextFromLexical(col.richText) + ' '
            }
          }
          if (block?.blockType === 'services' && Array.isArray(block.services)) {
            for (const svc of block.services) {
              if (svc?.title) fullText += svc.title + ' '
              if (svc?.description) fullText += svc.description + ' '
            }
          }
        }
        if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
          fullText += extractTextFromLexical(doc.content) + ' '
        }
        const wordCount = countWords(fullText.trim())

        // Compute checks summary
        const checksSummary = {
          pass: analysis.checks.filter((c) => c.status === 'pass').length,
          warning: analysis.checks.filter((c) => c.status === 'warning').length,
          fail: analysis.checks.filter((c) => c.status === 'fail').length,
        }

        // Save snapshot
        await req.payload.create({
          collection: 'seo-score-history',
          data: {
            documentId,
            collection: discriminator,
            score: analysis.score,
            level: analysis.level,
            focusKeyword: seoInput.focusKeyword || '',
            wordCount,
            checksSummary,
            snapshotDate: new Date().toISOString(),
          },
          overrideAccess: true,
        })
      } catch (error) {
        // Fire-and-forget: log but never block the save
        console.error('[seo-plugin/trackSeoScoreGlobal] Error recording snapshot:', error)
      }
    }

    // Invalidate all cached SEO data (audit, sitemap-audit, link-graph, etc.)
    seoCache.invalidate()

    // Run async without awaiting (fire-and-forget)
    void doTrack()

    return doc
  }
}
