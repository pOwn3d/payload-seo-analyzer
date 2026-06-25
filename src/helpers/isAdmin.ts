/**
 * Shared admin gate for SEO endpoints — single source of truth.
 *
 * Fail-open by default on role-less Payload setups (any authenticated admin-panel
 * user is treated as privileged) so legit admins aren't locked out when the users
 * collection has no `role`/`roles` field. Set `SEO_REQUIRE_ADMIN_ROLE=1` to opt out
 * of the fail-open and require an explicit `admin` role/roles entry.
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
