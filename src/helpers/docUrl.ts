/**
 * Public URL construction for a document — single source of truth.
 *
 * A Payload document is keyed by a bare slug (`my-post`), but its public URL is
 * usually prefixed by the collection route (`/posts/my-post`). Every generator
 * in this plugin used to concatenate `siteUrl + '/' + slug` unconditionally, so
 * `sitemap.xml`, the canonical link and the JSON-LD `@id` all pointed at URLs
 * that 404 for a `posts` document — on an endpoint whose only consumer is
 * Googlebot. The analysis side already knew about the prefix
 * (`resolveToDocSlug` in linkExtractor.ts, and llms.txt hardcoded `/posts/`);
 * this helper makes the generation side agree with it.
 *
 * The default keeps the convention the plugin already shipped in llms.txt:
 * `posts` is served at `/posts/<slug>`, everything else at `/<slug>`.
 * A site that serves posts flat opts out with `collectionRoutes: { posts: '' }`.
 */

/** Map of collection slug → public route prefix. An empty value means "no prefix". */
export type CollectionRoutes = Record<string, string>

export const DEFAULT_COLLECTION_ROUTES: CollectionRoutes = { posts: 'posts' }

/** Strip surrounding slashes so `/posts/` and `posts` behave the same. */
function normalizeSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

/**
 * Resolve the route prefix of a collection, `''` when it has none.
 * An explicit entry always wins — including an explicit empty string, which is
 * how a host disables the default `posts` prefix.
 */
export function getCollectionRoute(
  collectionSlug?: string,
  routes?: CollectionRoutes,
): string {
  if (!collectionSlug) return ''
  const merged = routes ? { ...DEFAULT_COLLECTION_ROUTES, ...routes } : DEFAULT_COLLECTION_ROUTES
  const raw = merged[collectionSlug]
  return typeof raw === 'string' ? normalizeSegment(raw) : ''
}

/**
 * Build the site-relative path of a document.
 * Returns `''` for the home page, so callers can append it to a site URL
 * without producing a trailing slash.
 */
export function buildDocPath(
  slug: string,
  collectionSlug?: string,
  routes?: CollectionRoutes,
): string {
  const cleanSlug = normalizeSegment(slug || '')
  if (!cleanSlug || cleanSlug === 'home') return ''

  const prefix = getCollectionRoute(collectionSlug, routes)
  if (!prefix) return `/${cleanSlug}`

  // Idempotent: a slug already stored with its route prefix is not doubled.
  if (cleanSlug === prefix || cleanSlug.startsWith(`${prefix}/`)) return `/${cleanSlug}`

  return `/${prefix}/${cleanSlug}`
}

/** Absolute public URL of a document. `siteUrl` may carry a trailing slash. */
export function buildDocUrl(
  siteUrl: string,
  slug: string,
  collectionSlug?: string,
  routes?: CollectionRoutes,
): string {
  const base = (siteUrl || '').replace(/\/+$/, '')
  return `${base}${buildDocPath(slug, collectionSlug, routes)}`
}
