/**
 * SEO monitoring & alerts (SEO 2026) — proactive digest for agencies.
 *
 *   GET  /alerts-digest → build and return the current digest (admin) — preview, no send
 *   POST /alerts-run    → build and DELIVER the digest now (admin) — webhook + email
 *
 * Sources (all best-effort, skipped silently if the collection is absent):
 *   - Score regressions  (seo-score-history): pages whose score dropped ≥ threshold in window
 *   - New 404s           (seo-logs):          404s seen within the window
 *   - Ranking drops      (seo-rank-history):  queries that fell ≥ threshold positions
 *
 * Delivery + thresholds are configured via ENV (consistent with the rest of the plugin —
 * keeps URLs/recipients out of tracked config):
 *   SEO_ALERT_WEBHOOK_URL, SEO_ALERT_EMAIL (comma-separated),
 *   SEO_ALERT_SCORE_DROP (default 10), SEO_ALERT_POSITION_DROP (default 5),
 *   SEO_ALERT_WINDOW_HOURS (default 24)
 *
 * Gated behind `features.alerts` (opt-in). Email uses Payload's configured email adapter.
 */
import type { Payload, PayloadHandler } from 'payload'

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

export interface AlertConfig {
  webhookUrl: string
  emails: string[]
  scoreDrop: number
  positionDrop: number
  windowHours: number
}

