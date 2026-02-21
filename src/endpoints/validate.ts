/**
 * SEO Validate endpoint handler.
 * Runs the full SEO engine (50+ checks) on a page or post.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { analyzeSeo } from '../index.js'
import { resolveAnalysisLocale } from '../helpers/resolveLocale.js'
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
    contentLastReviewed: (doc.contentLastReviewed as string) || undefined,
    isGlobal: options?.isGlobal ?? false,
  }
}

/** Load SeoSettings from DB and merge with plugin config (for validate endpoint) */
async function loadMergedConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  pluginConfig?: SeoConfig,
  reqLocale?: string,
  localeMapping?: Record<string, 'fr' | 'en'>,
): Promise<SeoConfig> {
  let mergedConfig: SeoConfig = { ...pluginConfig }

  try {
    const settingsResult = await payload.find({
      collection: 'seo-settings',
      limit: 1,
      overrideAccess: true,
    })
    const settings = settingsResult.docs?.[0]
    if (settings) {
      if (Array.isArray(settings.disabledRules) && settings.disabledRules.length > 0) {
        const existing = mergedConfig.disabledRules || []
        const combined = [...new Set([...existing, ...settings.disabledRules])]
        mergedConfig = { ...mergedConfig, disabledRules: combined as SeoConfig['disabledRules'] }
      }
      if (settings.siteName) {
        mergedConfig = { ...mergedConfig, siteName: settings.siteName }
      }
      if (settings.thresholds && typeof settings.thresholds === 'object') {
        const thresholds: Record<string, number> = {}
        for (const [key, val] of Object.entries(settings.thresholds)) {
          if (val != null && typeof val === 'number') {
            thresholds[key] = val
          }
        }
        if (Object.keys(thresholds).length > 0) {
          mergedConfig = {
            ...mergedConfig,
            thresholds: { ...(mergedConfig.thresholds || {}), ...thresholds },
          }
        }
      }
    }
  } catch {
    // SeoSettings collection might not exist yet
  }

  // Resolve locale from Payload's i18n
  const effectiveLocale = resolveAnalysisLocale({
    reqLocale,
    pluginLocale: mergedConfig.locale,
    customMapping: localeMapping,
  })
  mergedConfig = { ...mergedConfig, locale: effectiveLocale }

  return mergedConfig
}

export function createValidateHandler(
  _collections: string[],
  seoConfig?: SeoConfig,
  localeMapping?: Record<string, 'fr' | 'en'>,
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Load merged config from DB settings + plugin config
      const mergedConfig = await loadMergedConfig(req.payload, seoConfig, req.locale as string | undefined, localeMapping)

      // GET — quick score check by ID
      if (req.method === 'GET') {
        const url = new URL(req.url as string)
        const id = url.searchParams.get('id')
        const collection = url.searchParams.get('collection') || 'pages'

        if (!id) {
          return Response.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        const globalSlug = url.searchParams.get('global')

        if (globalSlug) {
          const doc = await req.payload.findGlobal({
            slug: globalSlug,
            depth: 1,
            overrideAccess: true,
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
          overrideAccess: true,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (req as any).json()
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
        const doc = await req.payload.findGlobal({
          slug: globalSlug,
          depth: 1,
          overrideAccess: true,
        })
        seoInput = buildSeoInputFromDoc(doc, `global:${globalSlug}`, { isGlobal: true })
        if (overrides) seoInput = { ...seoInput, ...overrides }
      } else if (id && collection) {
        const doc = await req.payload.findByID({
          collection,
          id,
          depth: 1,
          overrideAccess: true,
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
      console.error('[seo-plugin/validate] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
