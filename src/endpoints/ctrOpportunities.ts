/**
 * CTR opportunities (SEO 2026) — close the loop GSC data → meta rewrite.
 *
 *   GET /ctr-opportunities → ranked list of pages that RANK well (position ≤ 20) but get a LOW
 *   CTR for their position → the meta title/description under-performs and is worth rewriting.
 *
 * This is the highest-ROI, lowest-interaction lever: real Search Console data points exactly at
 * the pages where a better meta tag captures more clicks, with zero guessing. Each opportunity is
 * resolved (best-effort) to its Payload document so it can be optimized in one click.
 *
 * Requires a connected Google Search Console account (`features.gscApi`). Admin only.
 */
import type { Payload, PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import {
  getGscOAuthConfig,
  getOrCreateGscAuthDoc,
  getGscAccessToken,
  queryGscSearchAnalytics,
  isGscAdmin,
  type GscRow,
} from '../helpers/gscClient.js'

/**
 * Approximate blended organic CTR by average SERP position (industry curves, desktop+mobile).
 * Linear interpolation between integer positions; floors past page 2.
 */
export function expectedCtrForPosition(pos: number): number {
  const table: Record<number, number> = {
    1: 0.28,
    2: 0.15,
    3: 0.1,
    4: 0.07,
    5: 0.055,
    6: 0.045,
    7: 0.035,
    8: 0.03,
    9: 0.025,
    10: 0.022,
  }
  if (pos <= 1) return table[1]!
  if (pos <= 10) {
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const a = table[lo] ?? 0.02
    const b = table[hi] ?? 0.02
    return a + (b - a) * (pos - lo)
  }
  if (pos <= 20) return 0.012
  return 0.005
}

export interface CtrOpportunity {
  url: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  expectedCtr: number
  /** Estimated extra monthly clicks if CTR reached the expected curve */
  potentialClicks: number
}

/**
 * Rank pages by missed-clicks potential. Pure — keeps pages on page 1-2 (position ≤ 20) with
 * enough impressions whose CTR is below the curve. Exported for testing.
 */
export function rankCtrOpportunities(
  rows: GscRow[],
  opts: { minImpressions?: number; maxPosition?: number } = {},
): CtrOpportunity[] {
  const minImpressions = opts.minImpressions ?? 50
  const maxPosition = opts.maxPosition ?? 20
  const out: CtrOpportunity[] = []
  for (const r of rows) {
    const url = r.keys?.[0]
    if (!url) continue
    if (r.impressions < minImpressions) continue
    if (r.position > maxPosition) continue
    const expectedCtr = expectedCtrForPosition(r.position)
    const gap = expectedCtr - r.ctr
    if (gap <= 0) continue
    const potentialClicks = Math.round(r.impressions * gap)
    if (potentialClicks < 1) continue
    out.push({
      url,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: Math.round(r.position * 10) / 10,
      expectedCtr: Math.round(expectedCtr * 1000) / 1000,
      potentialClicks,
    })
  }
  out.sort((a, b) => b.potentialClicks - a.potentialClicks)
  return out
}

/** Best-effort: resolve a GSC page URL to a Payload document (collection + id) by slug. */
async function resolveDoc(
  payload: Payload,
  url: string,
  targetCollections: string[],
): Promise<{ collection: string; id: string } | null> {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  const segments = path.split('/').filter(Boolean)
  const slug = segments.length === 0 ? 'home' : segments[segments.length - 1]!
  for (const collection of targetCollections) {
    try {
      const res = await payload.find({
        collection,
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (res.docs.length > 0) {
        return { collection, id: String(res.docs[0]!.id) }
      }
    } catch {
      // collection without a slug field — skip
    }
  }
  return null
}

export function createCtrOpportunitiesHandler(
  basePath: string,
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    try {
      if (!isGscAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const cfg = getGscOAuthConfig(basePath, seoConfig)
      if (!cfg) return Response.json({ error: 'GSC OAuth not configured.' }, { status: 400 })

      const authDoc = await getOrCreateGscAuthDoc(req.payload)
      if (!authDoc.refreshTokenEnc) {
        return Response.json({ error: 'Not connected to Google Search Console.' }, { status: 409 })
      }

      let accessToken: string
      try {
        accessToken = await getGscAccessToken(req.payload, cfg, authDoc)
      } catch (e) {
        const code = e instanceof Error ? e.message : 'refresh_failed'
        const status = code === 'decrypt_failed' ? 409 : 502
        return Response.json({ error: 'Could not refresh GSC access token.' }, { status })
      }

      const url = new URL(req.url as string)
      const minImpressions = Math.max(1, parseInt(url.searchParams.get('minImpressions') || '50', 10) || 50)
      const property = (authDoc.propertyUrl as string) || cfg.siteUrl

      const end = new Date(Date.now() - 2 * 86_400_000)
      const start = new Date(end.getTime() - 27 * 86_400_000)
      const endDate = end.toISOString().slice(0, 10)
      const startDate = start.toISOString().slice(0, 10)

      let rows: GscRow[]
      try {
        rows = await queryGscSearchAnalytics(accessToken, property, {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 250,
        })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'GSC query failed' }, { status: 502 })
      }

      const opportunities = rankCtrOpportunities(rows, { minImpressions })

      // Resolve the top opportunities to Payload docs so the UI can optimize in one click.
      const top = opportunities.slice(0, 50)
      const resolved = await Promise.all(
        top.map(async (o) => ({ ...o, doc: await resolveDoc(req.payload, o.url, targetCollections) })),
      )

      return Response.json(
        { property, startDate, endDate, count: opportunities.length, opportunities: resolved },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ctr-opportunities error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
