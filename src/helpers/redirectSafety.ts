/**
 * Redirect target safety helpers.
 *
 * A redirect `to` value ends up in a `Location:` header. Validating it only as
 * "prefix with / if missing" is unsafe: `//evil.com` and `/\evil.com` already
 * start with `/`, so they pass through and become protocol-relative redirects to
 * an external origin (open redirect → phishing / OAuth token theft).
 *
 * Policy:
 *  - Same-site relative paths are allowed (single leading `/`, no `//`, no `\`,
 *    no control chars).
 *  - Absolute `http(s)://` URLs are allowed (legitimate cross-site redirects are
 *    a real feature) but flagged `external` so callers can gate them if needed.
 *  - Everything else is rejected: protocol-relative (`//host`), backslash tricks,
 *    and dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`…).
 */

export interface RedirectTargetResult {
  valid: boolean
  /** Normalized, safe value to store (only set when valid). */
  normalized?: string
  /** True when the target points to an absolute external http(s) URL. */
  external?: boolean
  /** Human-readable reason when invalid. */
  reason?: string
}

// Matches an explicit URI scheme at the start, e.g. `http:`, `javascript:`.
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/

/**
 * True if the string contains a raw space or any control char (tab, newline,
 * CR, DEL…) — defeats `/\tevil.com`, CRLF header injection, etc.
 */
function hasControlOrSpace(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Validate and normalize a redirect destination.
 * @param raw - the user-supplied `to` value
 */
export function validateRedirectTarget(raw: unknown): RedirectTargetResult {
  if (typeof raw !== 'string') return { valid: false, reason: 'Destination must be a string' }

  const trimmed = raw.trim()
  if (!trimmed) return { valid: false, reason: 'Destination is empty' }

  // Backslashes are normalized to `/` by browsers → `/\evil.com` becomes `//evil.com`.
  if (trimmed.includes('\\')) return { valid: false, reason: 'Destination must not contain backslashes' }

  // No embedded control chars / whitespace.
  if (hasControlOrSpace(trimmed)) return { valid: false, reason: 'Destination contains invalid characters' }

  // Protocol-relative URL → external origin without an explicit scheme.
  if (trimmed.startsWith('//')) return { valid: false, reason: 'Protocol-relative destinations are not allowed' }

  const schemeMatch = SCHEME_RE.exec(trimmed)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    if (scheme === 'http' || scheme === 'https') {
      try {
        const u = new URL(trimmed)
        return { valid: true, normalized: u.toString(), external: true }
      } catch {
        return { valid: false, reason: 'Invalid absolute URL' }
      }
    }
    return { valid: false, reason: `Scheme "${scheme}:" is not allowed` }
  }

  // Relative path: enforce a single leading slash.
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  // Re-check after normalization (e.g. input `evil` → `/evil`; never `//`).
  if (path.startsWith('//')) return { valid: false, reason: 'Protocol-relative destinations are not allowed' }

  return { valid: true, normalized: path, external: false }
}

/**
 * Normalize a redirect `from` (source) path. Sources are matched against the
 * incoming request path, so they must be clean same-site paths — never an
 * absolute or protocol-relative URL.
 * @returns the normalized path, or null if the value is unusable.
 */
export function normalizeFromPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes('\\') || hasControlOrSpace(trimmed)) return null
  if (SCHEME_RE.test(trimmed) || trimmed.startsWith('//')) return null
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (path.startsWith('//')) return null
  return path
}

/**
 * Apply the host's external-destination policy on top of `validateRedirectTarget`.
 *
 * `validateRedirectTarget` flags absolute http(s) destinations as `external` so
 * "callers can gate them if needed" — but no caller ever read the flag, so every
 * redirect writer was an unconditional site-hijack primitive (`/` → attacker
 * origin, served as a 301 with the site's own authority). This is that gate.
 *
 * @param raw - the user-supplied `to` value
 * @param allowExternal - host opt-in (`allowExternalRedirects` plugin option)
 */
export const EXTERNAL_DISABLED_REASON =
  'External destinations are disabled. Set the plugin option `allowExternalRedirects: true` to allow absolute http(s) redirect targets.'

export function validateRedirectDestination(
  raw: unknown,
  allowExternal: boolean,
): RedirectTargetResult {
  const result = validateRedirectTarget(raw)
  if (!result.valid) return result
  if (result.external && !allowExternal) {
    return { valid: false, reason: EXTERNAL_DISABLED_REASON }
  }
  return result
}

/**
 * Same policy, but aware of what is ALREADY stored on the document.
 *
 * Payload revalidates the whole merged document on every write, including a
 * partial update that does not touch `to` at all. Refusing an external value
 * unconditionally therefore froze every redirect stored back when external
 * destinations were allowed: you could no longer flip its 301/302 type, fix its
 * source path, or edit it at all without rewriting the destination first. The
 * gate must only refuse a destination that actually CHANGES.
 *
 * @param raw - the submitted `to` value
 * @param allowExternal - host opt-in (`allowExternalRedirects` plugin option)
 * @param context - what the caller knows about the previous state of the field.
 *   `previousValue` is supplied by Payload on every server-side update (field
 *   `validate` receives `siblingDoc[field.name]`); it is absent only in the admin
 *   UI's client-side `onChange` pass, which is cosmetic — the authoritative
 *   server pass (`event: 'submit'`) always carries it.
 */
export function validateRedirectDestinationChange(
  raw: unknown,
  allowExternal: boolean,
  context: { event?: string; operation?: string; previousValue?: unknown } = {},
): RedirectTargetResult {
  const result = validateRedirectTarget(raw)
  if (!result.valid) return result
  if (!result.external || allowExternal) return result

  // Creating an external destination is always refused — that is the gate itself.
  if (context.operation === 'update') {
    const previous = context.previousValue
    if (typeof previous === 'string' && previous.trim() !== '') {
      const stored = validateRedirectTarget(previous)
      // Unchanged legacy destination: accepting it writes nothing new.
      if (stored.valid && stored.normalized === result.normalized) return result
    } else if (context.event !== 'submit') {
      // Client-side pass with no previous value: cannot prove a change here, and
      // the server-side pass will refuse it if there is one.
      return result
    }
  }

  return { valid: false, reason: EXTERNAL_DISABLED_REASON }
}
