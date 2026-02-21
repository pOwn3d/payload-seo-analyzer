/**
 * Payload CMS SEO Analyzer Plugin.
 *
 * Adds SEO analysis capabilities to any Payload CMS project:
 * - SEO fields (focusKeyword, focusKeywords, isCornerstone) on target collections
 * - SeoAnalyzer UI component in the editor sidebar (real-time SEO scoring)
 * - SEO dashboard admin view at /admin/seo
 * - API endpoints for validation, keyword dedup, and audit
 *
 * Usage:
 *   import { seoAnalyzerPlugin } from '@consilioweb/seo-analyzer'
 *
 *   export default buildConfig({
 *     plugins: [
 *       seoAnalyzerPlugin({ collections: ['pages', 'posts'] }),
 *     ],
 *   })
 *
 * Note: The legacy name `seoPlugin` is still available as an alias for
 * backward compatibility, but `seoAnalyzerPlugin` is preferred to avoid
 * naming conflicts with `@payloadcms/plugin-seo`.
 */

import type { Config, Field, Plugin } from 'payload'
import type { SeoConfig, RuleGroup, SeoThresholds } from './types.js'
import { seoFields } from './fields.js'
import { metaFields } from './metaFields.js'
import { createValidateHandler } from './endpoints/validate.js'
import { createCheckKeywordHandler } from './endpoints/checkKeyword.js'
import { createAuditHandler } from './endpoints/audit.js'
import { createHistoryHandler } from './endpoints/history.js'
import { createSitemapAuditHandler } from './endpoints/sitemap-audit.js'
import { createSettingsHandler } from './endpoints/settings.js'
import { createSuggestLinksHandler } from './endpoints/suggestLinks.js'
import { createRedirectHandler } from './endpoints/createRedirect.js'
import { createRedirectsHandler } from './endpoints/redirects.js'
import { createAiGenerateHandler } from './endpoints/aiGenerate.js'
import { createCannibalizationHandler } from './endpoints/cannibalization.js'
import { createExternalLinksHandler } from './endpoints/externalLinks.js'
import { createSitemapConfigHandler } from './endpoints/sitemapConfig.js'
import { createPerformanceHandler } from './endpoints/performance.js'
import { createKeywordResearchHandler } from './endpoints/keywordResearch.js'
import { createBreadcrumbHandler } from './endpoints/breadcrumb.js'
import { createLinkGraphHandler } from './endpoints/linkGraph.js'
import { createSeoScoreHistoryCollection } from './collections/SeoScoreHistory.js'
import { createSeoPerformanceCollection } from './collections/SeoPerformance.js'
import { createSeoSettingsCollection } from './collections/SeoSettings.js'
import { createSeoRedirectsCollection } from './collections/SeoRedirects.js'
import { createTrackSeoScoreHook } from './hooks/trackSeoScore.js'
import { createSeoLogsCollection } from './collections/SeoLogs.js'
import { createSeoLogsHandler } from './endpoints/seoLogs.js'
import { createAutoRedirectHook } from './hooks/autoRedirect.js'
import { createTrackSeoScoreGlobalHook } from './hooks/trackSeoScore.js'
import { startCacheWarmUp } from './warmCache.js'
import { createGenerateHandler } from './endpoints/generate.js'
import { seoTranslations } from './translations.js'

/** Arguments passed to generate functions (generateTitle, generateDescription, etc.) */
export interface GenerateFnArgs {
  doc: Record<string, unknown>
  locale?: string
  req: unknown
  collectionSlug?: string
  globalSlug?: string
}

