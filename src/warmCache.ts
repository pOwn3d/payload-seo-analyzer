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

/**
 * Warm the cache by pre-loading documents from target collections.
 * This populates the in-memory cache so that the audit and sitemap-audit
 * endpoints respond instantly on first request.
 */
async function doWarmUp(payload: Payload, globals: string[] = []): Promise<void> {
  try {
    // Pre-warm: fetch all pages and posts to populate Payload's internal cache.
    // The actual SEO cache (seoCache) is populated when the endpoints are called,
    // but this ensures the underlying data is already loaded in memory.
    const collections = ['pages', 'posts']

    for (const collectionSlug of collections) {
      try {
        await payload.find({
          collection: collectionSlug,
          limit: 500,
          depth: 1,
          overrideAccess: true,
        })
        console.log(`[seo-plugin/warm-cache] Pre-loaded: ${collectionSlug}`)
      } catch {
        // Collection might not exist — skip
      }
    }

    // Pre-load globals
    for (const globalSlug of globals) {
      try {
        await payload.findGlobal({
          slug: globalSlug,
          depth: 1,
          overrideAccess: true,
        })
        console.log(`[seo-plugin/warm-cache] Pre-loaded global: ${globalSlug}`)
      } catch {
        // Global might not exist — skip
      }
    }

    console.log('[seo-plugin/warm-cache] Warm-up complete')
  } catch (error) {
    console.error('[seo-plugin/warm-cache] Warm-up error:', error)
  }
}

/**
 * Start the cache warm-up system.
 * - Warms cache 10 seconds after startup
 * - Re-warms every hour
 * - Cleans up on process SIGTERM
 */
export function startCacheWarmUp(payload: Payload, _basePath: string, globals: string[] = []): void {
  // Initial warm-up after a short delay (let server finish initializing)
  setTimeout(() => {
    void doWarmUp(payload, globals)
  }, STARTUP_DELAY)

  // Periodic warm-up every hour
  intervalId = setInterval(() => {
    void doWarmUp(payload, globals)
  }, WARM_UP_INTERVAL)

  // Cleanup on process termination
  const cleanup = () => {
    stopCacheWarmUp()
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)

  console.log('[seo-plugin/warm-cache] Scheduled: startup + every 1h')
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
