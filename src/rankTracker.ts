/**
 * Rank tracking scheduler.
 * Takes a Google Search Console position snapshot shortly after startup and once a day, so the
 * `seo-rank-history` collection accumulates a clean per-day series even when nobody opens the
 * dashboard. Snapshots are idempotent per day (see `runRankSnapshot`).
 *
 * Started from plugin onInit only when `features.gscApi` is enabled.
 */
import type { Payload } from 'payload'
import type { SeoConfig } from './types.js'
import { runRankSnapshot } from './endpoints/rankTracking.js'

const SNAPSHOT_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
const STARTUP_DELAY = 30 * 1000 // 30 seconds after init

let intervalId: ReturnType<typeof setInterval> | null = null
let listenersAttached = false

async function doSnapshot(payload: Payload, basePath: string, seoConfig?: SeoConfig): Promise<void> {
  try {
    const result = await runRankSnapshot(payload, basePath, seoConfig)
    if (result.ok) {
      payload.logger.info(`[seo] rank-tracker: snapshot stored ${result.stored}/${result.scanned} queries`)
    } else if (result.reason !== 'not_connected' && result.reason !== 'not_configured') {
      // Silent when GSC simply isn't connected yet; log real failures.
      payload.logger.warn(`[seo] rank-tracker: snapshot skipped (${result.reason})`)
    }
  } catch (error) {
    payload.logger.error(`[seo] rank-tracker error: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

export function startRankTracker(payload: Payload, basePath: string, seoConfig?: SeoConfig): void {
  // Idempotent — avoid leaking a previous interval / doubling the daily job on re-init.
  stopRankTracker()

  setTimeout(() => {
    void doSnapshot(payload, basePath, seoConfig)
  }, STARTUP_DELAY)

  intervalId = setInterval(() => {
    void doSnapshot(payload, basePath, seoConfig)
  }, SNAPSHOT_INTERVAL)

  if (!listenersAttached) {
    const cleanup = () => stopRankTracker()
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    listenersAttached = true
  }

  payload.logger.info('[seo] rank-tracker: scheduled startup + every 24h')
}

export function stopRankTracker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
