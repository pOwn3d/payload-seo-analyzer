/**
 * Locale used to scope the server-side caches — single source of truth.
 *
 * `req.locale` comes straight from the `?locale=` query string and is NOT
 * always sanitized by Payload:
 *   - with no `localization` block (the common single-language site), Payload
 *     copies the raw string onto the request without looking at it;
 *   - with `localization` but `fallback: false`, `sanitizeLocales()` only
 *     rewrites the value when a fallback exists, so an unknown code also
 *     survives untouched.
 *
 * Every aggregation endpoint used to build its cache key from that raw string.
 * A caller looping over `?locale=a1`, `?locale=a2`… therefore produced a fresh
 * key on each request: permanent cache miss, no single-flight (it is keyed by
 * the same string), and one full site-wide recomputation per request — the very
 * load the admin/throttle gates were added to prevent, plus an unbounded key
 * space in the LRU cache and in the `lastAuditBuildAt` map.
 *
 * The fix is to derive the cache scope from what the HOST declares, not from
 * what the caller sends: only a code listed in `config.localization.localeCodes`
 * (or Payload's cross-locale `all`) may scope a key. The resulting key space is
 * bounded by the site configuration.
 *
 * Returned value is meant to be used BOTH for the cache key and for the locale
 * passed down to the data fetch, so the key can never describe a different
 * corpus than the one that was cached under it.
 */

/**
 * @returns the locale to scope caches with, or `undefined` for the unscoped
 * (default-locale) key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeCacheLocale(req: any): string | undefined {
  const raw = typeof req?.locale === 'string' ? req.locale.trim() : ''
  if (!raw) return undefined

  const config = req?.payload?.config
  // No config at hand (mock request in tests, non-sanitized config): we cannot
  // tell a legit locale from a forged one, so keep the historical behaviour
  // rather than silently collapsing distinct locales onto one key. A real
  // Payload request always carries the sanitized config, so this branch is not
  // reachable by an attacker.
  if (!config) return raw

  const localization = config.localization
  // Localization disabled → there is exactly one corpus, so exactly one key.
  if (!localization) return undefined

  // Payload's cross-locale mode ('*' is normalized to 'all'): a distinct,
  // legitimate corpus shape, and a single extra bounded key.
  if (raw === 'all' || raw === '*') return 'all'

  const codes: unknown = localization.localeCodes
  if (!Array.isArray(codes) || codes.length === 0) return undefined
  return codes.includes(raw) ? raw : undefined
}
