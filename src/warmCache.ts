/**
 * Cache warm-up system.
 * Pre-computes expensive SEO data on startup and periodically.
 * This ensures /admin/seo and /admin/sitemap-audit load instantly.
 *
 * Uses payload.find() with overrideAccess: true directly instead of
 * HTTP requests — no auth token needed, more reliable.
 */

import type { Payload } from 'payload'
import { seoCache } from './cache.js'

const WARM_UP_INTERVAL = 60 * 60 * 1000 // 1 hour
const STARTUP_DELAY = 10 * 1000 // 10 seconds after init

let intervalId: ReturnType<typeof setInterval> | null = null
let listenersAttached = false

/**
 * Warm the cache by pre-loading documents from target collections.
 *
 * IMPORTANT LIMITATION: This warm-up only triggers Payload's internal
 * database query cache (if any). It does NOT populate the application-level
 * seoCache used by endpoints like /audit or /sitemap-audit. Those caches
 * are only filled when the actual endpoints are called, because they need
 * to run analysis logic (analyzeSeo, link extraction, etc.) to produce
 * the cached result. The benefit here is reducing cold-start latency for
 * the underlying Payload find() calls on first endpoint request.
 */
async function doWarmUp(payload: Payload, collections: string[] = ['pages', 'posts'], globals: string[] = []): Promise<void> {
  try {
    // Pre-warm: fetch all target collections to populate Payload's internal cache.
    // The actual SEO cache (seoCache) is populated when the endpoints are called,
    // but this ensures the underlying data is already loaded in memory.
    for (const collectionSlug of collections) {
      try {
        // Light touch only — warm the DB query path without a memory spike at startup.
        // depth:0 + a small limit keeps this safe on low-memory hosts (Infomaniak). The
        // actual /audit cache is built lazily (single-flight, background) on first request.
        await payload.find({
          collection: collectionSlug,
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })
        payload.logger.info(`[seo] warm-cache: pre-loaded ${collectionSlug}`)
      } catch {
        // Collection might not exist — skip
      }
    }

    // Pre-load globals
    for (const globalSlug of globals) {
      try {
        await payload.findGlobal({
          slug: globalSlug,
          depth: 0,
          overrideAccess: true,
        })
        payload.logger.info(`[seo] warm-cache: pre-loaded global ${globalSlug}`)
      } catch {
        // Global might not exist — skip
      }
    }

    payload.logger.info('[seo] warm-cache: warm-up complete')
  } catch (error) {
    payload.logger.error(`[seo] warm-cache error: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

/**
 * Start the cache warm-up system.
 * - Warms cache 10 seconds after startup
 * - Re-warms every hour
 * - Cleans up on process SIGTERM
 */
export function startCacheWarmUp(payload: Payload, _basePath: string, globals: string[] = [], collections: string[] = ['pages', 'posts']): void {
  // Idempotent — clear any previous interval so a re-init (hot-reload, worker restart) doesn't
  // leak the old timer and run duplicate warm-ups (memory spike).
  stopCacheWarmUp()

  // Initial warm-up after a short delay (let server finish initializing)
  setTimeout(() => {
    void doWarmUp(payload, collections, globals)
  }, STARTUP_DELAY)

  // Periodic warm-up every hour
  intervalId = setInterval(() => {
    void doWarmUp(payload, collections, globals)
  }, WARM_UP_INTERVAL)

  // Cleanup on process termination (attach only once to avoid listener leak)
  if (!listenersAttached) {
    const cleanup = () => {
      stopCacheWarmUp()
    }
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    listenersAttached = true
  }

  payload.logger.info('[seo] warm-cache: scheduled startup + every 1h')
}

/**
 * Stop the periodic warm-up (for cleanup).
 */
export function stopCacheWarmUp(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
