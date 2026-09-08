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
 * 2. `isSeoAdmin(user)` — role check on top of that. Fail-open by default on
 *    role-less Payload setups (any admin-panel user is treated as privileged) so
 *    legit admins aren't locked out when the users collection has no
 *    `role`/`roles` field. Set `SEO_REQUIRE_ADMIN_ROLE=1` to require an explicit
 *    `admin` role/roles entry.
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

/**
 * Role gate. Prefer `isSeoAdminRequest(req)`: this one only sees the user object
 * and therefore cannot tell which auth collection it came from.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSeoAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  // Opt-in strict mode: with no explicit admin role, deny instead of failing open.
  if (process.env.SEO_REQUIRE_ADMIN_ROLE === '1') return false
  // No role scheme (default Payload users collection) → any authenticated admin-panel
  // user is treated as privileged; otherwise legit admins on a role-less setup get locked out.
  return typeof user.role !== 'string' && !Array.isArray(user.roles)
}

/** Full admin gate: admin-panel session AND admin role. Use this in endpoints. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSeoAdminRequest(req: any): boolean {
  return isSeoPanelUser(req) && isSeoAdmin(req?.user)
}