export interface SeoPluginConfig {
  /** Collections to add SEO fields to (default: ['pages', 'posts']) */
  collections?: string[]
  /** Globals to add SEO fields to (default: []) */
  globals?: string[]
  /** Whether to add the SEO dashboard view at /admin/seo (default: true) */
  addDashboardView?: boolean
  /** Rule groups to disable entirely */
  disabledRules?: RuleGroup[]
  /** Override the weight of all checks within a rule group */
  overrideWeights?: Partial<Record<RuleGroup, number>>
  /** Custom thresholds (override defaults from constants) */
  thresholds?: SeoThresholds
  /** Additional local SEO slugs for the project */
  localSeoSlugs?: string[]
  /** Site name (used for brand duplicate check in titles) */
  siteName?: string
  /** Base path for API endpoints (default: '/seo-plugin') */
  endpointBasePath?: string
  /** Whether to track SEO score history (adds a collection + afterChange hook, default: true) */
  trackScoreHistory?: boolean
  /** Whether to add the sitemap audit view at /admin/sitemap-audit (default: true) */
  addSitemapAuditView?: boolean
  /** Collection slug for redirects (default: 'seo-redirects'). The plugin auto-creates this collection. */
  redirectsCollection?: string
  /** Known dynamic routes that are not stored as document slugs (e.g. ['blog', 'réalisations', 'posts']). These won't be flagged as broken links or orphan pages. */
  knownRoutes?: string[]
  /** Secret header value for seo-logs POST endpoint. If set, POST requests must include X-SEO-Secret header with this value. If not set, POST requires authenticated admin user. */
  seoLogsSecret?: string
  /** Locale for language-specific analysis (default: 'fr') */
  locale?: 'fr' | 'en'
  /** Collection slug for uploads/media (used for meta.image relationTo). Default: 'media' */
  uploadsCollection?: string
  /** Auto-create meta fields (title, description, image) on target collections. Default: true */
  autoCreateMetaFields?: boolean
  /** Custom function to generate meta title */
  generateTitle?: (args: GenerateFnArgs) => string | Promise<string>
  /** Custom function to generate meta description */
  generateDescription?: (args: GenerateFnArgs) => string | Promise<string>
  /** Custom function to generate meta image (returns media ID or URL) */
  generateImage?: (args: GenerateFnArgs) => string | number | Promise<string | number>
  /** Custom function to generate page URL */
  generateURL?: (args: GenerateFnArgs) => string | Promise<string>
  /** Mapping from Payload locale codes to analysis locale ('fr' | 'en') */
  localeMapping?: Record<string, 'fr' | 'en'>
  /** Override or reorganize the default meta fields inside the 'meta' group.
   *  Receives the default fields (overview, title, description, image, preview) and must return a Field[].
   *  Use this to add custom fields, remove defaults, or reorder them. */
  fields?: (args: { defaultFields: Field[] }) => Field[]
  /** If true, wraps collection/global fields in a tabbed UI with "Content" and "SEO" tabs.
   *  Compatible with collections that already use a tabs field as their first field. */
  tabbedUI?: boolean
  /** Custom TypeScript interface name for the generated meta group type (e.g. 'SharedSEO') */
  interfaceName?: string
}

/** Build a resolved SeoConfig from plugin config for use by analyzeSeo() */
function buildSeoConfig(pluginConfig: SeoPluginConfig): SeoConfig {
  return {
    ...(pluginConfig.localSeoSlugs && { localSeoSlugs: pluginConfig.localSeoSlugs }),
    ...(pluginConfig.siteName && { siteName: pluginConfig.siteName }),
    ...(pluginConfig.disabledRules && { disabledRules: pluginConfig.disabledRules }),
    ...(pluginConfig.overrideWeights && { overrideWeights: pluginConfig.overrideWeights }),
    ...(pluginConfig.thresholds && { thresholds: pluginConfig.thresholds }),
    ...(pluginConfig.locale && { locale: pluginConfig.locale }),
  }
}

