/**
 * SEO Audit endpoint handler.
 * Returns enriched SEO data for all pages and posts — powers the dashboard.
 * Uses the real analyzeSeo() engine for consistent scoring (sidebar ↔ dashboard).
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import { readFile, writeFile } from 'node:fs/promises'
import type { Payload, PayloadHandler } from 'payload'
import { analyzeSeo } from '../index.js'
import type { SeoConfig } from '../types.js'
import { buildSeoInputFromDoc } from './validate.js'
import {
  calculateFleschFR,
  countWords,
} from '../helpers.js'
import { seoCache } from '../cache.js'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'
import { extractDocContent } from '../helpers/extractDocContent.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeDoc(doc: any, collection: string, seoConfig?: SeoConfig) {
  // Build SeoInput and run the real engine
  let seoInput = buildSeoInputFromDoc(doc, collection)
  // Mark as global if collection starts with 'global:'
  seoInput.isGlobal = collection.startsWith('global:')
  if (seoInput.isGlobal) {
    seoInput.slug = ''
  }
  // Dashboard audit skips the weight-0, non-scoring groups (geo/eeat/hreflang): they do
  // recursive Lexical walks per block and only matter for single-doc analysis (sidebar).
  // Disabling them here keeps SEO scores identical while cutting per-doc CPU/memory on the
  // site-wide audit (low-memory hosts).
  const analysis = analyzeSeo(seoInput, {
    ...seoConfig,
    disabledRules: [...(seoConfig?.disabledRules ?? []), 'geo', 'eeat', 'hreflang'],
  })

  // Extract enriched data for the dashboard using the shared helper
  // (single extraction pass instead of duplicating logic from analyzeSeo's buildContext)
  const extracted = extractDocContent(doc)
  const fullText = extracted.text
  const allLinks = extracted.links
  const allHeadings = extracted.headings

  const wordCount = countWords(fullText)
  // Use the block-aware text so list items / paragraphs are counted as separate
  // sentences (otherwise scannable, list-heavy content is wrongly scored unreadable).
  const readabilityScore = wordCount > 30 ? calculateFleschFR(extracted.readabilityText || fullText) : 0

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
    aiReadiness: analysis.aiReadiness ? analysis.aiReadiness.score : null,
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

const CACHE_KEY = 'audit'

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

type EnrichedResult = ReturnType<typeof analyzeDoc> & { previousScore: number | null }
type CachedAudit = { enrichedResults: EnrichedResult[]; stats: AuditStats; capped: boolean }

/**
 * Single-flight guard. The site-wide audit is the heaviest operation in the plugin
 * (it runs analyzeSeo on every page/post). Without this guard, a slow first load on a
 * low-memory host (e.g. Infomaniak) lets the admin reload the page, firing 2-3 FULL
 * builds concurrently — multiplying peak memory until the process is OOM-killed and
 * restarts into an EADDRINUSE loop. With the guard, only ONE build ever runs at a time;
 * concurrent requests get a 202 "building" and the UI polls until the cache is ready.
 * Keyed by locale so a multi-locale site builds (and serves) one audit per locale.
 */
const auditBuildsInFlight = new Set<string>()

/**
 * Build the full site-wide audit cache. Intended to run in the BACKGROUND (not awaited by
 * the HTTP handler) so the request returns immediately and the heavy work is decoupled from
 * the request lifecycle (no timeouts, no holding a large JSON response while building).
 */
