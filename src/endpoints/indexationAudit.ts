/**
 * SEO Indexation Audit endpoint.
 *
 * Cross-page hygiene scan: surfaces every CMS-visible indexation problem in ONE place
 * — accidental `noindex` / `nofollow`, off-site or cross-page canonicals — so a mass
 * mistake (e.g. a deploy that flips pages to noindex) is immediately visible. This is
 * the single "crash-class" SEO anti-pattern that is actionable on-page.
 *
 * Reliability: reuses the SAME analyzeSeo() engine as the sidebar/dashboard, so the
 * indexation verdict is identical everywhere (no duplicated logic). It only reports
 * issues derivable from CMS data — sites that control indexation at the framework
 * level (e.g. Next.js metadata) report nothing, which is correct (no false positives).
 *
 * Read-only; requires an authenticated user.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application should
 * implement it via its own middleware.
 */
import type { PayloadHandler } from 'payload'
import { analyzeSeo } from '../index.js'
import type { SeoConfig, SeoCheck } from '../types.js'
import { buildSeoInputFromDoc } from './validate.js'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'

/** Technical-group check ids that represent an indexation/canonical hygiene problem. */
const INDEXATION_CHECK_IDS = new Set([
  'robots-noindex',
  'robots-nofollow',
  'canonical-cross',
  'canonical-external',
  'canonical-invalid',
  'canonical-missing',
])

interface IndexationIssue {
  id: string
  status: SeoCheck['status']
  message: string
}

interface IndexationEntry {
  collection: string
  id: string | number
  slug: string
  title: string
  noindex: boolean
  issues: IndexationIssue[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-page indexation hygiene — PURE, Payload-free, offline-testable.
//
// These functions operate on a flat list of normalized doc records (not Payload
// docs) so the cross-page logic can be unit-tested without a running CMS. They
// catch the "crash-class" indexation mistakes that are only visible across the
// whole site: mass `noindex`, canonical cannibalization (several pages pointing
// to the same canonical — e.g. everything inheriting the homepage canonical),
// dangling internal canonicals (pointing at a slug that no longer exists), and
// accidentally missing canonicals on collections that otherwise use them.
//
// Design bias: NO false positives. Detections that depend on knowing every URL
// (dangling, missing) are deliberately conservative — they only fire when the
// site clearly DOES manage that signal in the CMS (e.g. a collection where most
// docs have a canonical → a doc without one is an anomaly worth surfacing).
// ─────────────────────────────────────────────────────────────────────────────

/** Severity reuses the engine's vocabulary so the UI can render it identically. */
export type IndexationSeverity = SeoCheck['status'] // 'pass' | 'warning' | 'fail'

/** One normalized document, the unit the pure analyzers consume. */
export interface IndexationDocRecord {
  collection: string
  id: string | number
  slug: string
  title: string
  /** Canonical URL as authored (absolute or relative); empty/undefined if none. */
  canonicalUrl?: string
  /** Raw robots meta string (e.g. "noindex, nofollow"); empty/undefined if none. */
  robotsMeta?: string
  /** Pre-derived noindex flag. If omitted, derived from `robotsMeta`. */
  noindex?: boolean
  /** Pre-derived nofollow flag. If omitted, derived from `robotsMeta`. */
  nofollow?: boolean
}

/** Minimal doc reference embedded in the report (kept small for payload size). */
export interface IndexationDocRef {
  collection: string
  id: string | number
  slug: string
  title: string
  canonicalUrl?: string
}

export interface IndexationHygieneOptions {
  /** Site base URL — enables same-origin detection for absolute canonicals. */
  siteUrl?: string
  /** Proportion (0–1) of noindex docs above which it is treated as "mass". Default 0.3. */
  noindexMassThreshold?: number
  /** Minimum total docs before mass-noindex can escalate to `fail` (avoids tiny-site noise). Default 5. */
  minDocsForMassDetection?: number
  /** A duplicated-canonical group of this size (or more) escalates to `fail`. Default 5. */
  duplicateCanonicalFailSize?: number
}

export interface NoindexStats {
  severity: IndexationSeverity
  count: number
  total: number
  /** Proportion of total docs that are noindex (0–1). */
  pct: number
  /** True when the proportion crossed the mass threshold on a large-enough corpus. */
  massNoindex: boolean
  threshold: number
  docs: IndexationDocRef[]
}

export interface DuplicatedCanonicalGroup {
  /** The shared canonical (normalized key shown back to the user). */
  canonical: string
  count: number
  docs: IndexationDocRef[]
}

export interface DuplicatedCanonicalStats {
  severity: IndexationSeverity
  groups: DuplicatedCanonicalGroup[]
  /** Total number of docs involved in any duplicate group. */
  docCount: number
}

export interface MissingCanonicalStats {
  severity: IndexationSeverity
  count: number
  docs: IndexationDocRef[]
  /** Per-collection canonical coverage, for context (only collections that use canonicals). */
  byCollection: Array<{ collection: string; total: number; withCanonical: number; missing: number }>
}

export interface DanglingCanonicalStats {
  severity: IndexationSeverity
  count: number
  docs: IndexationDocRef[]
}

export interface IndexationHygieneReport {
  totalDocs: number
  overallSeverity: IndexationSeverity
  noindex: NoindexStats
  canonical: {
    duplicated: DuplicatedCanonicalStats
    missing: MissingCanonicalStats
    dangling: DanglingCanonicalStats
  }
  counters: {
    totalDocs: number
    noindexCount: number
    duplicatedCanonicalGroups: number
    duplicatedCanonicalDocs: number
    missingCanonicalCount: number
    danglingCanonicalCount: number
  }
}

function toRef(r: IndexationDocRecord, withCanonical = false): IndexationDocRef {
  const ref: IndexationDocRef = {
    collection: r.collection,
    id: r.id,
    slug: r.slug,
    title: r.title,
  }
  if (withCanonical && r.canonicalUrl) ref.canonicalUrl = r.canonicalUrl
  return ref
}

/** Whether a record is noindex (explicit flag wins, else parse robotsMeta). */
export function isNoindexRecord(r: IndexationDocRecord): boolean {
  if (typeof r.noindex === 'boolean') return r.noindex
  return (r.robotsMeta || '').toLowerCase().includes('noindex')
}

/** Normalize a URL into a stable comparison key (lowercased, no fragment, no trailing slash). */
export function normalizeUrlKey(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s) return null
  const hash = s.indexOf('#')
  if (hash !== -1) s = s.slice(0, hash)
  s = s.replace(/\/+$/, '') // drop trailing slash(es); root collapses to ''
  s = s.toLowerCase()
  return s || null
}

/** Last non-empty path segment of a slug or URL path, lowercased (or null for root/unparseable). */
export function lastSegment(value?: string): string | null {
  if (!value) return null
  let path = String(value)
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname
    } catch {
      return null
    }
  }
  path = path.split('?')[0].split('#')[0]
  const segs = path.split('/').filter(Boolean)
  if (segs.length === 0) return null
  return segs[segs.length - 1].toLowerCase()
}

