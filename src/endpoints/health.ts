/**
 * SEO module health / observability (SEO 2026).
 *
 *   GET /health → a read-only snapshot of the module's configuration + background-job state, so
 *   you can see at a glance whether the AI/GSC/PSI integrations are configured and whether the
 *   periodic jobs (rank tracking, alerts) are actually running. For "reference-grade, nothing
 *   left to optimize", silent failures must be visible.
 *
 * No secret values are returned — only booleans (configured / connected) and timestamps. Admin only.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { seoCache } from '../cache.js'
import { getGscOAuthConfig, getOrCreateGscAuthDoc } from '../helpers/gscClient.js'

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

export function createSeoHealthHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      // --- Env configuration (booleans only, never the values) ---
      const config = {
        aiKey: !!process.env.ANTHROPIC_API_KEY,
        aiModel: process.env.SEO_AI_MODEL || 'claude-opus-4-8',
        pageSpeedKey: !!(process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY),
        gscConfigured: !!getGscOAuthConfig(basePath, seoConfig),
        gscEncryptionKey: !!process.env.SEO_GSC_ENCRYPTION_KEY,
        alertWebhook: !!process.env.SEO_ALERT_WEBHOOK_URL,
        alertEmail: !!process.env.SEO_ALERT_EMAIL,
        indexNowKey: !!process.env.SEO_INDEXNOW_KEY,
        siteUrl: seoConfig?.siteUrl || process.env.NEXT_PUBLIC_SERVER_URL || null,
      }

      // --- Runtime cache state ---
      const cacheStats = seoCache.stats()
      const auditCached = cacheStats.keys.some((k) => k === 'audit' || k.startsWith('audit:'))

      // --- GSC connection + last rank snapshot ---
      let gscConnected = false
      let gscEmail: string | null = null
      let lastRankSnapshot: string | null = null
      try {
        const authDoc = await getOrCreateGscAuthDoc(req.payload)
        gscConnected = !!authDoc.refreshTokenEnc
        gscEmail = (authDoc.connectedEmail as string) || null
      } catch {
        /* collection absent */
      }
      try {
        const latest = await req.payload.find({
          collection: 'seo-rank-history',
          sort: '-snapshotDate',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        lastRankSnapshot = (latest.docs[0]?.snapshotDate as string) || null
      } catch {
        /* collection absent */
      }

      // --- Derived warnings (what to fix) ---
      const warnings: string[] = []
      if (!config.aiKey) warnings.push('ANTHROPIC_API_KEY not set — AI features fall back to heuristics.')
      if (config.gscConfigured && !gscConnected) warnings.push('GSC configured but not connected — rank tracking & CTR opportunities inactive.')
      if (config.gscConfigured && !config.gscEncryptionKey) warnings.push('SEO_GSC_ENCRYPTION_KEY not set — GSC token encrypted with a derived key (set an explicit key for stability).')
      if ((config.alertWebhook || config.alertEmail) === false) warnings.push('No alert channel configured (SEO_ALERT_WEBHOOK_URL / SEO_ALERT_EMAIL) — monitoring digest will not be delivered.')

      return Response.json(
        {
          ok: warnings.length === 0,
          config,
          runtime: {
            auditCached,
            cacheKeys: cacheStats.size,
            gscConnected,
            gscEmail,
            lastRankSnapshot,
          },
          warnings,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] health error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
