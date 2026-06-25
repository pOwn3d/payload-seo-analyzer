/**
 * SEO Validate endpoint handler.
 * Runs the full SEO engine (50+ checks) on a page or post.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { readAccessOpts } from '../helpers/readAccess.js'
import { analyzeSeo } from '../index.js'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import type { SeoInput, SeoConfig } from '../types.js'

/**
 * Build a SeoInput object from a Payload document (page or post).
 * Exported for reuse in other endpoints or custom integrations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSeoInputFromDoc(
  doc: any,
  collection: string,
  options?: { isGlobal?: boolean },
): SeoInput {
  const meta = doc.meta || {}
  const hero = doc.hero || {}
  const isPost = collection === 'posts'

  // Canonical & robots — best-effort read from common field locations. Many sites
  // control indexation at the framework level (e.g. Next.js metadata), in which case
  // these stay undefined and the technical checks correctly stay silent.
  const canonicalUrl: string | undefined =
    (typeof meta.canonicalUrl === 'string' && meta.canonicalUrl) ||
    (typeof doc.canonicalUrl === 'string' && doc.canonicalUrl) ||
    undefined

  let robotsMeta: string | undefined
  const rawRobots =
    (typeof meta.robots === 'string' && meta.robots) ||
    (typeof doc.robots === 'string' && doc.robots) ||
    ''
  if (rawRobots) {
    robotsMeta = rawRobots
  } else {
    const directives: string[] = []
    if (doc.noindex === true || meta.noindex === true) directives.push('noindex')
    if (doc.nofollow === true || meta.nofollow === true) directives.push('nofollow')
    if (directives.length > 0) robotsMeta = directives.join(', ')
  }

  // E-E-A-T signals — best-effort author + dates from common Payload shapes.
  let author: string | undefined
  let authorUrl: string | undefined
  const populatedAuthors = doc.populatedAuthors
  if (Array.isArray(populatedAuthors) && populatedAuthors.length > 0) {
    const a = populatedAuthors[0] || {}
    author =
      (typeof a.name === 'string' && a.name) ||
      (typeof a.firstName === 'string' && a.firstName) ||
      undefined
    if (typeof a.url === 'string') authorUrl = a.url
  } else if (Array.isArray(doc.authors) && doc.authors.length > 0) {
    const a = doc.authors[0]
    if (a && typeof a === 'object' && typeof a.name === 'string') author = a.name
  } else if (typeof doc.author === 'string' && doc.author) {
    author = doc.author
  } else if (doc.author && typeof doc.author === 'object' && typeof doc.author.name === 'string') {
    author = doc.author.name
  }
  if (!authorUrl && typeof doc.authorUrl === 'string') authorUrl = doc.authorUrl

  const publishedAt: string | undefined =
    (typeof doc.publishedAt === 'string' && doc.publishedAt) ||
    (typeof doc.createdAt === 'string' && doc.createdAt) ||
    undefined
  const displayedDate: string | undefined =
    (typeof doc.publishedAt === 'string' && doc.publishedAt) ||
    (typeof doc.date === 'string' && doc.date) ||
    undefined

  // Locale alternates for hreflang — best-effort from common shapes (mono-locale → none).
  let localeAlternates: Array<{ hreflang: string; href: string }> | undefined
  const rawAlts = doc.localeAlternates || doc.alternates || doc.hreflang
  if (Array.isArray(rawAlts)) {
    const mapped = rawAlts
      .filter((a: unknown): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a) => ({
        hreflang: String(a.hreflang || a.locale || a.lang || ''),
        href: String(a.href || a.url || ''),
      }))
      .filter((a) => a.hreflang && a.href)
    if (mapped.length > 0) localeAlternates = mapped
  }

  return {
    metaTitle: (meta.title as string) || '',
    metaDescription: (meta.description as string) || '',
    metaImage: meta.image || undefined,
    slug: (doc.slug as string) || '',
    focusKeyword: (doc.focusKeyword as string) || '',
    focusKeywords: Array.isArray(doc.focusKeywords)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc.focusKeywords as Array<{ keyword?: string }>)
          .map((k) => k.keyword || '')
          .filter(Boolean)
      : undefined,
    heroTitle: isPost ? (doc.title as string) || '' : undefined,
    heroRichText: hero.richText || undefined,
    heroLinks: hero.links || undefined,
    heroMedia: hero.media || undefined,
    blocks: (doc.layout as unknown[]) || undefined,
    content: isPost ? (doc.content as unknown) : undefined,
    isPost,
    isCornerstone: !!doc.isCornerstone,
    updatedAt: (doc.updatedAt as string) || undefined,
    publishedAt,
    contentLastReviewed: (doc.contentLastReviewed as string) || undefined,
    displayedDate,
    author,
    authorUrl,
    localeAlternates,
    canonicalUrl,
    robotsMeta,
    isGlobal: options?.isGlobal ?? false,
  }
}

export function createValidateHandler(
  _collections: string[],
  _globals: string[] = [],
  seoConfig?: SeoConfig,
  localeMapping?: Record<string, 'fr' | 'en'>,
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Load merged config from DB settings + plugin config
      const { config: mergedConfig } = await loadMergedConfig(req.payload, seoConfig, {
        reqLocale: req.locale as string | undefined,
        localeMapping,
      })

      // GET — quick score check by ID
      if (req.method === 'GET') {
        const url = new URL(req.url as string)
        const id = url.searchParams.get('id')
        const collection = url.searchParams.get('collection') || 'pages'

        if (!id) {
          return Response.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        // Validate collection against allowed target collections
        if (!_collections.includes(collection)) {
          return Response.json({ error: 'Collection not allowed' }, { status: 403 })
        }

        const globalSlug = url.searchParams.get('global')

        // Allowlist guard (IDOR): only the plugin's configured globals can be read.
        if (globalSlug && !_globals.includes(globalSlug)) {
          return Response.json({ error: 'Global not allowed' }, { status: 403 })
        }

        if (globalSlug) {
          const doc = await req.payload.findGlobal({
            slug: globalSlug,
            depth: 1,
            ...readAccessOpts(req),
          })
          const seoInput = buildSeoInputFromDoc(doc, `global:${globalSlug}`, { isGlobal: true })
          const analysis = analyzeSeo(seoInput, mergedConfig)
          return Response.json({
            global: globalSlug,
            score: analysis.score,
            level: analysis.level,
            failedChecks: analysis.checks.filter((c) => c.status === 'fail').map((c) => ({ id: c.id, label: c.label, message: c.message })),
            warningChecks: analysis.checks.filter((c) => c.status === 'warning').map((c) => ({ id: c.id, label: c.label, message: c.message })),
            passedChecks: analysis.checks.filter((c) => c.status === 'pass').length,
            totalChecks: analysis.checks.length,
          })
        }

        const doc = await req.payload.findByID({
          collection,
          id,
          depth: 1,
          ...readAccessOpts(req),
        })

        const seoInput = buildSeoInputFromDoc(doc, collection)
        const analysis = analyzeSeo(seoInput, mergedConfig)

        return Response.json({
          id,
          collection,
          slug: seoInput.slug,
          score: analysis.score,
          level: analysis.level,
          failedChecks: analysis.checks
            .filter((c) => c.status === 'fail')
            .map((c) => ({ id: c.id, label: c.label, message: c.message })),
          warningChecks: analysis.checks
            .filter((c) => c.status === 'warning')
            .map((c) => ({ id: c.id, label: c.label, message: c.message })),
          passedChecks: analysis.checks.filter((c) => c.status === 'pass').length,
          totalChecks: analysis.checks.length,
        })
      }

      // POST — full analysis with multiple modes
      const body = await parseJsonBody(req)
      const { id, collection, data, overrides, global: globalSlug } = body as {
        id?: number | string
        collection?: string
        data?: SeoInput
        overrides?: Partial<SeoInput>
        global?: string
      }

      let seoInput: SeoInput

      if (data) {
        seoInput = { ...data, ...(overrides || {}) }
      } else if (globalSlug) {
        // Allowlist guard (IDOR): only the plugin's configured globals can be read.
        if (!_globals.includes(globalSlug)) {
          return Response.json({ error: 'Global not allowed' }, { status: 403 })
        }
        const doc = await req.payload.findGlobal({
          slug: globalSlug,
          depth: 1,
          ...readAccessOpts(req),
        })
        seoInput = buildSeoInputFromDoc(doc, `global:${globalSlug}`, { isGlobal: true })
        if (overrides) seoInput = { ...seoInput, ...overrides }
      } else if (id && collection) {
        // Validate collection against allowed target collections
        if (!_collections.includes(collection)) {
          return Response.json({ error: 'Collection not allowed' }, { status: 403 })
        }
        const doc = await req.payload.findByID({
          collection,
          id,
          depth: 1,
          ...readAccessOpts(req),
        })
        seoInput = buildSeoInputFromDoc(doc, collection)
        if (overrides) seoInput = { ...seoInput, ...overrides }
      } else {
        return Response.json(
          { error: 'Provide either { id, collection } or { data }' },
          { status: 400 },
        )
      }

      const analysis = analyzeSeo(seoInput, mergedConfig)

      return Response.json({
        score: analysis.score,
        level: analysis.level,
        checks: analysis.checks,
        input: {
          metaTitle: seoInput.metaTitle,
          metaDescription: seoInput.metaDescription,
          slug: seoInput.slug,
          focusKeyword: seoInput.focusKeyword,
          isPost: seoInput.isPost,
          isCornerstone: seoInput.isCornerstone,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] validate error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
