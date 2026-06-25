/**
 * Simple in-memory rate limiter for SEO plugin endpoints.
 * Tracks requests per IP address using a sliding window approach.
 * No external dependencies — uses a plain Map with periodic cleanup.
 */

interface RateLimitEntry {
  timestamps: number[]
}

export interface RateLimiter {
  /** Check if the request should be allowed. Returns true if allowed, false if rate-limited. */
  check(ip: string): boolean
}

/**
 * Create a rate limiter that allows `maxRequests` within `windowMs` milliseconds.
 * Automatically cleans up stale entries every 60 seconds.
 *
 * @param maxRequests - Maximum number of requests per window
 * @param windowMs - Window duration in milliseconds
 */
export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  const store = new Map<string, RateLimitEntry>()

  // Periodic cleanup of expired entries every 60s
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of store) {
      // Remove timestamps older than the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
      if (entry.timestamps.length === 0) {
        store.delete(ip)
      }
    }
  }, 60_000)

  // Allow garbage collection if the process is shutting down
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interval = cleanupInterval as any
  if (typeof interval.unref === 'function') {
    interval.unref()
  }

  return {
    check(ip: string): boolean {
      const now = Date.now()
      let entry = store.get(ip)

      if (!entry) {
        entry = { timestamps: [] }
        store.set(ip, entry)
      }

      // Remove timestamps outside the current window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

      if (entry.timestamps.length >= maxRequests) {
        return false // Rate limited
      }

      entry.timestamps.push(now)
      return true // Allowed
    },
  }
}

/**
 * Extract client IP from a Payload request.
 * Checks x-forwarded-for header first, then falls back to connection info.
 */
export function getClientIp(req: { headers: Headers }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return 'unknown'
}
