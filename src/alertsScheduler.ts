/**
 * SEO alerts scheduler.
 * Builds and delivers the monitoring digest on a fixed interval (default daily) so issues —
 * score regressions, new 404s, ranking drops — reach the team proactively.
 *
 * Started from plugin onInit only when `features.alerts` is enabled. The interval is env-tunable
 * via SEO_ALERT_INTERVAL_HOURS (default 24).
 */
import type { Payload } from 'payload'
import { buildAlertDigest, deliverAlertDigest, getAlertConfig } from './endpoints/alerts.js'

const STARTUP_DELAY = 60 * 1000 // 1 min after init

let intervalId: ReturnType<typeof setInterval> | null = null
let listenersAttached = false

async function runDigest(payload: Payload, siteUrl?: string): Promise<void> {
  try {
    const cfg = getAlertConfig()
    if (!cfg.webhookUrl && cfg.emails.length === 0) {
      // No delivery channel configured — nothing to do (don't spam logs).
      return
    }
    const digest = await buildAlertDigest(payload, cfg)
    const delivery = await deliverAlertDigest(payload, digest, cfg, siteUrl)
    if (delivery.sent) {
      payload.logger.info(
        `[seo] alerts: digest delivered (${digest.totalIssues} issues; webhook=${delivery.channels.webhook} email=${delivery.channels.email})`,
      )
    }
  } catch (error) {
    payload.logger.error(`[seo] alerts scheduler error: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

export function startAlertsScheduler(payload: Payload, siteUrl?: string): void {
  // Idempotent — avoid leaking a previous interval / doubling the digest on re-init.
  stopAlertsScheduler()

  const intervalHours = Math.max(1, parseInt(process.env.SEO_ALERT_INTERVAL_HOURS || '24', 10) || 24)
  const intervalMs = intervalHours * 60 * 60 * 1000

  setTimeout(() => {
    void runDigest(payload, siteUrl)
  }, STARTUP_DELAY)

  intervalId = setInterval(() => {
    void runDigest(payload, siteUrl)
  }, intervalMs)

  if (!listenersAttached) {
    const cleanup = () => stopAlertsScheduler()
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    listenersAttached = true
  }

  payload.logger.info(`[seo] alerts: scheduled startup + every ${intervalHours}h`)
}

export function stopAlertsScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