async function buildAuditCache(
  payload: Payload,
  collections: string[],
  globals: string[],
  seoConfig?: SeoConfig,
  reqLocale?: string,
): Promise<CachedAudit> {
  // Load merged config from DB settings + plugin config (locale-aware so the audit scores
  // each locale with its own language rules)
  const { config: mergedConfig, ignoredSlugs } = await loadMergedConfig(payload, seoConfig, { reqLocale })

  // Tiered + THROTTLED build to stay light on constrained shared hosting (e.g. Infomaniak).
  // Process SMALL batches and PAUSE between each (real delay, not just setImmediate): this caps
  // CPU usage and gives V8 time to reclaim the previous batch before loading the next, so the
  // site stays responsive during the (background) build instead of being saturated for minutes.
  // All three knobs are env-tunable — lower batch / raise delay on the tiniest hosts.
  const BATCH_SIZE = Math.min(100, Math.max(1, parseInt(process.env.SEO_AUDIT_BATCH_SIZE || '10', 10) || 10))
  const MAX_DOCS = Math.max(1, parseInt(process.env.SEO_AUDIT_MAX_DOCS || '1500', 10) || 1500)
  const BATCH_DELAY_MS = Math.min(5000, Math.max(0, parseInt(process.env.SEO_AUDIT_BATCH_DELAY_MS || '100', 10) || 0))
  // Per-document throttle: a REAL pause (not just setImmediate) after each doc gives the event
  // loop idle time so the site stays responsive while the (background) build runs. Trades a
  // longer build for a much gentler CPU profile. Default 10ms; set 0 for the fastest build,
  // raise it (e.g. 25–50) on rich-content / constrained sites.
  const DOC_DELAY_MS = Math.min(1000, Math.max(0, parseInt(process.env.SEO_AUDIT_DOC_DELAY_MS || '10', 10) || 0))
  // The dominant cost is analyzeDoc() — synchronous and un-interruptible (one rich doc can block
  // the single Node event loop for 100-300ms). After each doc we pause for ~THROTTLE_RATIO × the
  // time it just took, so the event loop stays free ≈ ratio/(1+ratio) of the time and the admin/
  // site remains responsive regardless of content size. DOC_DELAY_MS is the floor; capped per doc.
  const THROTTLE_RATIO = Math.min(10, Math.max(0, parseFloat(process.env.SEO_AUDIT_THROTTLE_RATIO || '2') || 0))
  const MAX_DOC_PAUSE_MS = 750
  // depth:1 populates uploads/relations (heavier). Default 1 keeps scores identical to the
  // sidebar; set SEO_AUDIT_DEPTH=0 on the tiniest hosts to cut memory/CPU (image-dimension
  // sub-checks then see IDs instead of populated media — a minor, acceptable score difference).
  // Default depth 0 — the dashboard audit is a coarse overview; populating relations (media) for
  // every doc is the heaviest part on constrained hosts. depth:0 cuts CPU+memory a lot. Set
  // SEO_AUDIT_DEPTH=1 to restore exact parity with the sidebar on image-dimension sub-checks.
  const rawDepth = parseInt(process.env.SEO_AUDIT_DEPTH ?? '0', 10)
  const DEPTH = Number.isNaN(rawDepth) ? 0 : Math.min(2, Math.max(0, rawDepth))

  const allResults: ReturnType<typeof analyzeDoc>[] = []
  let capped = false

  collectionsLoop:
  for (const collectionSlug of collections) {
    try {
      let page = 1
      let hasMore = true
      while (hasMore) {
        const result = await payload.find({
          collection: collectionSlug,
          limit: BATCH_SIZE,
          page,
          depth: DEPTH,
          overrideAccess: true,
        })
        for (const doc of result.docs) {
          if (ignoredSlugs.includes(doc.slug as string)) continue
          // Skip drafts — the site-wide audit scores PUBLISHED content (collections without a
          // draft system have no _status, so they pass through unchanged).
          if ((doc as { _status?: string })._status === 'draft') continue
          if (allResults.length >= MAX_DOCS) {
            capped = true
            break collectionsLoop
          }
          const t0 = Date.now()
          try {
            allResults.push(analyzeDoc(doc, collectionSlug, mergedConfig))
          } catch (e) {
            payload.logger.warn(
              `[seo] audit: skipped ${collectionSlug}/${(doc as { id?: unknown }).id}: ${e instanceof Error ? e.message : 'error'}`,
            )
          }
          // ADAPTIVE cooperative throttle. analyzeDoc() is synchronous and un-interruptible, so
          // while it runs the single Node process can't serve any other request. We pause for
          // ~THROTTLE_RATIO × the time this doc just took: the event loop then stays free roughly
          // ratio/(1+ratio) of the time, so the admin/site keeps responding even mid-build on heavy
          // docs. Floored at DOC_DELAY_MS and capped at MAX_DOC_PAUSE_MS so it never stalls forever.
          const elapsed = Date.now() - t0
          const pause = Math.min(MAX_DOC_PAUSE_MS, Math.max(DOC_DELAY_MS, Math.round(elapsed * THROTTLE_RATIO)))
          if (pause > 0) {
            await new Promise((resolve) => setTimeout(resolve, pause))
          } else {
            await new Promise((resolve) => setImmediate(resolve))
          }
        }
        hasMore = result.hasNextPage
        page++
        // Extra throttle between DB pages (env-tunable). With the per-doc yield above this is
        // usually optional, but raising it cools the CPU further on the tiniest hosts.
        if (BATCH_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    } catch {
      // Collection might not exist — skip silently
    }
  }

  if (capped) {
    payload.logger.warn(
      `[seo] audit: capped at ${MAX_DOCS} docs (SEO_AUDIT_MAX_DOCS). Lower SEO_AUDIT_BATCH_SIZE on low-memory hosts, or raise the cap.`,
    )
  }

  // Fetch from globals
  for (const globalSlug of globals) {
    try {
      const doc = await payload.findGlobal({
        slug: globalSlug,
        depth: 1,
        overrideAccess: true,
      })
      if (doc) {
        // Skip if in ignored slugs
        if (ignoredSlugs.includes(globalSlug)) continue
        const result = analyzeDoc(doc, `global:${globalSlug}`, mergedConfig)
        // Override some fields for globals
        allResults.push({
          ...result,
          id: globalSlug,
          collection: `global:${globalSlug}`,
          slug: '',
          title: (doc as any).title || globalSlug,
        })
      }
    } catch {
      // Global might not exist — skip
    }
  }

  // Fetch previous scores from history for trend indicator. Bounded to avoid loading an
  // unbounded history table into memory on sites with long score history.
  const previousScoreMap = new Map<string, number>()
  try {
    const historyResults = await payload.find({
      collection: 'seo-score-history',
      limit: Math.min(allResults.length * 2, 3000),
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
  const enrichedResults: EnrichedResult[] = allResults.map((r) => ({
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

  return { enrichedResults, stats, capped }
}

/** Kick off a background build if one isn't already running for this locale (single-flight). */
function ensureAuditBuild(
  payload: Payload,
  collections: string[],
  globals: string[],
  seoConfig: SeoConfig | undefined,
  cacheKey: string,
  reqLocale?: string,
): void {
  if (auditBuildsInFlight.has(cacheKey)) return
  auditBuildsInFlight.add(cacheKey)
  // Fire-and-forget: NOT awaited by the request handler. Infomaniak (and any persistent
  // Node host) keeps this promise alive after the 202 response is sent.
  void buildAuditCache(payload, collections, globals, seoConfig, reqLocale)
    .then((result) => {
      seoCache.set(cacheKey, result)
    })
    .catch((e) => {
      payload.logger.error(`[seo] audit build failed: ${e instanceof Error ? e.message : 'unknown'}`)
    })
    .finally(() => {
      auditBuildsInFlight.delete(cacheKey)
    })
}

/** Shape of the build-time audit cache file (one CachedAudit per locale-scoped key). */
interface AuditCacheFile {
  version: number
  generatedAt: number
  byKey: Record<string, CachedAudit>
}

/**
 * Build the site-wide audit for each locale and write it to a JSON file. Meant to run at
 * BUILD/CI time (where memory is plentiful) so a memory-constrained production host can
 * hydrate the cache from the file instead of recomputing the heavy audit. Uses the exact
 * same engine as the live dashboard build → identical scores.
 *
 * Pass `locales: [undefined]` (default) for a single-locale site, or the list of locale
 * codes to pre-build one audit per locale.
 */
export async function buildAuditToFile(
  payload: Payload,
  opts: {
    collections: string[]
    globals?: string[]
    seoConfig?: SeoConfig
    locales?: (string | undefined)[]
    outFile: string
  },
): Promise<{ file: string; entries: number; docs: number }> {
  const locales = opts.locales && opts.locales.length ? opts.locales : [undefined]
  const byKey: Record<string, CachedAudit> = {}
  let docs = 0
  for (const loc of locales) {
    const key = loc ? `${CACHE_KEY}:${loc}` : CACHE_KEY
    const built = await buildAuditCache(payload, opts.collections, opts.globals ?? [], opts.seoConfig, loc)
    byKey[key] = built
    docs += built.enrichedResults.length
  }
  const fileData: AuditCacheFile = { version: 1, generatedAt: Date.now(), byKey }
  await writeFile(opts.outFile, JSON.stringify(fileData))
  return { file: opts.outFile, entries: Object.keys(byKey).length, docs }
}

/**
 * Hydrate the in-memory cache from a build-time JSON file. Cheap (a file read) compared to
 * the live site-wide build. Returns false (→ caller falls back to a live build) when the
 * file is missing, invalid, or STALE — i.e. generated before the last cache invalidation,
 * which means content changed since the build and the pre-computed scores can't be trusted.
 */
async function tryHydrateAuditFromFile(filePath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as AuditCacheFile
    const generatedAt = typeof parsed.generatedAt === 'number' ? parsed.generatedAt : 0
    if (!parsed.byKey || !generatedAt) return false
    if (generatedAt < seoCache.lastInvalidatedAt) return false // stale: content changed since build
    let hydrated = false
    for (const [key, val] of Object.entries(parsed.byKey)) {
      seoCache.set(key, val)
      hydrated = true
    }
    return hydrated
  } catch {
    return false // no file / invalid JSON → fall back to a live build
  }
}

export function createAuditHandler(
  collections: string[],
  seoConfig?: SeoConfig,
  globals: string[] = [],
  auditCacheFile?: string,
): PayloadHandler {
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

      // Scope the cache + single-flight by locale (multi-locale sites get one audit per locale).
      const reqLocale = typeof req.locale === 'string' && req.locale ? req.locale : undefined
      const cacheKey = reqLocale ? `${CACHE_KEY}:${reqLocale}` : CACHE_KEY

      // Manual refresh — drop the stale cache so the next poll waits for the fresh build.
      // (Skip if a build is already running: it will repopulate the cache shortly anyway.)
      if (noCache && !auditBuildsInFlight.has(cacheKey)) {
        seoCache.invalidateKey(cacheKey)
      }

      let cached = seoCache.get<CachedAudit>(cacheKey)
      // Peek mode: opening the dashboard must NOT auto-trigger the (heavy) build on a big/rich
      // site. With `noBuild=1` we return cached results if present, or "not built" otherwise —
      // the build starts only when the user explicitly requests it (a poll WITHOUT noBuild).
      const noBuild = url.searchParams.get('noBuild') === '1'

      // Build-time file cache: on a miss, hydrating from the pre-computed JSON is cheap (a file
      // read) vs the heavy live build. Done BEFORE the build decision so even a peek (noBuild)
      // serves pre-computed scores with zero rebuild on memory-constrained hosts. The freshness
      // guard inside tryHydrateAuditFromFile() falls back to a live build once content changes.
      // Runtime kill-switch: SEO_AUDIT_FILE_CACHE=0/false ignores the file (forces a live build).
      const fileCacheOff =
        process.env.SEO_AUDIT_FILE_CACHE === '0' || process.env.SEO_AUDIT_FILE_CACHE === 'false'
      if (!cached && auditCacheFile && !fileCacheOff && (await tryHydrateAuditFromFile(auditCacheFile))) {
        cached = seoCache.get<CachedAudit>(cacheKey)
      }

      if (!cached) {
        if (noBuild && !auditBuildsInFlight.has(cacheKey)) {
          return Response.json(
            { building: false, notBuilt: true, results: [], stats: null },
            { status: 200, headers: { 'Cache-Control': 'no-store' } },
          )
        }
        // Cache miss — never build synchronously on the request path (that's what OOM-killed
        // the process on low-memory hosts). Start a single-flight background build and tell
        // the client to poll. The 202 response is tiny and returns immediately.
        ensureAuditBuild(req.payload, collections, globals, seoConfig, cacheKey, reqLocale)
        return Response.json(
          { building: true, results: [], stats: null },
          { status: 202, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const { enrichedResults, stats, capped } = cached
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
        cached: true,
        capped,
      }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] audit error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
