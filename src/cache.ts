/**
 * Simple in-memory cache for SEO plugin endpoints.
 * Caches expensive computations (audit, sitemap-audit, link-graph, etc.)
 * with a configurable TTL. Cache is invalidated when documents are saved
 * (via the afterChange hook in the plugin).
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const DEFAULT_TTL = 15 * 60 * 1000 // 15 minutes
/** Hard cap on the number of cached entries to bound memory (LRU eviction beyond this). */
const DEFAULT_MAX_ENTRIES = 200

class SeoCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private ttl: number
  private maxEntries: number
  /**
   * Epoch ms of the last invalidation (document save, manual refresh…). Used by the
   * build-time file cache: a pre-computed `seo-audit-cache.json` may only be hydrated
   * if it was generated AFTER the last invalidation, otherwise it would serve stale
   * scores once content has changed.
   */
  private _lastInvalidatedAt = 0

  constructor(ttl = DEFAULT_TTL, maxEntries = DEFAULT_MAX_ENTRIES) {
    this.ttl = ttl
    this.maxEntries = maxEntries
  }

  /** Epoch ms of the last invalidation (0 if never invalidated since boot). */
  get lastInvalidatedAt(): number {
    return this._lastInvalidatedAt
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key)
      return null
    }
    // LRU: re-insert to mark this key as most-recently-used (Map keeps insertion order).
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    // Refresh recency if present, then (re)insert at the end.
    this.store.delete(key)
    this.store.set(key, { data, timestamp: Date.now() })
    // Evict least-recently-used entries (front of the Map) until within bounds.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  /** Invalidate all cached entries (called after document save) */
  invalidate(): void {
    this.store.clear()
    this._lastInvalidatedAt = Date.now()
  }

  /** Invalidate a specific key */
  invalidateKey(key: string): void {
    this.store.delete(key)
    this._lastInvalidatedAt = Date.now()
  }

  /**
   * Invalidate every entry whose key matches `base` exactly or as a scoped
   * variant (`base:<locale>`, `base-<param>`). Needed because cache keys are
   * locale-scoped (e.g. `audit:fr`, `audit:en`) — a plain `invalidateKey('audit')`
   * would never match them. Deleting during Map iteration is safe.
   */
  invalidateByPrefix(base: string): void {
    for (const key of this.store.keys()) {
      if (key === base || key.startsWith(`${base}:`) || key.startsWith(`${base}-`)) {
        this.store.delete(key)
      }
    }
    this._lastInvalidatedAt = Date.now()
  }

  /** Get cache stats for debugging */
  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: Array.from(this.store.keys()) }
  }
}

// Singleton instance shared across all endpoints
export const seoCache = new SeoCache()
