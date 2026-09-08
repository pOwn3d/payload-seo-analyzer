/**
 * Access gate for the plugin's admin VIEWS (`/admin/seo`, `/admin/redirects`, …).
 *
 * The endpoints have always gone through `isSeoPanelUser`; the views only checked
 * `!!initPageResult.req.user`, and that is not the same question.
 *
 * Registering a custom admin view with a non-root `path` takes it OUT of Payload's
 * own `canAccessAdmin` redirect: `@payloadcms/next` skips the redirect for any route
 * matching a declared custom view (`isCustomAdminView`), so the plugin's views are
 * the only thing standing between a visitor and the admin shell. A session on a
 * SECOND auth collection (front-office `customers`, members, subscribers…) populates
 * `req.user` on every route — Payload would have redirected that visitor away from
 * `/admin`, but our views let them in, and the admin layout then serializes the full
 * `clientConfig` (every collection, global and field of the CMS) into their browser.
 *
 * This helper is deliberately pure — no `next/navigation` import — so it can be unit
 * tested and so the views keep their own `redirect()` call.
 *
 * @returns the path to redirect to, or `null` when the caller may render the view.
 */
import { isSeoPanelUser } from './isAdmin.js'

/** Join the admin root with a sub-route without ever producing `//…` (a protocol-relative URL). */
function adminPath(root: string, sub: string): string {
  const base = root.replace(/\/+$/, '')
  const path = sub.startsWith('/') ? sub : `/${sub}`
  const joined = `${base}${path}`
  return joined.startsWith('//') ? path : joined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seoViewRedirectTarget(initPageResult: any): string | null {
  const req = initPageResult?.req
  const config = req?.payload?.config
  const root = typeof config?.routes?.admin === 'string' ? config.routes.admin : '/admin'
  const routes = config?.admin?.routes ?? {}
  const login = typeof routes.login === 'string' ? routes.login : '/login'
  const unauthorized = typeof routes.unauthorized === 'string' ? routes.unauthorized : '/unauthorized'

  // Anonymous → log in. Authenticated somewhere else → unauthorized, which is what
  // Payload's own `handleAuthRedirect` does for a user without admin access.
  if (!req?.user) return adminPath(root, login)
  if (!isSeoPanelUser(req)) return adminPath(root, unauthorized)
  return null
}