/** Is this canonical internal (relative, or same-origin as siteUrl)? Conservative when siteUrl absent. */
export function isInternalCanonical(raw: string, siteUrl?: string): boolean {
  if (!raw) return false
  if (!/^https?:\/\//i.test(raw)) return true // relative → internal
  if (!siteUrl) return false // absolute but no reference origin → treat as external/unknown
  try {
    return new URL(raw).host.toLowerCase() === new URL(siteUrl).host.toLowerCase()
  } catch {
    return false
  }
}

/** Mass-noindex detection. Warning for any noindex, fail when the proportion is abnormal. */
export function computeNoindexStats(
  records: IndexationDocRecord[],
  opts: { threshold?: number; minDocs?: number } = {},
): NoindexStats {
  const threshold = opts.threshold ?? 0.3
  const minDocs = opts.minDocs ?? 5
  const total = records.length
  const noindexDocs = records.filter(isNoindexRecord)
  const count = noindexDocs.length
  const pct = total > 0 ? count / total : 0
  let severity: IndexationSeverity = 'pass'
  let massNoindex = false
  if (count > 0) {
    if (pct > threshold && total >= minDocs) {
      severity = 'fail'
      massNoindex = true
    } else {
      severity = 'warning'
    }
  }
  return { severity, count, total, pct, massNoindex, threshold, docs: noindexDocs.map((r) => toRef(r)) }
}

/**
 * Canonical cannibalization: several indexable docs sharing the same canonical.
 * Noindex docs are excluded (already de-indexed — not competing). This is the
 * top real-world failure (e.g. every page inheriting the homepage canonical).
 */
export function findDuplicatedCanonicals(
  records: IndexationDocRecord[],
  opts: { failSize?: number } = {},
): DuplicatedCanonicalStats {
  const failSize = opts.failSize ?? 5
  const map = new Map<string, IndexationDocRecord[]>()
  for (const r of records) {
    if (isNoindexRecord(r)) continue
    const key = normalizeUrlKey(r.canonicalUrl)
    if (!key) continue
    const arr = map.get(key)
    if (arr) arr.push(r)
    else map.set(key, [r])
  }
  const groups: DuplicatedCanonicalGroup[] = []
  let docCount = 0
  for (const [canonical, docs] of map) {
    if (docs.length > 1) {
      groups.push({ canonical, count: docs.length, docs: docs.map((r) => toRef(r, true)) })
      docCount += docs.length
    }
  }
  // Largest groups first — most cannibalized canonical is the priority to fix.
  groups.sort((a, b) => b.count - a.count)
  let severity: IndexationSeverity = 'pass'
  if (groups.length > 0) {
    severity = groups.some((g) => g.count >= failSize) ? 'fail' : 'warning'
  }
  return { severity, groups, docCount }
}

/**
 * Missing canonical on collections that otherwise use them. Conservative: a
 * collection where coverage is 0 means the site manages canonicals elsewhere
 * (e.g. Next.js metadata) → not flagged. Only a partial coverage (some docs
 * have one, some don't) is an anomaly worth surfacing. Noindex docs excluded.
 */
export function findMissingCanonicals(records: IndexationDocRecord[]): MissingCanonicalStats {
  const byCol = new Map<string, IndexationDocRecord[]>()
  for (const r of records) {
    if (isNoindexRecord(r)) continue // noindex docs don't need a canonical
    const arr = byCol.get(r.collection)
    if (arr) arr.push(r)
    else byCol.set(r.collection, [r])
  }
  const missing: IndexationDocRecord[] = []
  const byCollection: MissingCanonicalStats['byCollection'] = []
  for (const [collection, docs] of byCol) {
    const withCanonical = docs.filter((r) => !!normalizeUrlKey(r.canonicalUrl)).length
    const total = docs.length
    // Only flag when the collection clearly USES canonicals but not everywhere.
    if (withCanonical > 0 && withCanonical < total) {
      const missingDocs = docs.filter((r) => !normalizeUrlKey(r.canonicalUrl))
      missing.push(...missingDocs)
      byCollection.push({ collection, total, withCanonical, missing: missingDocs.length })
    }
  }
  return {
    severity: missing.length > 0 ? 'warning' : 'pass',
    count: missing.length,
    docs: missing.map((r) => toRef(r)),
    byCollection,
  }
}

/**
 * Dangling internal canonical: points at an internal slug that no analyzed doc
 * owns. A broken canonical silently drops a page from the index. Conservative:
 * only internal canonicals (relative, or same-origin as siteUrl) are checked,
 * self-canonicals are ignored, and the homepage (root) is never flagged.
 * Severity stays `warning` because the target may legitimately live outside the
 * analyzed collections — it's a "verify this" signal, not a hard failure.
 */
export function findDanglingCanonicals(
  records: IndexationDocRecord[],
  opts: { siteUrl?: string } = {},
): DanglingCanonicalStats {
  const knownSlugs = new Set<string>()
  for (const r of records) {
    const s = lastSegment(r.slug)
    if (s) knownSlugs.add(s)
  }
  const dangling: IndexationDocRecord[] = []
  for (const r of records) {
    if (isNoindexRecord(r)) continue
    const canonical = r.canonicalUrl
    if (!canonical || !canonical.trim()) continue
    if (!isInternalCanonical(canonical, opts.siteUrl)) continue
    const targetSlug = lastSegment(canonical)
    if (!targetSlug) continue // root/homepage → never flag
    if (targetSlug === lastSegment(r.slug)) continue // self-canonical → fine
    if (!knownSlugs.has(targetSlug)) dangling.push(r)
  }
  return {
    severity: dangling.length > 0 ? 'warning' : 'pass',
    count: dangling.length,
    docs: dangling.map((r) => toRef(r, true)),
  }
}

/** Compose the per-category analyzers into a single structured hygiene report. */
export function analyzeIndexationHygiene(
  records: IndexationDocRecord[],
  options: IndexationHygieneOptions = {},
): IndexationHygieneReport {
  const total = records.length
  const noindex = computeNoindexStats(records, {
    threshold: options.noindexMassThreshold,
    minDocs: options.minDocsForMassDetection,
  })
  const duplicated = findDuplicatedCanonicals(records, { failSize: options.duplicateCanonicalFailSize })
  const missing = findMissingCanonicals(records)
  const dangling = findDanglingCanonicals(records, { siteUrl: options.siteUrl })

  const severities = [noindex.severity, duplicated.severity, missing.severity, dangling.severity]
  const overallSeverity: IndexationSeverity = severities.includes('fail')
    ? 'fail'
    : severities.includes('warning')
      ? 'warning'
      : 'pass'

  return {
    totalDocs: total,
    overallSeverity,
    noindex,
    canonical: { duplicated, missing, dangling },
    counters: {
      totalDocs: total,
      noindexCount: noindex.count,
      duplicatedCanonicalGroups: duplicated.groups.length,
      duplicatedCanonicalDocs: duplicated.docCount,
      missingCanonicalCount: missing.count,
      danglingCanonicalCount: dangling.count,
    },
  }
}

export function createIndexationAuditHandler(
  collections: string[],
  seoConfig?: SeoConfig,
  globals: string[] = [],
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { config: mergedConfig, ignoredSlugs } = await loadMergedConfig(req.payload, seoConfig)

      const entries: IndexationEntry[] = []
      // Every inspected doc (not just flagged ones) — fuels the cross-page hygiene pass.
      const allRecords: IndexationDocRecord[] = []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inspect = (doc: any, collection: string, isGlobal = false): void => {
        const input = buildSeoInputFromDoc(doc, collection, { isGlobal })
        const analysis = analyzeSeo(input, mergedConfig)
        const issues: IndexationIssue[] = analysis.checks
          .filter(
            (c) => c.group === 'technical' && INDEXATION_CHECK_IDS.has(c.id) && c.status !== 'pass',
          )
          .map((c) => ({ id: c.id, status: c.status, message: c.message }))
        const robotsMeta = input.robotsMeta || ''
        const noindex = robotsMeta.toLowerCase().includes('noindex')
        const id = doc.id ?? (isGlobal ? collection : '')
        const slug = (doc.slug as string) || ''
        const title = (doc.title as string) || slug || String(doc.id ?? collection)

        allRecords.push({
          collection,
          id,
          slug,
          title,
          canonicalUrl: input.canonicalUrl,
          robotsMeta: input.robotsMeta,
          noindex,
          nofollow: robotsMeta.toLowerCase().includes('nofollow'),
        })

        if (issues.length > 0 || noindex) {
          entries.push({ collection, id, slug, title, noindex, issues })
        }
      }

      // Yield to the event loop periodically so a large corpus never blocks the
      // server (analyzeSeo runs 50+ checks per doc). Mirrors the audit endpoint.
      let processed = 0
      const maybeYield = async (): Promise<void> => {
        if (++processed % 50 === 0) await new Promise((resolve) => setImmediate(resolve))
      }

      for (const collectionSlug of collections) {
        try {
          let page = 1
          let hasMore = true
          while (hasMore) {
            const result = await req.payload.find({
              collection: collectionSlug,
              limit: 100,
              page,
              depth: 1,
              overrideAccess: true,
            })
            for (const doc of result.docs) {
              if (ignoredSlugs.includes(doc.slug as string)) continue
              inspect(doc, collectionSlug)
              await maybeYield()
            }
            hasMore = result.hasNextPage
            page++
          }
        } catch {
          // Collection might not exist — skip silently.
        }
      }

      for (const globalSlug of globals) {
        try {
          const doc = await req.payload.findGlobal({
            slug: globalSlug,
            depth: 1,
            overrideAccess: true,
          })
          if (doc) inspect(doc, `global:${globalSlug}`, true)
        } catch {
          // Global might not exist — skip silently.
        }
      }

      const noindexCount = entries.filter((e) => e.noindex).length
      const canonicalIssueCount = entries.filter((e) =>
        e.issues.some((i) => i.id.startsWith('canonical')),
      ).length

      // Cross-page hygiene: mass noindex, canonical cannibalization / dangling / missing.
      const hygiene = analyzeIndexationHygiene(allRecords, { siteUrl: mergedConfig.siteUrl })

      return Response.json(
        {
          entries,
          summary: {
            totalFlagged: entries.length,
            noindexCount,
            canonicalIssueCount,
            // Additive (backwards-compatible) fields:
            totalDocs: allRecords.length,
            overallSeverity: hygiene.overallSeverity,
          },
          hygiene,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] indexation-audit error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
