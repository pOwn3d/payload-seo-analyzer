/**
 * Content grade (SEO 2026) — GSC-driven "Surfer / Clearscope-lite", WITHOUT a paid SERP API.
 *
 *   GET /content-grade?collection=…&id=…&locale=…  → an A–F "content grade" for ONE document,
 *   computed offline & deterministically from the REAL Search Console queries the page already
 *   receives impressions for. No third-party keyword API, no scraping — only the site's own GSC
 *   data, which it owns. This is the competitive lever against Surfer/Clearscope: instead of
 *   guessing a keyword universe, we grade the page against the demand Google already shows it for.
 *
 * What it measures (three deterministic components, blended into a 0–100 score + letter):
 *   1. Coverage  — for the queries that bring impressions, do the page's terms actually appear?
 *                  Missing terms on high-impression queries become "coverage gaps" (sections to add).
 *   2. CTR       — does the page earn the clicks its SERP positions should yield (position-curve)?
 *                  Under-performing queries become "CTR gaps" (meta title/description to rewrite).
 *   3. Position  — impression-weighted average SERP position (the closer to the top, the better).
 *
 * Sweet spot highlighted: high-impression queries at position 4–15 — close to the top, the highest
 * upside from enriching content / internal linking.
 *
 * Requires a connected Google Search Console account (`features.gscApi`). Admin only. When GSC is
 * not configured / not connected, returns HTTP 200 with `gscConnected:false` and a clean message
 * (never a raw 404/500), so the dashboard panel degrades gracefully.
 *
 * The grading logic is extracted into PURE, side-effect-free functions (`gradeContentCoverage`,
 * `computeQueryCoverage`, `weightedAveragePosition`, `matchPageRows`) so it can be unit-tested
 * without Payload or GSC.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import {
  getGscOAuthConfig,
  getOrCreateGscAuthDoc,
  getGscAccessToken,
  queryGscSearchAnalytics,
  isGscAdmin,
  type GscRow,
} from '../helpers/gscClient.js'
import { expectedCtrForPosition } from './ctrOpportunities.js'
import { extractDocContent } from '../helpers/extractDocContent.js'
import { normalizeForComparison, countWords } from '../helpers.js'
import { getStopWords } from '../constants.js'

// ---------------------------------------------------------------------------
// Tunable thresholds — internal weighting of a COMPOSITE indicator, not external
// "facts" or traffic multipliers. Documented so consumers understand the blend.
// ---------------------------------------------------------------------------

/** Letter-grade cutoffs on the 0–100 composite score. */
const GRADE_A = 85
const GRADE_B = 70
const GRADE_C = 55
const GRADE_D = 40

/** "Near the top" SERP band — highest upside (close to page 1 top results). */
const NEAR_TOP_MIN = 4
const NEAR_TOP_MAX = 15

/** Composite blend weights (sum = 1). Coverage leads — it is the content differentiator. */
const W_COVERAGE = 0.5
const W_CTR = 0.3
const W_POSITION = 0.2

/** Only consider queries ranking on the first ~2 pages for the CTR-gap signal. */
const CTR_MAX_POSITION = 20

/** A query term must be at least this long to count (drops noise like "a", "de"). */
const MIN_TERM_LENGTH = 3

// ---------------------------------------------------------------------------
// Types (kept local to the endpoint, mirroring CtrOpportunity / ContentBrief).
// ---------------------------------------------------------------------------

/** A single Search Console query row already resolved to ONE page. */
export interface GscQueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface QueryCoverage {
  /** Significant (non-stopword, length ≥ MIN_TERM_LENGTH) terms of the query. */
  terms: string[]
  presentTerms: string[]
  missingTerms: string[]
  /** Fraction 0..1 of significant terms present in the content (1 when the query has none). */
  coverage: number
}

export interface CoverageGap {
  query: string
  impressions: number
  position: number
  coverage: number
  missingTerms: string[]
  /** Query is in the high-upside position band (NEAR_TOP_MIN..NEAR_TOP_MAX). */
  nearTop: boolean
}

export interface ContentCtrGap {
  query: string
  impressions: number
  clicks: number
  ctr: number
  expectedCtr: number
  position: number
  /** Estimated extra monthly clicks if CTR reached the position curve (≥ 1). */
  potentialClicks: number
}

