/**
 * Rank tracking (SEO 2026) — stores daily GSC position snapshots and exposes movement.
 *
 *   POST /rank-snapshot  → take a snapshot now (admin) — also called by the daily job
 *   GET  /rank-history   → per-query latest position + previous + delta (admin)
 *
 * Requires a connected Google Search Console account (`features.gscApi`). Reuses the shared
 * GSC client (`helpers/gscClient.ts`) for token refresh + Search Analytics queries.
 *
 * NOTE: Rate limiting is not handled by this plugin.
 */
import type { Payload, PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import {
  getGscOAuthConfig,
  getOrCreateGscAuthDoc,
  getGscAccessToken,
  queryGscSearchAnalytics,
  isGscAdmin,
} from '../helpers/gscClient.js'

const RANK_COLLECTION = 'seo-rank-history'
const round1 = (n: number) => Math.round(n * 10) / 10

export interface RankSnapshotResult {
  ok: boolean
  reason?: string
  stored?: number
  scanned?: number
  startDate?: string
  endDate?: string
}

/**
 * Take a rank snapshot: query GSC for the top queries over a recent window and store one row
 * per query for today (idempotent — re-running the same day is a no-op). Shared by the HTTP
 * handler and the scheduled job.
 */
export async function runRankSnapshot(
  payload: Payload,
  basePath: string,
  seoConfig?: SeoConfig,
  opts?: { windowDays?: number; rowLimit?: number },
): Promise<RankSnapshotResult> {
  const cfg = getGscOAuthConfig(basePath, seoConfig)
  if (!cfg) return { ok: false, reason: 'not_configured' }

  const authDoc = await getOrCreateGscAuthDoc(payload)
  if (!authDoc.refreshTokenEnc) return { ok: false, reason: 'not_connected' }

  let accessToken: string
  try {
    accessToken = await getGscAccessToken(payload, cfg, authDoc)
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'refresh_failed' }
  }

  const property = (authDoc.propertyUrl as string) || cfg.siteUrl
  const windowDays = Math.min(90, Math.max(1, opts?.windowDays ?? 7))
  const rowLimit = Math.min(1000, Math.max(1, opts?.rowLimit ?? 100))

  // GSC data has a ~2-day lag — end the window 2 days ago to avoid partial days.
  const end = new Date(Date.now() - 2 * 86_400_000)
  const start = new Date(end.getTime() - (windowDays - 1) * 86_400_000)
  const endDate = end.toISOString().slice(0, 10)
  const startDate = start.toISOString().slice(0, 10)

  let rows
  try {
    rows = await queryGscSearchAnalytics(accessToken, property, {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    })
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'query_failed' }
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  // Dedupe: skip queries already snapshotted today (one snapshot per query per day).
  const existing = await payload.find({
    collection: RANK_COLLECTION,
    where: { dateKey: { equals: todayKey } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  const already = new Set(existing.docs.map((d) => d.query as string))

  let stored = 0
  const nowIso = new Date().toISOString()
  // Sequential inserts — SQLite allows only one writer (no Promise.all).
  for (const r of rows) {
    const query = r.keys?.[0]
    if (!query || already.has(query)) continue
    try {
      await payload.create({
        collection: RANK_COLLECTION,
        data: {
          query,
          position: round1(r.position),
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          property,
          dateKey: todayKey,
          snapshotDate: nowIso,
        },
        overrideAccess: true,
      })
      stored++
    } catch (e) {
      payload.logger.warn(`[seo] rank-snapshot: skipped "${query}": ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return { ok: true, stored, scanned: rows.length, startDate, endDate }
}

// ---------------------------------------------------------------------------
// POST /rank-snapshot — manual trigger (admin)
// ---------------------------------------------------------------------------
export function createRankSnapshotHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isGscAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const result = await runRankSnapshot(req.payload, basePath, seoConfig)
      if (!result.ok) {
        const status = result.reason === 'not_connected' || result.reason === 'not_configured' ? 409 : 502
        return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } })
      }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] rank-snapshot error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// GET /rank-history — per-query latest position + previous + delta (admin)
// ---------------------------------------------------------------------------
export function createRankHistoryHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!isGscAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const url = new URL(req.url as string)
      const days = Math.min(180, Math.max(7, parseInt(url.searchParams.get('days') || '35', 10)))
      const since = new Date(Date.now() - days * 86_400_000).toISOString()

      const all = await req.payload.find({
        collection: RANK_COLLECTION,
        where: { snapshotDate: { greater_than: since } },
        sort: '-snapshotDate',
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      })

      // Group by query (docs already sorted newest-first globally).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byQuery = new Map<string, any[]>()
      for (const d of all.docs) {
        const q = d.query as string
        const arr = byQuery.get(q)
        if (arr) arr.push(d)
        else byQuery.set(q, [d])
      }

      const movers = Array.from(byQuery.entries()).map(([query, snaps]) => {
        const latest = snaps[0]
        const previous = snaps.find((s) => s.dateKey !== latest.dateKey) || null
        // Delta in ranking terms: positive = improved (moved UP the SERP = lower position).
        const delta = previous ? round1((previous.position as number) - (latest.position as number)) : 0
        return {
          query,
          page: latest.page || null,
          position: latest.position as number,
          previousPosition: previous ? (previous.position as number) : null,
          delta,
          clicks: latest.clicks ?? 0,
          impressions: latest.impressions ?? 0,
          ctr: latest.ctr ?? 0,
          snapshotDate: latest.snapshotDate,
          history: snaps
            .slice(0, 30)
            .map((s) => ({ date: s.dateKey, position: s.position as number }))
            .reverse(),
        }
      })

      // Most visible queries first.
      movers.sort((a, b) => (b.impressions || 0) - (a.impressions || 0))

      return Response.json(
        {
          count: movers.length,
          lastSnapshot: all.docs[0]?.snapshotDate || null,
          movers,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] rank-history error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
