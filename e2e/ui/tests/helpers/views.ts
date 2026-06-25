/**
 * Single source of truth for the plugin's admin views.
 *
 * Mirrors the `views[...] = { ..., path }` registrations in `src/plugin.ts`.
 * Every view-backed feature is enabled in `payload.config.ts`, so all nine
 * are expected to mount.
 */
export interface AdminView {
  /** Feature key (matches the plugin's `views` object key). */
  key: string
  /** Admin route the view is mounted at. */
  path: string
  /** Human-readable label, used in the test title. */
  title: string
}

export const ADMIN_VIEWS: AdminView[] = [
  { key: 'seo', path: '/admin/seo', title: 'SEO dashboard' },
  { key: 'performance', path: '/admin/performance', title: 'Performance' },
  { key: 'link-graph', path: '/admin/link-graph', title: 'Link graph' },
  { key: 'sitemap-audit', path: '/admin/sitemap-audit', title: 'Sitemap audit' },
  { key: 'schema-builder', path: '/admin/schema-builder', title: 'Schema builder' },
  { key: 'cannibalization', path: '/admin/cannibalization', title: 'Cannibalization' },
  { key: 'keyword-research', path: '/admin/keyword-research', title: 'Keyword research' },
  { key: 'redirects', path: '/admin/redirects', title: 'Redirect manager' },
  { key: 'seo-config', path: '/admin/seo-config', title: 'SEO config' },
]