export type ContentGradeLetter = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ContentGradeResult {
  grade: ContentGradeLetter
  /** Composite 0–100 score. */
  score: number
  /** Per-component sub-scores (0–100) for transparency in the UI. */
  components: { coverage: number; ctr: number; position: number }
  /** Impression-weighted average SERP position (0 when no impressions). */
  weightedPosition: number
  totalImpressions: number
  totalClicks: number
  /** Number of distinct queries used. */
  queryCount: number
  coverageGaps: CoverageGap[]
  ctrGaps: ContentCtrGap[]
  recommendations: string[]
}

export interface GradeContentOptions {
  locale?: 'fr' | 'en'
  /** Floor below which a query is treated as noise for gap detection (default 10). */
  minImpressions?: number
  /** Coverage below which a query is flagged as a coverage gap (default 0.6). */
  coverageThreshold?: number
  /** Cap on the number of gaps returned per list (default 15). */
  maxGaps?: number
  /** Cap on the number of recommendations returned (default 8). */
  maxRecommendations?: number
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Extract the significant (non-stopword) terms of a string, normalized for comparison. */
function significantTerms(text: string, locale: 'fr' | 'en'): string[] {
  const stop = new Set(getStopWords(locale))
  const tokens = normalizeForComparison(text).match(/[a-z0-9]+/g) || []
  return tokens.filter((t) => t.length >= MIN_TERM_LENGTH && !stop.has(t))
}

/**
 * Coverage of ONE query by the (already normalized) page content. A term is "present" when it
 * appears as a substring of the content — same accent-insensitive, substring philosophy as the
 * analyzer's `keywordMatchesText`. Pure & exported for testing.
 */
export function computeQueryCoverage(
  query: string,
  normalizedContent: string,
  locale: 'fr' | 'en',
): QueryCoverage {
  const terms = significantTerms(query, locale)
  if (terms.length === 0) {
    return { terms: [], presentTerms: [], missingTerms: [], coverage: 1 }
  }
  const presentTerms: string[] = []
  const missingTerms: string[] = []
  for (const t of terms) {
    if (normalizedContent.includes(t)) presentTerms.push(t)
    else missingTerms.push(t)
  }
  return { terms, presentTerms, missingTerms, coverage: presentTerms.length / terms.length }
}

/** Impression-weighted average SERP position (rounded to .1). Pure & exported for testing. */
export function weightedAveragePosition(
  rows: Array<{ impressions: number; position: number }>,
): number {
  let imprSum = 0
  let weighted = 0
  for (const r of rows) {
    const impr = r.impressions || 0
    if (impr <= 0) continue
    imprSum += impr
    weighted += impr * (r.position || 0)
  }
  return imprSum > 0 ? Math.round((weighted / imprSum) * 10) / 10 : 0
}

function letterForScore(score: number): ContentGradeLetter {
  if (score >= GRADE_A) return 'A'
  if (score >= GRADE_B) return 'B'
  if (score >= GRADE_C) return 'C'
  if (score >= GRADE_D) return 'D'
  return 'F'
}

/** Gentle, monotonic map of avg position → 0–100 (pos 1 → 100, −5 pts per rank, floored at 0). */
function positionComponent(weightedPos: number): number {
  if (weightedPos <= 0) return 0
  return Math.max(0, Math.min(100, 100 - (weightedPos - 1) * 5))
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Accent-stripped, lowercased slug form for matching Payload slugs against GSC URL segments. */
function normSlug(s: string): string {
  return normalizeForComparison(decodeSafe(s))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function lastPathSegments(page: string): string[] {
  let pathname = page
  try {
    pathname = new URL(page).pathname
  } catch {
    // `page` may already be a path — use it as-is
  }
  return pathname.split('/').filter(Boolean)
}

/**
 * Resolve the GSC rows (dimensions ['page','query']) down to the query-level rows of ONE page.
 *
 * Matching strategy (mirrors the repo's slug-resolution convention in ctrOpportunities):
 *   - explicit `url` → exact page match (trailing-slash tolerant);
 *   - otherwise the page whose last path segment slug equals the document slug
 *     (accent-insensitive); home (slug 'home'/'index'/'') maps to the root path.
 * When several pages match (e.g. locale variants), the one with the most impressions wins so the
 * grade reflects the page that actually performs.
 *
 * Pure & exported for testing.
 */
export function matchPageRows(
  rows: GscRow[],
  opts: { slug?: string; explicitUrl?: string },
): { matchedUrl: string | null; queryRows: GscQueryRow[] } {
  const byPage = new Map<string, GscRow[]>()
  for (const r of rows) {
    const page = r.keys?.[0]
    if (!page) continue
    const list = byPage.get(page) || []
    list.push(r)
    byPage.set(page, list)
  }
  if (byPage.size === 0) return { matchedUrl: null, queryRows: [] }

  const stripTrailing = (u: string) => u.replace(/\/+$/, '') || '/'

  let candidates: string[]
  if (opts.explicitUrl) {
    const target = stripTrailing(opts.explicitUrl)
    candidates = [...byPage.keys()].filter((p) => stripTrailing(p) === target)
  } else {
    const wantSlug = normSlug(opts.slug || 'home')
    const isHome = wantSlug === 'home' || wantSlug === 'index' || wantSlug === ''
    candidates = [...byPage.keys()].filter((page) => {
      const segs = lastPathSegments(page)
      if (isHome) return segs.length === 0
      const last = segs[segs.length - 1]
      return !!last && normSlug(last) === wantSlug
    })
  }
  if (candidates.length === 0) return { matchedUrl: null, queryRows: [] }

  const imprOf = (page: string) =>
    (byPage.get(page) || []).reduce((s, r) => s + (r.impressions || 0), 0)
  const matchedUrl = candidates.sort((a, b) => imprOf(b) - imprOf(a))[0]!

  const queryRows: GscQueryRow[] = (byPage.get(matchedUrl) || [])
    .map((r) => ({
      query: r.keys?.[1] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }))
    .filter((r) => r.query)

  return { matchedUrl, queryRows }
}

/** Format a fraction (0..1) as a percentage string with one decimal. */
function pct(x: number): string {
  return `${Math.round(x * 1000) / 10}%`
}

function buildRecommendations(args: {
  locale: 'fr' | 'en'
  weightedPosition: number
  coverageGaps: CoverageGap[]
  ctrGaps: ContentCtrGap[]
}): string[] {
  const { locale, weightedPosition, coverageGaps, ctrGaps } = args
  const fr = locale !== 'en'
  const out: string[] = []

  for (const g of coverageGaps.slice(0, 4)) {
    const terms = g.missingTerms.slice(0, 6).join(', ')
    out.push(
      fr
        ? `Ajoutez une section couvrant « ${g.query} » (${g.impressions} impressions, position ${g.position})${terms ? ` — termes peu/pas présents : ${terms}` : ''}.`
        : `Add a section covering “${g.query}” (${g.impressions} impressions, position ${g.position})${terms ? ` — missing terms: ${terms}` : ''}.`,
    )
  }

  for (const c of ctrGaps.slice(0, 3)) {
    out.push(
      fr
        ? `Optimisez le titre / la méta description pour « ${c.query} » : CTR ${pct(c.ctr)} sous l'attendu (~${pct(c.expectedCtr)} en position ${c.position}), ~${c.potentialClicks} clics/mois potentiels.`
        : `Optimize the title / meta description for “${c.query}”: CTR ${pct(c.ctr)} below the ~${pct(c.expectedCtr)} expected at position ${c.position}, ~${c.potentialClicks} potential clicks/month.`,
    )
  }

  if (weightedPosition >= NEAR_TOP_MIN && weightedPosition <= NEAR_TOP_MAX) {
    out.push(
      fr
        ? `Vos requêtes se classent en moyenne en position ${weightedPosition} (proche du top) : enrichir le contenu et le maillage interne peut faire gagner des places.`
        : `Your queries rank around position ${weightedPosition} (near the top): enriching content and internal links can win positions.`,
    )
  }

  if (out.length === 0) {
    out.push(
      fr
        ? 'Bonne couverture des requêtes qui génèrent des impressions — continuez à rafraîchir le contenu et surveillez les nouvelles requêtes.'
        : 'Good coverage of the queries that drive impressions — keep refreshing the content and watch for new queries.',
    )
  }
  return out
}

/**
 * Grade a page's content against the real GSC queries it receives impressions for.
 * Deterministic, offline, no external calls. Pure & exported for testing.
 */
export function gradeContentCoverage(
  contentText: string,
  rows: GscQueryRow[],
  opts: GradeContentOptions = {},
): ContentGradeResult {
  const locale: 'fr' | 'en' = opts.locale === 'en' ? 'en' : 'fr'
  const minImpressions = opts.minImpressions ?? 10
  const coverageThreshold = opts.coverageThreshold ?? 0.6
  const maxGaps = opts.maxGaps ?? 15
  const maxRecommendations = opts.maxRecommendations ?? 8

  const normalizedContent = normalizeForComparison(contentText || '')
  const valid = rows.filter(
    (r) => r && typeof r.query === 'string' && r.query.length > 0 && (r.impressions || 0) > 0,
  )

  // No usable data → an honest zero result with a clear "not enough data" message.
  if (valid.length === 0) {
    return {
      grade: 'F',
      score: 0,
      components: { coverage: 0, ctr: 0, position: 0 },
      weightedPosition: 0,
      totalImpressions: 0,
      totalClicks: 0,
      queryCount: 0,
      coverageGaps: [],
      ctrGaps: [],
      recommendations: [
        locale === 'en'
          ? 'Not enough Search Console data yet for this page (no impressions over the period).'
          : "Pas encore assez de données Search Console pour cette page (aucune impression sur la période).",
      ],
    }
  }

  let totalImpressions = 0
  let totalClicks = 0
  let weightedCoverageNum = 0
  let expectedClicks = 0
  const coverageGaps: CoverageGap[] = []
  const ctrGaps: ContentCtrGap[] = []

  for (const r of valid) {
    const impressions = Math.round(r.impressions)
    const clicks = Math.round(r.clicks || 0)
    const position = r.position || 0
    totalImpressions += impressions
    totalClicks += clicks

    const cov = computeQueryCoverage(r.query, normalizedContent, locale)
    weightedCoverageNum += impressions * cov.coverage

    const expCtr = expectedCtrForPosition(position)
    expectedClicks += impressions * expCtr

    // Coverage gap: a meaningful query whose terms the page (partly) misses.
    if (cov.terms.length > 0 && cov.coverage < coverageThreshold && impressions >= minImpressions) {
      coverageGaps.push({
        query: r.query,
        impressions,
        position: Math.round(position * 10) / 10,
        coverage: Math.round(cov.coverage * 100) / 100,
        missingTerms: cov.missingTerms,
        nearTop: position >= NEAR_TOP_MIN && position <= NEAR_TOP_MAX,
      })
    }

    // CTR gap: page ranks (pos ≤ 20) but earns fewer clicks than the position curve predicts.
    if (position > 0 && position <= CTR_MAX_POSITION && impressions >= minImpressions) {
      const ctr = typeof r.ctr === 'number' && r.ctr > 0 ? r.ctr : impressions > 0 ? clicks / impressions : 0
      const gap = expCtr - ctr
      if (gap > 0) {
        const potentialClicks = Math.round(impressions * gap)
        if (potentialClicks >= 1) {
          ctrGaps.push({
            query: r.query,
            impressions,
            clicks,
            ctr: Math.round(ctr * 1000) / 1000,
            expectedCtr: Math.round(expCtr * 1000) / 1000,
            position: Math.round(position * 10) / 10,
            potentialClicks,
          })
        }
      }
    }
  }

  const weightedPosition = weightedAveragePosition(valid)
  const coverageComponent = totalImpressions > 0 ? (weightedCoverageNum / totalImpressions) * 100 : 0
  const ctrComponent = expectedClicks > 0 ? Math.min(100, (totalClicks / expectedClicks) * 100) : 0
  const posComponent = positionComponent(weightedPosition)

  const score = Math.round(
    W_COVERAGE * coverageComponent + W_CTR * ctrComponent + W_POSITION * posComponent,
  )

  // Coverage gaps: high-upside (near-top) first, then by impressions.
  coverageGaps.sort(
    (a, b) => Number(b.nearTop) - Number(a.nearTop) || b.impressions - a.impressions,
  )
  ctrGaps.sort((a, b) => b.potentialClicks - a.potentialClicks)

  const trimmedCoverage = coverageGaps.slice(0, maxGaps)
  const trimmedCtr = ctrGaps.slice(0, maxGaps)

  return {
    grade: letterForScore(score),
    score,
    components: {
      coverage: Math.round(coverageComponent),
      ctr: Math.round(ctrComponent),
      position: Math.round(posComponent),
    },
    weightedPosition,
    totalImpressions,
    totalClicks,
    queryCount: valid.length,
    coverageGaps: trimmedCoverage,
    ctrGaps: trimmedCtr,
    recommendations: buildRecommendations({
      locale,
      weightedPosition,
      coverageGaps: trimmedCoverage,
      ctrGaps: trimmedCtr,
    }).slice(0, maxRecommendations),
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function createContentGradeHandler(
  basePath: string,
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    try {
      // GSC data is admin-sensitive — gate like the other Search Console endpoints.
      if (!isGscAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const url = new URL(req.url as string)
      const collection = url.searchParams.get('collection') || ''
      const id = url.searchParams.get('id') || ''
      const localeParam = url.searchParams.get('locale') || undefined
      const explicitUrl = url.searchParams.get('url') || undefined
      // dimensions ['page','query'] return one row per (page,query); we filter to this page
      // client-side, so request a generous (but GSC-capped) window. Configurable for big sites.
      const rowLimit = Math.min(
        25000,
        Math.max(100, parseInt(url.searchParams.get('rowLimit') || '5000', 10) || 5000),
      )

      const analysisLocale: 'fr' | 'en' =
        localeParam?.toLowerCase().startsWith('en') || seoConfig?.locale === 'en' ? 'en' : 'fr'

      if (!collection || !id) {
        return Response.json(
          { error: 'Missing required parameters: collection and id' },
          { status: 400 },
        )
      }
      // Allowlist guard (IDOR): only the plugin's configured collections can be read.
      if (!targetCollections.includes(collection)) {
        return Response.json({ error: 'Collection not allowed' }, { status: 403 })
      }

      // Load the document. depth:1 (NOT depth:0 — a known crasher on large posts) and matches
      // the analyzer's own extraction depth.
      let doc: Record<string, unknown>
      try {
        doc = (await req.payload.findByID({
          collection,
          id,
          depth: 1,
          overrideAccess: true,
          ...(localeParam ? { locale: localeParam } : {}),
        })) as Record<string, unknown>
      } catch {
        return Response.json({ error: 'Document not found' }, { status: 404 })
      }

      const extracted = extractDocContent(doc)
      const slug = typeof doc.slug === 'string' ? doc.slug : ''

      // --- GSC connection — clean 200 + gscConnected:false when unavailable (never raw 404/500) ---
      const cfg = getGscOAuthConfig(basePath, seoConfig)
      if (!cfg) {
        return Response.json(
          {
            gscConnected: false,
            configured: false,
            collection,
            id,
            slug,
            message:
              analysisLocale === 'en'
                ? 'Google Search Console is not configured on this site.'
                : "Google Search Console n'est pas configuré sur ce site.",
          },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const authDoc = await getOrCreateGscAuthDoc(req.payload)
      if (!authDoc.refreshTokenEnc) {
        return Response.json(
          {
            gscConnected: false,
            configured: true,
            collection,
            id,
            slug,
            message:
              analysisLocale === 'en'
                ? 'Connect Google Search Console to grade this page against real query data.'
                : 'Connectez Google Search Console pour noter cette page sur des données de requêtes réelles.',
          },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }

      let accessToken: string
      try {
        accessToken = await getGscAccessToken(req.payload, cfg, authDoc)
      } catch {
        // Token unusable (decrypt/refresh failed) → treat as "not connected" with a clean message.
        return Response.json(
          {
            gscConnected: false,
            configured: true,
            collection,
            id,
            slug,
            message:
              analysisLocale === 'en'
                ? 'Google Search Console token is no longer usable — please reconnect.'
                : "Le jeton Google Search Console n'est plus utilisable — veuillez reconnecter.",
          },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const property = (authDoc.propertyUrl as string) || cfg.siteUrl
      // GSC data lags ~2 days; use a 28-day window ending 2 days ago (same as ctr-opportunities).
      const end = new Date(Date.now() - 2 * 86_400_000)
      const start = new Date(end.getTime() - 27 * 86_400_000)
      const endDate = end.toISOString().slice(0, 10)
      const startDate = start.toISOString().slice(0, 10)

      let rows: GscRow[]
      try {
        rows = await queryGscSearchAnalytics(accessToken, property, {
          startDate,
          endDate,
          dimensions: ['page', 'query'],
          rowLimit,
        })
      } catch (e) {
        return Response.json(
          { error: e instanceof Error ? e.message : 'GSC query failed' },
          { status: 502 },
        )
      }

      const { matchedUrl, queryRows } = matchPageRows(rows, { slug, explicitUrl })
      const grade = gradeContentCoverage(extracted.text, queryRows, { locale: analysisLocale })

      return Response.json(
        {
          gscConnected: true,
          property,
          startDate,
          endDate,
          collection,
          id,
          slug,
          matchedUrl,
          wordCount: countWords(extracted.text),
          ...grade,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] content-grade error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
