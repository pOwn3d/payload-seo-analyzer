/**
 * Retention purge scheduler.
 *
 * Trims the four append-only time-series collections once a day so a long-lived
 * install does not accumulate them forever. Started from plugin onInit ONLY when
 * `retentionDays` names at least one collection with a valid window — with no
 * such option nothing here ever runs, and no existing install changes behaviour.
 *
 * Same shape as rankTracker / alertsScheduler: idempotent start, one interval,
 * cleared on SIGTERM / SIGINT.
 */
import type { Payload } from 'payload'
import { purgeRetention, resolveRetention, type RetentionConfig } from './retention.js'

const PURGE_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
// Later than the other two jobs: a purge is never urgent, and running it after
// boot has settled keeps it off the critical path of a cold start.
const STARTUP_DELAY = 5 * 60 * 1000 // 5 minutes after init

let intervalId: ReturnType<typeof setInterval> | null = null
let listenersAttached = false

async function runPurge(payload: Payload, retention: RetentionConfig): Promise<void> {
  try {
    const result = await purgeRetention(payload, retention)
    if (!result.ran) return
    const failed = result.results.filter((r) => r.error)
    for (const entry of failed) {
      payload.logger.warn(`[seo] retention: ${entry.collection} failed — ${entry.error}`)
    }
    if (result.totalDeleted > 0) {
      const detail = result.results
        .filter((r) => r.deleted > 0)
        .map((r) => `${r.collection}=${r.deleted}`)
        .join(' ')
      payload.logger.info(`[seo] retention: removed ${result.totalDeleted} row(s) (${detail})`)
    }
  } catch (error) {
    payload.logger.error(
      `[seo] retention scheduler error: ${error instanceof Error ? error.message : 'unknown'}`,
    )
  }
}

export function startRetentionPurge(payload: Payload, retention: RetentionConfig | undefined): void {
  // Idempotent — avoid leaking a previous interval / doubling the job on re-init.
  stopRetentionPurge()

  const targets = resolveRetention(retention)
  if (targets.length === 0) return

  setTimeout(() => {
    void runPurge(payload, retention as RetentionConfig)
  }, STARTUP_DELAY)

  intervalId = setInterval(() => {
    void runPurge(payload, retention as RetentionConfig)
  }, PURGE_INTERVAL)

  if (!listenersAttached) {
    const cleanup = () => stopRetentionPurge()
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    listenersAttached = true
  }

  payload.logger.info(
    `[seo] retention: scheduled every 24h — ${targets
      .map((t) => `${t.slug}:${t.days}d`)
      .join(', ')}`,
  )
}

export function stopRetentionPurge(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
