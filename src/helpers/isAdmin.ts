/**
 * Shared admin gate for SEO endpoints — single source of truth.
 *
 * Two layers, both required:
 *
 * 1. `isSeoPanelUser(req)` — the caller must be authenticated **on the host's
 *    admin-panel users collection**. `req.user` alone is not enough: a Payload
 *    app can expose several auth collections (front-office `customers`, members,
 *    subscribers…), and any of them yields a populated `req.user` on every route,
 *    including this plugin's endpoints. Comparing `req.user.collection` with
 *    `req.payload.config.admin.user` is what separates "authenticated somewhere"
 *    from "authenticated in the admin panel".
 * 2. `isSeoAdmin(user)` — role check on top of that. Fail-open ONLY when the host
 *    declares no role scheme at all (no `role`, no `roles` on the user), so legit
 *    admins aren't locked out of a default Payload users collection. The presence
 *    of a role field — whatever its SHAPE — closes that door. Set
 *    `SEO_REQUIRE_ADMIN_ROLE=1` to require an explicit `admin` role/roles entry
 *    even on a role-less setup.
 *
 * Hosts with more than one admin-capable collection can widen layer 1 with
 * `SEO_ADMIN_USER_COLLECTIONS=users,staff` (comma-separated slugs).
 */

/**
 * Slugs accepted as "admin-panel users" for this request.
 * Empty array means "the host didn't tell us" (mock req in tests, non-sanitized
 * config) — callers then fall back to the legacy authenticated-only behaviour
 * rather than locking every admin out.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminUserCollections(req: any): string[] {
  const fromEnv = process.env.SEO_ADMIN_USER_COLLECTIONS
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const slug = req?.payload?.config?.admin?.user
  return typeof slug === 'string' && slug ? [slug] : []
}

/**
 * True when the request carries an admin-panel session.
 *
 * A user authenticated on ANOTHER auth collection (front-office customer,
 * member…) is rejected — that is the whole point of this helper.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSeoPanelUser(req: any): boolean {
  const user = req?.user
  if (!user) return false
  const userCollection = typeof user.collection === 'string' ? user.collection : undefined
  // Unknown origin collection → keep the historical behaviour (authenticated is enough).
  if (!userCollection) return true
  const allowed = adminUserCollections(req)
  // Unknown admin collection → same fallback; we can't prove the user is foreign.
  if (allowed.length === 0) return true
  return allowed.includes(userCollection)
}

/** The role value that grants SEO-admin rights. */
const ADMIN_ROLE = 'admin'

/**
 * Keys under which a POPULATED relationship (or a rich select option) carries its
 * name. `req.user` is loaded at the collection's `auth.depth` (0 by default), so a
 * `role` relationship reaches us either as a bare id or, at depth >= 1, as the row.
 */
const ROLE_NAME_KEYS = ['name', 'slug', 'value', 'role', 'label', 'title'] as const

/**
 * Collect the role NAMES carried by a value, whatever shape the host modelled it in:
 * a string, an array (select `hasMany`), a populated relationship object, or an array
 * of those. Anything that carries no name — a bare relationship id, for instance —
 * contributes nothing, which is the point: an unidentified role is not `admin`.
 */
function collectRoleNames(value: unknown, out: Set<string>, depth = 0): void {
  if (value === null || value === undefined || depth > 3) return
  if (typeof value === 'string') {
    const name = value.trim()
    if (name) out.add(name)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRoleNames(item, out, depth + 1)
    return
  }
  if (typeof value !== 'object') return
  const obj = value as Record<string, unknown>
  for (const key of ROLE_NAME_KEYS) {
    const candidate = obj[key]
    if (typeof candidate === 'string' && candidate.trim()) out.add(candidate.trim())
  }
}

/**
 * True when the host models roles on this user at all — `role` or `roles` present,
 * in ANY shape (string, array, number, object). This is what the fail-open below is
 * allowed to depend on. The previous test was `typeof user.role !== 'string'`, which
 * asked about the SHAPE rather than the PRESENCE: a `role` relationship (a number at
 * `auth.depth: 0` on SQLite/Postgres, an object once populated) and a single-value
 * `roles` select both fell through it, and every editor of such a host was promoted
 * to SEO admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasRoleScheme(user: any): boolean {
  return (
    (user.role !== undefined && user.role !== null) ||
    (user.roles !== undefined && user.roles !== null)
  )
}

/**
 * Role gate. Prefer `isSeoAdminRequest(req)`: this one only sees the user object
 * and therefore cannot tell which auth collection it came from.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSeoAdmin(user: any): boolean {
  if (!user) return false
  const names = new Set<string>()
  collectRoleNames(user.role, names)
  collectRoleNames(user.roles, names)
  if (names.has(ADMIN_ROLE)) return true
  // Opt-in strict mode: with no explicit admin role, deny instead of failing open.
  if (process.env.SEO_REQUIRE_ADMIN_ROLE === '1') return false
  // No role scheme at all (default Payload users collection) → any authenticated
  // admin-panel user is privileged; otherwise legit admins get locked out.
  return !hasRoleScheme(user)
}

/**
 * True when the user carries a role the plugin cannot read: the field exists but
 * yields no name (a bare relationship id). Those users are denied — the safe answer —
 * but the operator deserves to know why, hence the one-shot warning below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasOpaqueRole(user: any): boolean {
  if (!user || !hasRoleScheme(user)) return false
  const names = new Set<string>()
  collectRoleNames(user.role, names)
  collectRoleNames(user.roles, names)
  return names.size === 0
}

/** Slugs already warned about, so the log line appears once per boot, not per request. */
const warnedOpaqueRoles = new Set<string>()

/** Full admin gate: admin-panel session AND admin role. Use this in endpoints. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSeoAdminRequest(req: any): boolean {
  if (!isSeoPanelUser(req)) return false
  const user = req?.user
  if (isSeoAdmin(user)) return true
  if (hasOpaqueRole(user)) {
    const slug = typeof user?.collection === 'string' ? user.collection : 'unknown'
    if (!warnedOpaqueRoles.has(slug)) {
      warnedOpaqueRoles.add(slug)
      req?.payload?.logger?.warn?.(
        `[seo] the \`${slug}\` role field holds no readable name (an unpopulated relationship id?), ` +
          'so no user of that collection can pass the SEO admin gate. Model the role as a select/text ' +
          'value, or raise the collection auth depth so the relationship is populated. Note that ' +
          'SEO_ADMIN_USER_COLLECTIONS does NOT help here: it widens which collections count as ' +
          'admin-panel users, and the check that just failed is the role itself.',
      )
    }
  }
  return false
}
