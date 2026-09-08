/**
 * Retention for the four time-series collections the plugin only ever appends to.
 *
 * `seo-rank-history` gains a row per tracked query per day, `seo-score-history` one
 * per document per save, `seo-performance` one per imported Search Console row and
 * `seo-logs` one per distinct 404 URL. Nothing ever deleted them, so on a busy site
 * they grow without bound — an operational problem (database size, slower dashboard
 * queries), not a privacy one: the only visitor-derived data is the `referrer` and
 * `userAgent` on `seo-logs`, and no IP address is stored anywhere.
 *
 * OPT-IN. With no `retentionDays` option nothing is ever deleted, which is the
 * behaviour every existing install already has.
 *
 * Three of these four collections declare `timestamps: false`, so they have no
 * `createdAt` column: each purge is driven by the collection's own date field.
 */
import type { Payload } from 'payload'

export interface RetentionTarget {
  /** Collection slug. */
  slug: string
  /**
   * Date field the purge compares against. NOT `createdAt`: seo-rank-history,
   * seo-score-history and seo-performance are declared `timestamps: false`.
   */
  dateField: string
}

export const RETENTION_TARGETS: readonly RetentionTarget[] = [
  { slug: 'seo-rank-history', dateField: 'snapshotDate' },
  { slug: 'seo-score-history', dateField: 'snapshotDate' },
  { slug: 'seo-performance', dateField: 'date' },
  // `lastSeen`, not `createdAt`: a 404 first seen a year ago but still being hit
  // today is live data, and purging it by creation date would hide an active
  // broken link.
  { slug: 'seo-logs', dateField: 'lastSeen' },
] as const

export type RetentionCollection =
  | 'seo-rank-history'
  | 'seo-score-history'
  | 'seo-performance'
  | 'seo-logs'

/** Days to keep, per collection. Omitted or invalid entries are never purged. */
export type RetentionConfig = Partial<Record<RetentionCollection, number>>

export interface ResolvedRetention extends RetentionTarget {
  days: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Turn the user-supplied option into the list of purges to run.
 *
 * Deliberately strict: a value that is not a finite number of at least one day is
 * DROPPED, not clamped. `0`, `-1`, `NaN` and `'30'` would each mean "delete
 * everything" under a naive clamp, and this function deletes data.
 */
export function resolveRetention(input: RetentionConfig | undefined): ResolvedRetention[] {
  if (!input || typeof input !== 'object') return []
  const resolved: ResolvedRetention[] = []
  for (const target of RETENTION_TARGETS) {
    const raw = (input as Record<string, unknown>)[target.slug]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) continue
    resolved.push({ ...target, days: Math.floor(raw) })
  }
  return resolved
}

export interface PurgeCollectionResult {
  collection: string
  /** Rows deleted. `0` when the collection is absent or the delete failed. */
  deleted: number
  /** Everything strictly older than this was removed. */
  cutoff: string
  /** Present only when nothing was deleted for a reason worth reporting. */
  skipped?: 'not_registered'
  error?: string
}

export interface PurgeResult {
  ran: boolean
  results: PurgeCollectionResult[]
  totalDeleted: number
}

/**
 * Delete every row older than its collection's retention window.
 *
 * Sequential on purpose: the plugin's reference host runs SQLite, where parallel
 * writes produce `SQLITE_BUSY`. One failing collection is reported and the others
 * still run.
 */
export async function purgeRetention(
  payload: Payload,
  input: RetentionConfig | undefined,
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<PurgeResult> {
  const targets = resolveRetention(input)
  if (targets.length === 0) return { ran: false, results: [], totalDeleted: 0 }

  const now = options.now ?? new Date()
  const results: PurgeCollectionResult[] = []

  for (const target of targets) {
    const cutoff = new Date(now.getTime() - target.days * DAY_MS).toISOString()

    // A feature flag may have kept the collection out of the config entirely.
    const registered = (payload as unknown as { collections?: Record<string, unknown> }).collections
    if (registered && !registered[target.slug]) {
      results.push({ collection: target.slug, deleted: 0, cutoff, skipped: 'not_registered' })
      continue
    }

    try {
      const deleted = await payload.delete({
        collection: target.slug as never,
        where: { [target.dateField]: { less_than: cutoff } },
        // The purge is a maintenance job, not a user action: it must not be
        // filtered by whichever session happens to trigger it.
        overrideAccess: true,
        depth: 0,
      })
      const docs = (deleted as { docs?: unknown[] } | undefined)?.docs
      results.push({
        collection: target.slug,
        deleted: Array.isArray(docs) ? docs.length : 0,
        cutoff,
      })
    } catch (error) {
      results.push({
        collection: target.slug,
        deleted: 0,
        cutoff,
        error: error instanceof Error ? error.message : 'unknown error',
      })
    }
  }

  return {
    ran: true,
    results,
    totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
  }
}

/** Preview what a purge would remove, without deleting anything. */
export function describeRetention(input: RetentionConfig | undefined, now: Date = new Date()) {
  return resolveRetention(input).map((target) => ({
    collection: target.slug,
    dateField: target.dateField,
    days: target.days,
    cutoff: new Date(now.getTime() - target.days * DAY_MS).toISOString(),
  }))
}