export function getAlertConfig(): AlertConfig {
  return {
    webhookUrl: process.env.SEO_ALERT_WEBHOOK_URL || '',
    emails: (process.env.SEO_ALERT_EMAIL || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    scoreDrop: parseInt(process.env.SEO_ALERT_SCORE_DROP || '10', 10) || 10,
    positionDrop: parseInt(process.env.SEO_ALERT_POSITION_DROP || '5', 10) || 5,
    windowHours: Math.max(1, parseInt(process.env.SEO_ALERT_WINDOW_HOURS || '24', 10) || 24),
  }
}

export interface AlertDigest {
  since: string
  generatedAt: string
  scoreRegressions: Array<{ documentId: string; collection: string; from: number; to: number; drop: number }>
  newNotFound: Array<{ url: string; count: number; lastSeen: string }>
  rankDrops: Array<{ query: string; from: number; to: number; drop: number }>
  totalIssues: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export async function buildAlertDigest(payload: Payload, cfg: AlertConfig): Promise<AlertDigest> {
  const now = Date.now()
  const since = new Date(now - cfg.windowHours * 3_600_000).toISOString()

  // --- Score regressions (compare latest vs oldest snapshot within a 14-day window) ---
  const scoreRegressions: AlertDigest['scoreRegressions'] = []
  try {
    const hist = await payload.find({
      collection: 'seo-score-history',
      where: { snapshotDate: { greater_than: new Date(now - 14 * 86_400_000).toISOString() } },
      sort: '-snapshotDate',
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byDoc = new Map<string, any[]>()
    for (const h of hist.docs) {
      const key = `${h.documentId}::${h.collection}`
      const arr = byDoc.get(key)
      if (arr) arr.push(h)
      else byDoc.set(key, [h])
    }
    for (const [key, snaps] of byDoc) {
      const latest = snaps[0] // newest (global desc sort)
      const oldest = snaps[snaps.length - 1]
      const drop = (oldest.score as number) - (latest.score as number)
      if (drop >= cfg.scoreDrop) {
        const [documentId, collection] = key.split('::')
        scoreRegressions.push({
          documentId: documentId!,
          collection: collection!,
          from: oldest.score as number,
          to: latest.score as number,
          drop,
        })
      }
    }
    scoreRegressions.sort((a, b) => b.drop - a.drop)
  } catch {
    // collection absent — skip
  }

  // --- New 404s within the window ---
  const newNotFound: AlertDigest['newNotFound'] = []
  try {
    const logs = await payload.find({
      collection: 'seo-logs',
      where: {
        and: [{ lastSeen: { greater_than: since } }, { ignored: { not_equals: true } }],
      },
      sort: '-count',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const l of logs.docs) {
      newNotFound.push({
        url: (l.url as string) || '',
        count: (l.count as number) || 1,
        lastSeen: (l.lastSeen as string) || '',
      })
    }
  } catch {
    // collection absent — skip
  }

  // --- Ranking drops (latest vs previous distinct day) ---
  const rankDrops: AlertDigest['rankDrops'] = []
  try {
    const ranks = await payload.find({
      collection: 'seo-rank-history',
      where: { snapshotDate: { greater_than: new Date(now - 35 * 86_400_000).toISOString() } },
      sort: '-snapshotDate',
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byQuery = new Map<string, any[]>()
    for (const r of ranks.docs) {
      const q = r.query as string
      const arr = byQuery.get(q)
      if (arr) arr.push(r)
      else byQuery.set(q, [r])
    }
    for (const [query, snaps] of byQuery) {
      const latest = snaps[0]
      const previous = snaps.find((s) => s.dateKey !== latest.dateKey)
      if (!previous) continue
      // position is "lower is better" — a drop means latest position is larger than previous.
      const drop = round1((latest.position as number) - (previous.position as number))
      if (drop >= cfg.positionDrop) {
        rankDrops.push({ query, from: previous.position as number, to: latest.position as number, drop })
      }
    }
    rankDrops.sort((a, b) => b.drop - a.drop)
  } catch {
    // collection absent — skip
  }

  const totalIssues = scoreRegressions.length + newNotFound.length + rankDrops.length
  return {
    since,
    generatedAt: new Date().toISOString(),
    scoreRegressions,
    newNotFound,
    rankDrops,
    totalIssues,
  }
}

function digestToHtml(digest: AlertDigest, siteUrl?: string): string {
  const section = (title: string, rows: string[]) =>
    rows.length
      ? `<h3 style="margin:18px 0 6px">${title}</h3><ul style="margin:0;padding-left:18px">${rows.join('')}</ul>`
      : ''

  const reg = digest.scoreRegressions
    .slice(0, 20)
    .map((r) => `<li>${r.collection}/${r.documentId} — score ${r.from} → <b>${r.to}</b> (−${r.drop})</li>`)
  const nf = digest.newNotFound
    .slice(0, 20)
    .map((n) => `<li><code>${n.url}</code> — ${n.count}×</li>`)
  const rd = digest.rankDrops
    .slice(0, 20)
    .map((d) => `<li>“${d.query}” — #${round1(d.from)} → <b>#${round1(d.to)}</b> (▼${d.drop})</li>`)

  return `<div style="font-family:system-ui;max-width:640px">
  <h2>SEO alert digest${siteUrl ? ` — ${siteUrl}` : ''}</h2>
  <p style="color:#6b7280;font-size:13px">${digest.totalIssues} issue(s) since ${new Date(digest.since).toLocaleString()}</p>
  ${section('📉 Score regressions', reg)}
  ${section('🔗 New 404s', nf)}
  ${section('🔻 Ranking drops', rd)}
  ${digest.totalIssues === 0 ? '<p>No issues to report. 🎉</p>' : ''}
</div>`
}

export interface DeliveryResult {
  sent: boolean
  reason?: string
  channels: { webhook: boolean; email: boolean }
}

export async function deliverAlertDigest(
  payload: Payload,
  digest: AlertDigest,
  cfg: AlertConfig,
  siteUrl?: string,
): Promise<DeliveryResult> {
  const channels = { webhook: false, email: false }

  if (digest.totalIssues === 0) {
    return { sent: false, reason: 'nothing_to_report', channels }
  }

  if (cfg.webhookUrl) {
    try {
      await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'seo-alert-digest', siteUrl, digest }),
      })
      channels.webhook = true
    } catch (e) {
      payload.logger.warn(`[seo] alerts: webhook delivery failed: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  if (cfg.emails.length > 0) {
    const send = (payload as unknown as { sendEmail?: (opts: unknown) => Promise<unknown> }).sendEmail
    if (typeof send === 'function') {
      try {
        await send({
          to: cfg.emails,
          subject: `SEO alert digest — ${digest.totalIssues} issue(s)`,
          html: digestToHtml(digest, siteUrl),
        })
        channels.email = true
      } catch (e) {
        payload.logger.warn(`[seo] alerts: email delivery failed: ${e instanceof Error ? e.message : 'error'}`)
      }
    }
  }

  const sent = channels.webhook || channels.email
  return { sent, reason: sent ? undefined : 'no_channel_configured', channels }
}

// ---------------------------------------------------------------------------
// GET /alerts-digest — preview (admin)
// ---------------------------------------------------------------------------
export function createAlertsDigestHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const cfg = getAlertConfig()
      const digest = await buildAlertDigest(req.payload, cfg)
      return Response.json(
        {
          digest,
          config: {
            webhookConfigured: !!cfg.webhookUrl,
            emailConfigured: cfg.emails.length > 0,
            scoreDrop: cfg.scoreDrop,
            positionDrop: cfg.positionDrop,
            windowHours: cfg.windowHours,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] alerts-digest error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// POST /alerts-run — build + deliver now (admin)
// ---------------------------------------------------------------------------
export function createAlertsRunHandler(siteUrl?: string): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const cfg = getAlertConfig()
      const digest = await buildAlertDigest(req.payload, cfg)
      const delivery = await deliverAlertDigest(req.payload, digest, cfg, siteUrl)
      return Response.json({ digest, delivery }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] alerts-run error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