export const seoAnalyzerPlugin =
  (pluginConfig: SeoPluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const targetCollections = pluginConfig.collections ?? ['pages', 'posts']
    const targetGlobals = pluginConfig.globals ?? []
    const basePath = pluginConfig.endpointBasePath ?? '/seo-plugin'
    const seoConfig = buildSeoConfig(pluginConfig)

    // Helper: detect if a collection already has @payloadcms/plugin-seo meta fields
    function hasExistingSeoMeta(fields: unknown[]): boolean {
      return fields.some((field) => {
        const f = field as Record<string, unknown>
        if (f.type === 'tabs' && Array.isArray(f.tabs)) {
          return (f.tabs as Array<Record<string, unknown>>).some((tab) => {
            if (tab.name !== 'meta') return false
            const tabFields = (tab.fields || []) as Array<Record<string, unknown>>
            const fieldNames = tabFields.map((tf) => tf.name).filter(Boolean)
            return fieldNames.includes('title') && fieldNames.includes('description')
          })
        }
        if (f.name === 'meta' && f.type === 'group') {
          const groupFields = (f.fields || []) as Array<Record<string, unknown>>
          const fieldNames = groupFields.map((gf) => gf.name).filter(Boolean)
          return fieldNames.includes('title') && fieldNames.includes('description')
        }
        return false
      })
    }

    // Build meta fields config
    const metaFieldsConfig = {
      uploadsCollection: pluginConfig.uploadsCollection ?? 'media',
      interfaceName: pluginConfig.interfaceName,
      hasGenerateTitle: !!pluginConfig.generateTitle,
      hasGenerateDescription: !!pluginConfig.generateDescription,
      hasGenerateImage: !!pluginConfig.generateImage,
      basePath: `/api${basePath}`,
    }

    // Build meta fields with optional user override
    function buildMetaFields(): Field[] {
      const defaults = metaFields(metaFieldsConfig)
      if (!pluginConfig.fields) return defaults
      // defaults is [{ name: 'meta', type: 'group', fields: [...] }]
      // Extract inner fields from the meta group, let user override, then re-wrap
      const metaGroup = defaults[0] as Record<string, unknown>
      const innerFields = (metaGroup.fields || []) as Field[]
      const overridden = pluginConfig.fields({ defaultFields: innerFields })
      return [{ ...metaGroup, fields: overridden } as Field]
    }

    const trackHistory = pluginConfig.trackScoreHistory !== false

    // Helper: build the final fields array, optionally wrapping in tabs
    function assembleFields(
      existingFields: Field[],
      fieldsToAdd: Field[],
      options?: { label?: string; isAuth?: boolean },
    ): Field[] {
      if (!pluginConfig.tabbedUI) {
        return [...existingFields, ...fieldsToAdd]
      }

      // Auth collections: keep email field outside tabs
      const isAuth = options?.isAuth ?? false
      const emailField = isAuth
        ? existingFields.find((f) => 'name' in f && f.name === 'email')
        : undefined
      const contentFields = emailField
        ? existingFields.filter((f) => !('name' in f && f.name === 'email'))
        : existingFields

      const firstField = contentFields[0] as Record<string, unknown> | undefined
      const hasExistingTabs = firstField?.type === 'tabs' && Array.isArray((firstField as Record<string, unknown>).tabs)

      const contentTabs = hasExistingTabs
        ? ((firstField as Record<string, unknown>).tabs as unknown[])
        : [{ fields: contentFields, label: options?.label || 'Content' }]

      const tabbedField = {
        type: 'tabs' as const,
        tabs: [
          ...contentTabs,
          { fields: fieldsToAdd, label: 'SEO' },
        ],
      }

      return [
        ...(emailField ? [emailField] : []),
        tabbedField as unknown as Field,
        ...(hasExistingTabs ? contentFields.slice(1) : []),
      ]
    }

    // 1. Add SEO fields + afterChange hook to target collections
    if (config.collections) {
      config.collections = config.collections.map((collection) => {
        if (targetCollections.includes(collection.slug)) {
          const existingFields = (collection.fields || []) as Field[]
          const hasSeoMeta = hasExistingSeoMeta(existingFields)

          // Determine which fields to add
          const fieldsToAdd = [...seoFields()]

          // Auto-create meta fields if:
          // - @payloadcms/plugin-seo is NOT detected
          // - autoCreateMetaFields is not explicitly set to false
          if (!hasSeoMeta && pluginConfig.autoCreateMetaFields !== false) {
            fieldsToAdd.push(...buildMetaFields())
          } else if (hasSeoMeta) {
            console.warn(
              `[seo-analyzer] Collection "${collection.slug}" already has SEO meta fields (likely from @payloadcms/plugin-seo). ` +
              `Meta fields will NOT be auto-created. Only SEO analyzer fields will be added.`
            )
          }

          const isAuth = !!(collection as Record<string, unknown>).auth
          const label = typeof collection.labels?.singular === 'string'
            ? collection.labels.singular
            : undefined

          const updated = {
            ...collection,
            fields: assembleFields(existingFields, fieldsToAdd, { label, isAuth }),
          }
          // Add auto-redirect hook (beforeChange — detects slug changes)
          const existingBeforeHooks = updated.hooks?.beforeChange || []
          updated.hooks = {
            ...updated.hooks,
            beforeChange: [
              ...(Array.isArray(existingBeforeHooks) ? existingBeforeHooks : [existingBeforeHooks]),
              createAutoRedirectHook(pluginConfig.redirectsCollection ?? 'seo-redirects'),
            ],
          }
          // Add score tracking hook
          if (trackHistory) {
            const existingHooks = updated.hooks?.afterChange || []
            updated.hooks = {
              ...updated.hooks,
              afterChange: [
                ...(Array.isArray(existingHooks) ? existingHooks : [existingHooks]),
                createTrackSeoScoreHook(seoConfig),
              ],
            }
          }
          return updated
        }
        return collection
      })
    }

    // 1a. Add SEO fields to target globals
    if (targetGlobals.length > 0 && config.globals) {
      config.globals = config.globals.map((global) => {
        if (!targetGlobals.includes(global.slug)) return global

        const existingFields = global.fields || []
        const hasSeoMeta = hasExistingSeoMeta(existingFields)

        const fieldsToAdd = [...seoFields()]
        if (!hasSeoMeta && pluginConfig.autoCreateMetaFields !== false) {
          fieldsToAdd.push(...buildMetaFields())
        }

        const label = typeof global.label === 'string' ? global.label : undefined

        const updated = {
          ...global,
          fields: assembleFields(existingFields as Field[], fieldsToAdd, { label }),
        }

        // Add score tracking hook for globals (no auto-redirect — globals have no slug)
        if (trackHistory) {
          const existingHooks = updated.hooks?.afterChange || []
          updated.hooks = {
            ...updated.hooks,
            afterChange: [
              ...(Array.isArray(existingHooks) ? existingHooks : [existingHooks]),
              createTrackSeoScoreGlobalHook(seoConfig),
            ],
          }
        }

        return updated
      })
    }

    // 1b. Add plugin-managed collections (score history, settings, redirects)
    const redirectsSlug = pluginConfig.redirectsCollection ?? 'seo-redirects'
    const hasExistingRedirects = config.collections?.some((c) => c.slug === redirectsSlug)
    config.collections = [
      ...(config.collections || []),
      ...(trackHistory ? [createSeoScoreHistoryCollection()] : []),
      createSeoSettingsCollection(),
      ...(!hasExistingRedirects ? [createSeoRedirectsCollection(redirectsSlug)] : []),
      createSeoPerformanceCollection(),
      createSeoLogsCollection(),
    ]

    // 2. Add SEO API endpoints
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: `${basePath}/validate`,
        method: 'post' as const,
        handler: createValidateHandler(targetCollections, seoConfig),
      },
      {
        path: `${basePath}/validate`,
        method: 'get' as const,
        handler: createValidateHandler(targetCollections, seoConfig),
      },
      {
        path: `${basePath}/check-keyword`,
        method: 'get' as const,
        handler: createCheckKeywordHandler(targetCollections, targetGlobals),
      },
      {
        path: `${basePath}/audit`,
        method: 'get' as const,
        handler: createAuditHandler(targetCollections, seoConfig, targetGlobals),
      },
      {
        path: `${basePath}/history`,
        method: 'get' as const,
        handler: createHistoryHandler(),
      },
      {
        path: `${basePath}/sitemap-audit`,
        method: 'get' as const,
        handler: createSitemapAuditHandler(targetCollections, redirectsSlug, pluginConfig.knownRoutes || []),
      },
      {
        path: `${basePath}/settings`,
        method: 'get' as const,
        handler: createSettingsHandler(),
      },
      {
        path: `${basePath}/settings`,
        method: 'patch' as const,
        handler: createSettingsHandler(),
      },
      {
        path: `${basePath}/suggest-links`,
        method: 'post' as const,
        handler: createSuggestLinksHandler(targetCollections, targetGlobals),
      },
      {
        path: `${basePath}/create-redirect`,
        method: 'post' as const,
        handler: createRedirectHandler(pluginConfig.redirectsCollection ?? 'seo-redirects'),
      },
      // Redirect manager CRUD (GET/POST/PATCH/DELETE)
      {
        path: `${basePath}/redirects`,
        method: 'get' as const,
        handler: createRedirectsHandler(pluginConfig.redirectsCollection ?? 'seo-redirects'),
      },
      {
        path: `${basePath}/redirects`,
        method: 'post' as const,
        handler: createRedirectsHandler(pluginConfig.redirectsCollection ?? 'seo-redirects'),
      },
      {
        path: `${basePath}/redirects`,
        method: 'patch' as const,
        handler: createRedirectsHandler(pluginConfig.redirectsCollection ?? 'seo-redirects'),
      },
      {
        path: `${basePath}/redirects`,
        method: 'delete' as const,
        handler: createRedirectsHandler(pluginConfig.redirectsCollection ?? 'seo-redirects'),
      },
      // AI meta generation
      {
        path: `${basePath}/ai-generate`,
        method: 'post' as const,
        handler: createAiGenerateHandler(),
      },
      // Generate meta values via custom functions
      {
        path: `${basePath}/generate`,
        method: 'post' as const,
        handler: createGenerateHandler({
          generateTitle: pluginConfig.generateTitle,
          generateDescription: pluginConfig.generateDescription,
          generateImage: pluginConfig.generateImage,
          generateURL: pluginConfig.generateURL,
        }),
      },
      // Keyword cannibalization detection
      {
        path: `${basePath}/cannibalization`,
        method: 'get' as const,
        handler: createCannibalizationHandler(targetCollections, targetGlobals),
      },
      // External links checker
      {
        path: `${basePath}/external-links`,
        method: 'post' as const,
        handler: createExternalLinksHandler(targetCollections, targetGlobals),
      },
      // Sitemap configuration
      {
        path: `${basePath}/sitemap-config`,
        method: 'get' as const,
        handler: createSitemapConfigHandler(targetCollections),
      },
      // Performance data (GSC import)
      {
        path: `${basePath}/performance`,
        method: 'get' as const,
        handler: createPerformanceHandler(),
      },
      {
        path: `${basePath}/performance`,
        method: 'post' as const,
        handler: createPerformanceHandler(),
      },
      // Keyword research / suggestions
      {
        path: `${basePath}/keyword-research`,
        method: 'get' as const,
        handler: createKeywordResearchHandler(targetCollections, targetGlobals),
      },
      // Breadcrumb configuration
      {
        path: `${basePath}/breadcrumb`,
        method: 'get' as const,
        handler: createBreadcrumbHandler(targetCollections),
      },
      // Internal link graph
      {
        path: `${basePath}/link-graph`,
        method: 'get' as const,
        handler: createLinkGraphHandler(targetCollections, targetGlobals),
      },
      // 404 logs (GET: list, POST: log hit, DELETE: clear/ignore)
      {
        path: `${basePath}/seo-logs`,
        method: 'get' as const,
        handler: createSeoLogsHandler(pluginConfig.seoLogsSecret),
      },
      {
        path: `${basePath}/seo-logs`,
        method: 'post' as const,
        handler: createSeoLogsHandler(pluginConfig.seoLogsSecret),
      },
      {
        path: `${basePath}/seo-logs`,
        method: 'delete' as const,
        handler: createSeoLogsHandler(pluginConfig.seoLogsSecret),
      },
    ]

    // 3. Add SEO dashboard view + nav link
    if (pluginConfig.addDashboardView !== false) {
      if (!config.admin) config.admin = {}
      if (!config.admin.components) config.admin.components = {}
      if (!config.admin.components.views) config.admin.components.views = {}

      ;(config.admin.components.views as Record<string, unknown>).seo = {
        Component: '@consilioweb/seo-analyzer/views#SeoView',
        path: '/seo',
      }

      // Add sitemap audit view
      if (pluginConfig.addSitemapAuditView !== false) {
        ;(config.admin.components.views as Record<string, unknown>)['sitemap-audit'] = {
          Component: '@consilioweb/seo-analyzer/views#SitemapAuditView',
          path: '/sitemap-audit',
        }
      }

      // Add SEO configuration view
      ;(config.admin.components.views as Record<string, unknown>)['seo-config'] = {
        Component: '@consilioweb/seo-analyzer/views#SeoConfigView',
        path: '/seo-config',
      }

      // Add redirect manager view
      ;(config.admin.components.views as Record<string, unknown>)['redirects'] = {
        Component: '@consilioweb/seo-analyzer/views#RedirectManagerView',
        path: '/redirects',
      }

      // Add keyword cannibalization view
      ;(config.admin.components.views as Record<string, unknown>)['cannibalization'] = {
        Component: '@consilioweb/seo-analyzer/views#CannibalizationView',
        path: '/cannibalization',
      }

      // Add performance (GSC) view
      ;(config.admin.components.views as Record<string, unknown>)['performance'] = {
        Component: '@consilioweb/seo-analyzer/views#PerformanceView',
        path: '/performance',
      }

      // Add keyword research view
      ;(config.admin.components.views as Record<string, unknown>)['keyword-research'] = {
        Component: '@consilioweb/seo-analyzer/views#KeywordResearchView',
        path: '/keyword-research',
      }

      // Add schema builder view
      ;(config.admin.components.views as Record<string, unknown>)['schema-builder'] = {
        Component: '@consilioweb/seo-analyzer/views#SchemaBuilderView',
        path: '/schema-builder',
      }

      // Add link graph view
      ;(config.admin.components.views as Record<string, unknown>)['link-graph'] = {
        Component: '@consilioweb/seo-analyzer/views#LinkGraphView',
        path: '/link-graph',
      }

      // Inject nav link into admin sidebar
      const navLinks = config.admin.components.afterNavLinks || []
      config.admin.components.afterNavLinks = [
        ...(Array.isArray(navLinks) ? navLinks : [navLinks]),
        '@consilioweb/seo-analyzer/client#SeoNavLink',
      ]
    }

    // 4. Inject i18n translations for meta field UI labels (39 languages)
    if (!config.i18n) config.i18n = {}
    const existingTranslations = (config.i18n as Record<string, unknown>).translations as
      Record<string, Record<string, unknown>> | undefined
    const merged: Record<string, Record<string, unknown>> = { ...(existingTranslations || {}) }
    for (const [locale, namespaces] of Object.entries(seoTranslations)) {
      merged[locale] = {
        ...(merged[locale] || {}),
        ...namespaces,
      }
    }
    ;(config.i18n as Record<string, unknown>).translations = merged

    // 5. Add cache warm-up on server init
    const existingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (existingOnInit) await existingOnInit(payload)
      startCacheWarmUp(payload, basePath, targetGlobals)
    }

    return config
  }

/** @deprecated Use `seoAnalyzerPlugin` instead. Kept for backward compatibility. */
export { seoAnalyzerPlugin as seoPlugin }
