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

class SeoCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private ttl: number

  constructor(ttl = DEFAULT_TTL) {
    this.ttl = ttl
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, timestamp: Date.now() })
  }

  /** Invalidate all cached entries (called after document save) */
  invalidate(): void {
    this.store.clear()
  }

  /** Invalidate a specific key */
  invalidateKey(key: string): void {
    this.store.delete(key)
  }

  /** Get cache stats for debugging */
  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: Array.from(this.store.keys()) }
  }
}

// Singleton instance shared across all endpoints
export const seoCache = new SeoCache()
