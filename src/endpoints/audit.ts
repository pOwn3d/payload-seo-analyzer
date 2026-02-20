/**
 * SEO Audit endpoint handler.
 * Returns enriched SEO data for all pages and posts — powers the dashboard.
 * Uses the real analyzeSeo() engine for consistent scoring (sidebar ↔ dashboard).
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { analyzeSeo } from '../index.js'
import type { SeoConfig } from '../types.js'
import { buildSeoInputFromDoc } from './validate.js'
import {
  extractTextFromLexical,
  extractLinksFromLexical,
  extractHeadingsFromLexical,
  calculateFleschFR,
  countWords,
} from '../helpers.js'
import { seoCache } from '../cache.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeDoc(doc: any, collection: string, seoConfig?: SeoConfig) {
  // Build SeoInput and run the real engine
  const seoInput = buildSeoInputFromDoc(doc, collection)
  const analysis = analyzeSeo(seoInput, seoConfig)

  // Extract enriched data for the dashboard (word count, links, headings, readability)
  let fullText = ''
  const allLinks: { url: string; text: string }[] = []
  const allHeadings: { tag: string; text: string }[] = []

  if (doc.hero?.richText) {
    fullText += ' ' + extractTextFromLexical(doc.hero.richText)
    allLinks.push(...extractLinksFromLexical(doc.hero.richText))
    allHeadings.push(...extractHeadingsFromLexical(doc.hero.richText))
  }

  const blocks = Array.isArray(doc.layout) ? doc.layout : []
  for (const block of blocks) {
    if (block.richText) {
      fullText += ' ' + extractTextFromLexical(block.richText)
      allLinks.push(...extractLinksFromLexical(block.richText))
      allHeadings.push(...extractHeadingsFromLexical(block.richText))
    }
    if (block.columns) {
      for (const col of block.columns) {
        if (col?.richText) {
          fullText += ' ' + extractTextFromLexical(col.richText)
          allLinks.push(...extractLinksFromLexical(col.richText))
          allHeadings.push(...extractHeadingsFromLexical(col.richText))
        }
      }
    }
    if (block.blockType === 'services' && Array.isArray(block.services)) {
      for (const svc of block.services) {
        if (svc?.title) fullText += ' ' + svc.title
        if (svc?.description) fullText += ' ' + svc.description
      }
    }
    if (block.blockType === 'testimonials' && Array.isArray(block.testimonials)) {
      for (const t of block.testimonials) {
        if (t?.quote) fullText += ' ' + t.quote
      }
    }
  }

  if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
    fullText += ' ' + extractTextFromLexical(doc.content)
    allLinks.push(...extractLinksFromLexical(doc.content))
    allHeadings.push(...extractHeadingsFromLexical(doc.content))
  }

  fullText = fullText.trim()
  const wordCount = countWords(fullText)
  const readabilityScore = wordCount > 30 ? calculateFleschFR(fullText) : 0

  const internalLinks = allLinks.filter(
    (l) => l.url.startsWith('/') || l.url.startsWith('#') || !l.url.startsWith('http'),
  )
  const externalLinks = allLinks.filter((l) => l.url.startsWith('http'))

  const h1FromPostHero = collection === 'posts' && doc.title ? 1 : 0
  const h1InContent = allHeadings.filter((h) => h.tag === 'h1').length
  const h1Count = h1InContent + h1FromPostHero
  const headingCount = allHeadings.length + h1FromPostHero

  const focusKeywordsArr: string[] = Array.isArray(doc.focusKeywords)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc.focusKeywords.map((k: any) => k.keyword || '').filter(Boolean)
    : []

  return {
    id: doc.id,
    collection,
    title: doc.title || '',
    slug: doc.slug || '',
    metaTitle: doc.meta?.title || '',
    metaDescription: doc.meta?.description || '',
    focusKeyword: doc.focusKeyword || '',
    focusKeywords: focusKeywordsArr,
    hasOgImage: !!doc.meta?.image,
    wordCount,
    readingTime: Math.max(1, Math.round(wordCount / 200)),
    readabilityScore,
    internalLinkCount: internalLinks.length,
    externalLinkCount: externalLinks.length,
    headingCount,
    hasH1: h1Count > 0,
    h1Count,
    score: analysis.score,
    level: analysis.level,
    status: doc._status || 'published',
    updatedAt: doc.updatedAt || '',
    isCornerstone: !!doc.isCornerstone,
    contentLastReviewed: doc.contentLastReviewed || '',
    daysSinceUpdate: doc.updatedAt
      ? Math.floor((Date.now() - new Date(doc.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }
}

/** Load SeoSettings from DB and merge with plugin config */
async function loadMergedConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  pluginConfig?: SeoConfig,
): Promise<{ config: SeoConfig; ignoredSlugs: string[] }> {
  let ignoredSlugs: string[] = []
  let mergedConfig: SeoConfig = { ...pluginConfig }

  try {
    const settingsResult = await payload.find({
      collection: 'seo-settings',
      limit: 1,
      overrideAccess: true,
    })
    const settings = settingsResult.docs?.[0]
    if (settings) {
      // Merge ignored slugs
      if (Array.isArray(settings.ignoredSlugs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ignoredSlugs = settings.ignoredSlugs.map((s: any) => s.slug || s).filter(Boolean)
      }

      // Merge disabled rules
      if (Array.isArray(settings.disabledRules) && settings.disabledRules.length > 0) {
        const existing = mergedConfig.disabledRules || []
        const combined = [...new Set([...existing, ...settings.disabledRules])]
        mergedConfig = { ...mergedConfig, disabledRules: combined as SeoConfig['disabledRules'] }
      }

      // Merge site name
      if (settings.siteName) {
        mergedConfig = { ...mergedConfig, siteName: settings.siteName }
      }

      // Merge thresholds
      if (settings.thresholds && typeof settings.thresholds === 'object') {
        const thresholds: Record<string, number> = {}
        for (const [key, val] of Object.entries(settings.thresholds)) {
          if (val != null && typeof val === 'number') {
            thresholds[key] = val
          }
        }
        if (Object.keys(thresholds).length > 0) {
          mergedConfig = {
            ...mergedConfig,
            thresholds: { ...(mergedConfig.thresholds || {}), ...thresholds },
          }
        }
      }
    }
  } catch {
    // SeoSettings collection might not exist yet — use plugin config as-is
  }

  return { config: mergedConfig, ignoredSlugs }
}

export function createAuditHandler(collections: string[], seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Pagination params
      const url = new URL(req.url as string)
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '300', 10)))
      const noCache = url.searchParams.get('nocache') === '1'

      // Check cache first (unless nocache is requested)
      const CACHE_KEY = 'audit'
      type CachedAudit = { enrichedResults: ReturnType<typeof analyzeDoc>[]; stats: AuditStats }
      interface AuditStats {
        totalPages: number
        avgScore: number
        good: number
        needsWork: number
        critical: number
        noKeyword: number
        noMetaTitle: number
        noMetaDesc: number
        avgWordCount: number
        avgReadability: number
      }

      let cached = noCache ? null : seoCache.get<CachedAudit>(CACHE_KEY)

      if (!cached) {
        // Load merged config from DB settings + plugin config
        const { config: mergedConfig, ignoredSlugs } = await loadMergedConfig(req.payload, seoConfig)

        const allResults: ReturnType<typeof analyzeDoc>[] = []

        for (const collectionSlug of collections) {
          try {
            const result = await req.payload.find({
              collection: collectionSlug,
              limit: 500,
              depth: 1,
              overrideAccess: true,
            })

            for (const doc of result.docs) {
              // Skip ignored slugs
              if (ignoredSlugs.includes(doc.slug as string)) continue
              allResults.push(analyzeDoc(doc, collectionSlug, mergedConfig))
            }
          } catch {
            // Collection might not exist — skip silently
          }
        }

        // Fetch previous scores from history for trend indicator
        const previousScoreMap = new Map<string, number>()
        try {
          const historyResults = await req.payload.find({
            collection: 'seo-score-history',
            limit: allResults.length * 2,
            sort: '-snapshotDate',
            depth: 0,
            overrideAccess: true,
          })
          const seen = new Set<string>()
          for (const h of historyResults.docs) {
            const key = `${h.documentId}::${h.collection}`
            if (!seen.has(key)) {
              seen.add(key)
              continue
            }
            if (!previousScoreMap.has(key)) {
              previousScoreMap.set(key, h.score as number)
            }
          }
        } catch {
          // seo-score-history might not exist
        }

        // Enrich results with previous score for trend display
        const enrichedResults = allResults.map((r) => ({
          ...r,
          previousScore: previousScoreMap.get(`${r.id}::${r.collection}`) ?? null,
        }))

        // Sort worst scores first
        enrichedResults.sort((a, b) => a.score - b.score)

        const totalDocs = enrichedResults.length
        const stats: AuditStats = {
          totalPages: totalDocs,
          avgScore:
            totalDocs > 0
              ? Math.round(enrichedResults.reduce((s, r) => s + r.score, 0) / totalDocs)
              : 0,
          good: enrichedResults.filter((r) => r.score >= 80).length,
          needsWork: enrichedResults.filter((r) => r.score >= 50 && r.score < 80).length,
          critical: enrichedResults.filter((r) => r.score < 50).length,
          noKeyword: enrichedResults.filter((r) => !r.focusKeyword).length,
          noMetaTitle: enrichedResults.filter((r) => !r.metaTitle).length,
          noMetaDesc: enrichedResults.filter((r) => !r.metaDescription).length,
          avgWordCount:
            totalDocs > 0
              ? Math.round(enrichedResults.reduce((s, r) => s + r.wordCount, 0) / totalDocs)
              : 0,
          avgReadability:
            totalDocs > 0
              ? Math.round(enrichedResults.reduce((s, r) => s + r.readabilityScore, 0) / totalDocs)
              : 0,
        }

        cached = { enrichedResults, stats }
        seoCache.set(CACHE_KEY, cached)
      }

      const { enrichedResults, stats } = cached
      const totalDocs = enrichedResults.length
      const totalPages = Math.ceil(totalDocs / limit)
      const startIdx = (page - 1) * limit
      const paginatedResults = enrichedResults.slice(startIdx, startIdx + limit)

      return Response.json({
        results: paginatedResults,
        stats,
        pagination: {
          page,
          limit,
          totalDocs,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        cached: !noCache && seoCache.get(CACHE_KEY) !== null,
      }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('[seo-plugin/audit] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
