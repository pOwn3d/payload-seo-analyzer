/**
 * Frontend metadata helper — turns a Payload document into a Next.js-compatible `Metadata`
 * object (title, description, canonical, hreflang, robots, Open Graph, Twitter).
 *
 * This closes the loop between analysis and production: instead of only grading the SEO in the
 * admin, the plugin can now PRODUCE the actual `<head>` metadata. Use it in a Next.js page:
 *
 *   export async function generateMetadata({ params }) {
 *     const doc = await payload.findByID({ collection: 'pages', id, depth: 1 })
 *     return buildSeoMetadata(doc, { collection: 'pages', siteUrl, siteName: 'My Site' })
 *   }
 *
 * The return value is a structural subset of Next's `Metadata` (assignable to it) — kept
 * dependency-free so the plugin doesn't hard-depend on `next`.
 */

import { getSchemaImageUrl } from './buildSchema.js'

export interface SeoMetadataOptions {
  /** Collection slug — used to pick the Open Graph type (posts → 'article') */
  collection?: string
  /** Absolute site URL (defaults to NEXT_PUBLIC_SERVER_URL / PAYLOAD_PUBLIC_SERVER_URL) */
  siteUrl?: string
  /** Site name for Open Graph */
  siteName?: string
  /** Template for the title, e.g. "%s | My Site" (%s = the page title) */
  titleTemplate?: string
  /** Fallback OG/Twitter image (absolute, or site-relative) when the document has none */
  defaultImage?: string
  /** Open Graph locale, e.g. 'fr_FR' */
  locale?: string
}

export interface SeoMetadata {
  title?: string
  description?: string
  alternates?: { canonical?: string; languages?: Record<string, string> }
  robots?: { index: boolean; follow: boolean }
  openGraph?: {
    title?: string
    description?: string
    url?: string
    siteName?: string
    type?: string
    locale?: string
    images?: Array<{ url: string }>
  }
  twitter?: {
    card?: string
    title?: string
    description?: string
    images?: string[]
  }
}

function resolveSiteUrl(explicit?: string): string {
  return (
    explicit ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    ''
  ).replace(/\/$/, '')
}

function parseRobots(
  doc: Record<string, unknown>,
  meta: Record<string, unknown>,
): { index: boolean; follow: boolean } {
  const raw =
    (typeof meta.robots === 'string' && meta.robots) ||
    (typeof doc.robots === 'string' && doc.robots) ||
    ''
  let noindex = false
  let nofollow = false
  if (raw) {
    const low = raw.toLowerCase()
    noindex = low.includes('noindex')
    nofollow = low.includes('nofollow')
  }
  if (doc.noindex === true || meta.noindex === true) noindex = true
  if (doc.nofollow === true || meta.nofollow === true) nofollow = true
  return { index: !noindex, follow: !nofollow }
}

function buildLanguages(doc: Record<string, unknown>): Record<string, string> | undefined {
  const raw = doc.localeAlternates || doc.alternates || doc.hreflang
  if (!Array.isArray(raw)) return undefined
  const out: Record<string, string> = {}
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue
    const r = a as Record<string, unknown>
    const lang = String(r.hreflang || r.locale || r.lang || '')
    const href = String(r.href || r.url || '')
    if (lang && href) out[lang] = href
  }
  return Object.keys(out).length ? out : undefined
}

function absoluteUrl(value: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return `${siteUrl}${value.startsWith('/') ? '' : '/'}${value}`
}

/**
 * Build a Next.js-compatible `Metadata` object from a Payload document.
 * Pure — safe to call inside `generateMetadata()` (server side).
 */
export function buildSeoMetadata(
  doc: Record<string, unknown>,
  options: SeoMetadataOptions = {},
): SeoMetadata {
  const siteUrl = resolveSiteUrl(options.siteUrl)
  const meta = (doc.meta || {}) as Record<string, unknown>

  const rawTitle = (meta.title as string) || (doc.title as string) || ''
  const title = options.titleTemplate && rawTitle ? options.titleTemplate.replace('%s', rawTitle) : rawTitle
  const description = (meta.description as string) || ''
  const slug = (doc.slug as string) || ''

  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  let image = getSchemaImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)
  if (!image && options.defaultImage) image = absoluteUrl(options.defaultImage, siteUrl)

  const explicitCanonical =
    (typeof meta.canonicalUrl === 'string' && meta.canonicalUrl) ||
    (typeof doc.canonicalUrl === 'string' && doc.canonicalUrl) ||
    ''
  const canonical = explicitCanonical || (siteUrl ? `${siteUrl}${slug ? `/${slug}` : ''}` : undefined)

  const languages = buildLanguages(doc)
  const isPost = options.collection === 'posts' || doc.isPost === true

  const md: SeoMetadata = {}
  if (title) md.title = title
  if (description) md.description = description

  const alternates: { canonical?: string; languages?: Record<string, string> } = {}
  if (canonical) alternates.canonical = canonical
  if (languages) alternates.languages = languages
  if (Object.keys(alternates).length) md.alternates = alternates

  md.robots = parseRobots(doc, meta)

  md.openGraph = {
    ...(rawTitle ? { title: rawTitle } : {}),
    ...(description ? { description } : {}),
    ...(canonical ? { url: canonical } : {}),
    ...(options.siteName ? { siteName: options.siteName } : {}),
    type: isPost ? 'article' : 'website',
    ...(options.locale ? { locale: options.locale } : {}),
    ...(image ? { images: [{ url: image }] } : {}),
  }

  md.twitter = {
    card: image ? 'summary_large_image' : 'summary',
    ...(rawTitle ? { title: rawTitle } : {}),
    ...(description ? { description } : {}),
    ...(image ? { images: [image] } : {}),
  }

  return md
}
