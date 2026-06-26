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
 *   import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'
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
import type { SeoConfig, SeoFeatures, RuleGroup, SeoThresholds } from './types.js'
import { seoFields } from './fields.js'
import { metaFields } from './metaFields.js'
import { createValidateHandler } from './endpoints/validate.js'
import { createCheckKeywordHandler } from './endpoints/checkKeyword.js'
import { createAuditHandler } from './endpoints/audit.js'
import { createIndexationAuditHandler } from './endpoints/indexationAudit.js'
import { createHistoryHandler } from './endpoints/history.js'
import { createSitemapAuditHandler } from './endpoints/sitemap-audit.js'
import { createSettingsHandler } from './endpoints/settings.js'
import { createSuggestLinksHandler } from './endpoints/suggestLinks.js'
import { createRedirectHandler } from './endpoints/createRedirect.js'
import { createRedirectsHandler } from './endpoints/redirects.js'
import { createAiGenerateHandler } from './endpoints/aiGenerate.js'
import { createAiOptimizeHandler } from './endpoints/aiOptimize.js'
import { createAiAltTextHandler, createAltTextAuditHandler } from './endpoints/aiAltText.js'
import { createAiContentBriefHandler } from './endpoints/aiContentBrief.js'
import { createAiOptimizeBulkHandler } from './endpoints/aiOptimizeBulk.js'
import { createCannibalizationHandler } from './endpoints/cannibalization.js'
import { createExternalLinksHandler } from './endpoints/externalLinks.js'
import { createSitemapConfigHandler } from './endpoints/sitemapConfig.js'
import { createPerformanceHandler } from './endpoints/performance.js'
import { createCoreWebVitalsHandler } from './endpoints/coreWebVitals.js'
import {
  createGscStatusHandler,
  createGscAuthStartHandler,
  createGscCallbackHandler,
  createGscDataHandler,
  createGscDisconnectHandler,
} from './endpoints/gscOAuth.js'
import { createKeywordResearchHandler } from './endpoints/keywordResearch.js'
import { createBreadcrumbHandler } from './endpoints/breadcrumb.js'
import { createLinkGraphHandler } from './endpoints/linkGraph.js'
import { createSchemaGeneratorHandler } from './endpoints/schemaGenerator.js'
import { createRedirectChainsHandler } from './endpoints/redirectChains.js'
import { createDuplicateContentHandler } from './endpoints/duplicateContent.js'
import { createAiRewriteHandler } from './endpoints/aiRewrite.js'
import { createRobotsHandler, createRobotsUpdateHandler } from './endpoints/robots.js'
import { createSitemapHandler } from './endpoints/sitemap.js'
import { createLlmsTxtHandler } from './endpoints/llmsTxt.js'
import {
  createNewsSitemapHandler,
  createImageSitemapHandler,
  createVideoSitemapHandler,
} from './endpoints/sitemapExtensions.js'
import { createSeoScoreHistoryCollection } from './collections/SeoScoreHistory.js'
import { createSeoPerformanceCollection } from './collections/SeoPerformance.js'
import { createSeoSettingsCollection } from './collections/SeoSettings.js'
import { createSeoRedirectsCollection } from './collections/SeoRedirects.js'
import { createTrackSeoScoreHook } from './hooks/trackSeoScore.js'
import { createSeoLogsCollection } from './collections/SeoLogs.js'
import { createSeoGscAuthCollection } from './collections/SeoGscAuth.js'
import { createSeoRankHistoryCollection } from './collections/SeoRankHistory.js'
import { createRankSnapshotHandler, createRankHistoryHandler } from './endpoints/rankTracking.js'
import { createCtrOpportunitiesHandler } from './endpoints/ctrOpportunities.js'
import { createContentGradeHandler } from './endpoints/contentGrade.js'
import { createSeoHealthHandler } from './endpoints/health.js'
import {
  createIndexNowKeyHandler,
  createIndexNowSubmitHandler,
  createIndexNowHook,
} from './endpoints/indexNow.js'
import { createSeoLogsHandler } from './endpoints/seoLogs.js'
import { createAutoRedirectHook } from './hooks/autoRedirect.js'
import { createTrackSeoScoreGlobalHook } from './hooks/trackSeoScore.js'
import { startCacheWarmUp } from './warmCache.js'
import { startRankTracker } from './rankTracker.js'
import { startAlertsScheduler } from './alertsScheduler.js'
import { createAlertsDigestHandler, createAlertsRunHandler } from './endpoints/alerts.js'
import { resolveGscSiteUrl } from './helpers/gscClient.js'
import { createGenerateHandler } from './endpoints/generate.js'
import { seoTranslations } from './translations.js'
import { registerDashboardTranslations } from './dashboard-i18n.js'
import { createRateLimiter, getClientIp } from './rateLimiter.js'

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
  /** Base URL of the site (used for canonical URL validation, e.g. 'https://example.com') */
  siteUrl?: string
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
  /**
   * Path to a build-time audit cache file (JSON, produced by `buildAuditToFile()`).
   * When set, the heavy site-wide dashboard audit is hydrated from this file on a cache
   * miss instead of being recomputed live — offloading the cost to CI on memory-constrained
   * hosts (e.g. Infomaniak). Stale-guarded: ignored once content changes (a live rebuild
   * takes over). Runtime kill-switch: set env `SEO_AUDIT_FILE_CACHE=0` to ignore the file.
   */
  auditCacheFile?: string
  /** Granular feature flags — all default to true. Disable features you don't need
   *  to reduce collections, endpoints, and admin views loaded by the plugin.
   *  The core analyzer sidebar, validate endpoint, and meta fields are always active. */
  features?: SeoFeatures
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
  /** Custom dashboard translations for additional locales (e.g. 'cs', 'de', 'es').
   *  Partial overrides are supported — missing keys fall back to English.
   *  @example
   *  ```ts
   *  customTranslations: {
   *    cs: {
   *      common: { loading: 'Načítání...', save: 'Uložit' },
   *      nav: { dashboard: 'Přehled', seo: 'SEO' },
   *    }
   *  }
   *  ```
   */
  customTranslations?: Record<string, Partial<import('./dashboard-i18n.js').DashboardTranslations>>
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
    ...(pluginConfig.siteUrl && { siteUrl: pluginConfig.siteUrl }),
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
    const uploadsCollection = pluginConfig.uploadsCollection ?? 'media'
    const targetGlobals = pluginConfig.globals ?? []
    const basePath = pluginConfig.endpointBasePath ?? '/seo-plugin'
    const seoConfig = buildSeoConfig(pluginConfig)

    // Resolve feature flags — all default to true
    const features: Required<SeoFeatures> = {
      analyzer: true,
      dashboard: true,
      redirects: true,
      performance: true,
      linkGraph: true,
      keywords: true,
      cannibalization: true,
      schemaBuilder: true,
      sitemapAudit: true,
      seoLogs: true,
      scoreHistory: true,
      externalLinks: true,
      aiFeatures: true,
      duplicateContent: true,
      settings: true,
      gscApi: false, // opt-in — requires Google Cloud OAuth setup + secrets
      warmCache: true, // disable on low-memory hosts to skip startup pre-loading
      alerts: false, // opt-in — requires SEO_ALERT_WEBHOOK_URL and/or SEO_ALERT_EMAIL
      indexNow: false, // opt-in — requires SEO_INDEXNOW_KEY
      ...pluginConfig.features,
    }

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

    const trackHistory = pluginConfig.trackScoreHistory !== false && features.scoreHistory

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
          if (features.redirects) {
            const existingBeforeHooks = updated.hooks?.beforeChange || []
            updated.hooks = {
              ...updated.hooks,
              beforeChange: [
                ...(Array.isArray(existingBeforeHooks) ? existingBeforeHooks : [existingBeforeHooks]),
                createAutoRedirectHook(pluginConfig.redirectsCollection ?? 'seo-redirects'),
              ],
            }
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
          // Add IndexNow proactive-indexing hook (submits the URL on publish)
          if (features.indexNow) {
            const existingHooks = updated.hooks?.afterChange || []
            updated.hooks = {
              ...updated.hooks,
              afterChange: [
                ...(Array.isArray(existingHooks) ? existingHooks : [existingHooks]),
                createIndexNowHook(basePath, seoConfig),
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

    // 1b. Add plugin-managed collections (conditionally based on features)
    const redirectsSlug = pluginConfig.redirectsCollection ?? 'seo-redirects'
    const hasExistingRedirects = config.collections?.some((c) => c.slug === redirectsSlug)
    const pluginCollections = []
    if (trackHistory) pluginCollections.push(createSeoScoreHistoryCollection())
    if (features.settings) pluginCollections.push(createSeoSettingsCollection())
    if (features.redirects && !hasExistingRedirects) pluginCollections.push(createSeoRedirectsCollection(redirectsSlug))
    if (features.performance) pluginCollections.push(createSeoPerformanceCollection())
    if (features.seoLogs) pluginCollections.push(createSeoLogsCollection())
    if (features.gscApi) pluginCollections.push(createSeoGscAuthCollection(), createSeoRankHistoryCollection())
    config.collections = [
      ...(config.collections || []),
      ...pluginCollections,
    ]

    // Rate limiter for expensive POST endpoints (LLM calls, heavy crawls): 10 req / 60s per IP.
    const expensiveEndpointLimiter = createRateLimiter(10, 60_000)
    // Separate, poll-friendly limiter for the background-built audits. These GET endpoints are
    // POLLED by the dashboard every 3s while the (single-flight) build runs — a build on a large
    // site can take minutes. The actual expensive work is the background build, which single-flight
    // already bounds to one at a time; the polled requests just read the cache / return a 202. A
    // 10/min cap (the expensive limiter) throttled the polls themselves and surfaced as HTTP 429
    // mid-build. This higher cap fits sustained polling (≈20 req/min/tab) while still guarding abuse.
    const auditPollLimiter = createRateLimiter(120, 60_000)

    /** Wrap a handler with rate limiting. Returns 429 if limit exceeded. */
    function withRateLimit(
      handler: ReturnType<typeof createAuditHandler>,
      limiter: ReturnType<typeof createRateLimiter> = expensiveEndpointLimiter,
    ): typeof handler {
      return async (req) => {
        // Prefer the authenticated user id (not spoofable) over the client IP —
        // X-Forwarded-For is client-controlled, so an IP-only key is trivially
        // bypassed by varying the header. Falls back to IP for public endpoints.
        const userId = (req.user as { id?: string | number } | undefined)?.id
        const key = userId != null ? `user:${userId}` : `ip:${getClientIp(req)}`
        if (!limiter.check(key)) {
          return Response.json(
            { error: 'Too Many Requests. Please try again later.' },
            { status: 429 },
          )
        }
        return handler(req)
      }
    }

    // 2. Add SEO API endpoints (conditionally based on features)
    type EndpointDef = { path: string; method: 'get' | 'post' | 'patch' | 'delete'; handler: ReturnType<typeof createValidateHandler> }
    const pluginEndpoints: EndpointDef[] = [
      // Core — always active (analyzer sidebar needs these)
      {
        path: `${basePath}/validate`,
        method: 'post',
        handler: createValidateHandler(targetCollections, targetGlobals, seoConfig),
      },
      {
        path: `${basePath}/validate`,
        method: 'get',
        handler: createValidateHandler(targetCollections, targetGlobals, seoConfig),
      },
      {
        path: `${basePath}/check-keyword`,
        method: 'get',
        handler: createCheckKeywordHandler(targetCollections, targetGlobals),
      },
      // Generate meta values via custom functions — always active (used by meta field UI)
      {
        path: `${basePath}/generate`,
        method: 'post',
        handler: createGenerateHandler(
          {
            generateTitle: pluginConfig.generateTitle,
            generateDescription: pluginConfig.generateDescription,
            generateImage: pluginConfig.generateImage,
            generateURL: pluginConfig.generateURL,
          },
          targetCollections,
          targetGlobals,
        ),
      },
    ]

    // Dashboard: audit endpoint
    if (features.dashboard) {
      pluginEndpoints.push({
        path: `${basePath}/audit`,
        method: 'get',
        // Poll-friendly limiter: the dashboard polls this every 3s while the background build runs.
        handler: withRateLimit(createAuditHandler(targetCollections, seoConfig, targetGlobals, pluginConfig.auditCacheFile), auditPollLimiter),
      })
      // Indexation hygiene audit — cross-page noindex / canonical problems in one place
      pluginEndpoints.push({
        path: `${basePath}/indexation-audit`,
        method: 'get',
        handler: withRateLimit(createIndexationAuditHandler(targetCollections, seoConfig, targetGlobals)),
      })
    }

    // Score history
    if (features.scoreHistory) {
      pluginEndpoints.push({
        path: `${basePath}/history`,
        method: 'get',
        handler: createHistoryHandler(),
      })
    }

    // Sitemap audit
    if (features.sitemapAudit) {
      pluginEndpoints.push(
        {
          path: `${basePath}/sitemap-audit`,
          method: 'get',
          handler: withRateLimit(createSitemapAuditHandler(targetCollections, redirectsSlug, pluginConfig.knownRoutes || [])),
        },
        {
          path: `${basePath}/sitemap-config`,
          method: 'get',
          handler: createSitemapConfigHandler(targetCollections),
        },
      )
    }

    // Settings
    if (features.settings) {
      pluginEndpoints.push(
        { path: `${basePath}/settings`, method: 'get', handler: createSettingsHandler() },
        { path: `${basePath}/settings`, method: 'patch', handler: createSettingsHandler() },
      )
    }

    // Internal linking (suggest-links + breadcrumb — part of analyzer core helpers)
    pluginEndpoints.push(
      {
        path: `${basePath}/suggest-links`,
        method: 'post',
        handler: createSuggestLinksHandler(targetCollections, targetGlobals),
      },
      {
        path: `${basePath}/breadcrumb`,
        method: 'get',
        handler: createBreadcrumbHandler(targetCollections),
      },
    )

    // Redirects (CRUD + chain detection + auto-create)
    if (features.redirects) {
      const rSlug = pluginConfig.redirectsCollection ?? 'seo-redirects'
      pluginEndpoints.push(
        { path: `${basePath}/create-redirect`, method: 'post', handler: createRedirectHandler(rSlug) },
        { path: `${basePath}/redirects`, method: 'get', handler: createRedirectsHandler(rSlug) },
        { path: `${basePath}/redirects`, method: 'post', handler: createRedirectsHandler(rSlug) },
        { path: `${basePath}/redirects`, method: 'patch', handler: createRedirectsHandler(rSlug) },
        { path: `${basePath}/redirects`, method: 'delete', handler: createRedirectsHandler(rSlug) },
        { path: `${basePath}/redirect-chains`, method: 'get', handler: withRateLimit(createRedirectChainsHandler(rSlug)) },
      )
    }

    // AI features (generate + rewrite + optimize)
    if (features.aiFeatures) {
      pluginEndpoints.push(
        { path: `${basePath}/ai-generate`, method: 'post', handler: createAiGenerateHandler() },
        { path: `${basePath}/ai-rewrite`, method: 'post', handler: createAiRewriteHandler(targetCollections) },
        { path: `${basePath}/ai-optimize`, method: 'post', handler: createAiOptimizeHandler(targetCollections, seoConfig) },
        { path: `${basePath}/alt-text-audit`, method: 'get', handler: createAltTextAuditHandler(uploadsCollection) },
        { path: `${basePath}/ai-alt-text`, method: 'post', handler: withRateLimit(createAiAltTextHandler(uploadsCollection, seoConfig)) },
        { path: `${basePath}/ai-content-brief`, method: 'post', handler: withRateLimit(createAiContentBriefHandler(targetCollections, seoConfig)) },
        { path: `${basePath}/ai-optimize-bulk`, method: 'post', handler: withRateLimit(createAiOptimizeBulkHandler(targetCollections, seoConfig)) },
      )
    }

    // Cannibalization detection
    if (features.cannibalization) {
      pluginEndpoints.push({
        path: `${basePath}/cannibalization`,
        method: 'get',
        handler: withRateLimit(createCannibalizationHandler(targetCollections, targetGlobals)),
      })
    }

    // External links checker
    if (features.externalLinks) {
      pluginEndpoints.push({
        path: `${basePath}/external-links`,
        method: 'post',
        handler: withRateLimit(createExternalLinksHandler(targetCollections, targetGlobals)),
      })
    }

    // Performance (GSC import)
    if (features.performance) {
      pluginEndpoints.push(
        { path: `${basePath}/performance`, method: 'get', handler: withRateLimit(createPerformanceHandler()) },
        { path: `${basePath}/performance`, method: 'post', handler: withRateLimit(createPerformanceHandler()) },
        // Core Web Vitals via PageSpeed Insights — informational, on-demand, SSRF-safe
        { path: `${basePath}/core-web-vitals`, method: 'get', handler: withRateLimit(createCoreWebVitalsHandler(seoConfig)) },
      )
    }

    // Google Search Console (OAuth2) — opt-in (requires Google Cloud setup + secrets)
    if (features.gscApi) {
      pluginEndpoints.push(
        { path: `${basePath}/gsc/status`, method: 'get', handler: createGscStatusHandler(basePath, seoConfig) },
        { path: `${basePath}/gsc/auth`, method: 'get', handler: createGscAuthStartHandler(basePath, seoConfig) },
        { path: `${basePath}/gsc/callback`, method: 'get', handler: createGscCallbackHandler(basePath, seoConfig) },
        { path: `${basePath}/gsc/data`, method: 'get', handler: withRateLimit(createGscDataHandler(basePath, seoConfig)) },
        { path: `${basePath}/gsc/disconnect`, method: 'post', handler: createGscDisconnectHandler() },
        { path: `${basePath}/rank-snapshot`, method: 'post', handler: withRateLimit(createRankSnapshotHandler(basePath, seoConfig)) },
        { path: `${basePath}/rank-history`, method: 'get', handler: createRankHistoryHandler() },
        { path: `${basePath}/ctr-opportunities`, method: 'get', handler: createCtrOpportunitiesHandler(basePath, targetCollections, seoConfig) },
        // Content grade (Surfer/Clearscope-lite via GSC) — A–F grade of ONE doc vs its real queries
        { path: `${basePath}/content-grade`, method: 'get', handler: withRateLimit(createContentGradeHandler(basePath, targetCollections, seoConfig)) },
      )
    }

    // Monitoring & alerts (opt-in)
    if (features.alerts) {
      pluginEndpoints.push(
        { path: `${basePath}/alerts-digest`, method: 'get', handler: createAlertsDigestHandler() },
        { path: `${basePath}/alerts-run`, method: 'post', handler: withRateLimit(createAlertsRunHandler(resolveGscSiteUrl(seoConfig))) },
      )
    }

    // IndexNow — proactive indexing (opt-in). Key file is PUBLIC (search engines verify it).
    if (features.indexNow) {
      pluginEndpoints.push(
        { path: `${basePath}/indexnow-key.txt`, method: 'get', handler: createIndexNowKeyHandler() },
        { path: `${basePath}/indexnow-submit`, method: 'post', handler: withRateLimit(createIndexNowSubmitHandler(basePath, targetCollections, seoConfig)) },
      )
    }

    // Keyword research
    if (features.keywords) {
      pluginEndpoints.push({
        path: `${basePath}/keyword-research`,
        method: 'get',
        handler: withRateLimit(createKeywordResearchHandler(targetCollections, targetGlobals)),
      })
    }

    // Link graph
    if (features.linkGraph) {
      pluginEndpoints.push({
        path: `${basePath}/link-graph`,
        method: 'get',
        handler: withRateLimit(createLinkGraphHandler(targetCollections, targetGlobals)),
      })
    }

    // SEO Logs (404 tracking)
    if (features.seoLogs) {
      pluginEndpoints.push(
        { path: `${basePath}/seo-logs`, method: 'get', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
        { path: `${basePath}/seo-logs`, method: 'post', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
        { path: `${basePath}/seo-logs`, method: 'delete', handler: createSeoLogsHandler(pluginConfig.seoLogsSecret) },
      )
    }

    // Schema.org JSON-LD generator
    if (features.schemaBuilder) {
      pluginEndpoints.push({
        path: `${basePath}/schema-generator`,
        method: 'get',
        handler: createSchemaGeneratorHandler(targetCollections),
      })
    }

    // Duplicate content detection
    if (features.duplicateContent) {
      pluginEndpoints.push({
        path: `${basePath}/duplicate-content`,
        method: 'get',
        handler: withRateLimit(createDuplicateContentHandler(targetCollections)),
      })
    }

    // Module health / observability — always active (admin-only inside)
    pluginEndpoints.push({
      path: `${basePath}/health`,
      method: 'get' as const,
      handler: createSeoHealthHandler(basePath, seoConfig),
    })

    // robots.txt and sitemap.xml — always active (public endpoints)
    pluginEndpoints.push(
      {
        path: `${basePath}/robots.txt`,
        method: 'get' as const,
        handler: createRobotsHandler(targetCollections),
      },
      {
        path: `${basePath}/robots.txt`,
        method: 'post' as const,
        handler: createRobotsUpdateHandler(),
      },
      {
        path: `${basePath}/sitemap.xml`,
        method: 'get' as const,
        handler: createSitemapHandler(targetCollections),
      },
      {
        // AI discoverability (opt-in via SEO_LLMS_TXT=1; returns 404 when disabled). Not scored.
        path: `${basePath}/llms.txt`,
        method: 'get' as const,
        handler: createLlmsTxtHandler(targetCollections, seoConfig),
      },
      {
        path: `${basePath}/sitemap-news.xml`,
        method: 'get' as const,
        handler: createNewsSitemapHandler(targetCollections, seoConfig),
      },
      {
        path: `${basePath}/sitemap-images.xml`,
        method: 'get' as const,
        handler: createImageSitemapHandler(targetCollections, seoConfig),
      },
      {
        path: `${basePath}/sitemap-video.xml`,
        method: 'get' as const,
        handler: createVideoSitemapHandler(targetCollections, seoConfig),
      },
    )

    config.endpoints = [
      ...(config.endpoints || []),
      ...pluginEndpoints,
    ]

    // 3. Add admin views + nav link (conditionally based on features)
    // At least one view-based feature must be enabled to inject admin components
    const hasAnyView = features.dashboard || features.sitemapAudit || features.settings
      || features.redirects || features.cannibalization || features.performance
      || features.keywords || features.schemaBuilder || features.linkGraph

    if (pluginConfig.addDashboardView !== false && hasAnyView) {
      if (!config.admin) config.admin = {}
      if (!config.admin.components) config.admin.components = {}
      if (!config.admin.components.views) config.admin.components.views = {}

      const views = config.admin.components.views as Record<string, unknown>

      if (features.dashboard) {
        views.seo = {
          Component: '@consilioweb/payload-seo-analyzer/views#SeoView',
          path: '/seo',
        }
      }

      if (features.sitemapAudit && pluginConfig.addSitemapAuditView !== false) {
        views['sitemap-audit'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#SitemapAuditView',
          path: '/sitemap-audit',
        }
      }

      if (features.settings) {
        views['seo-config'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#SeoConfigView',
          path: '/seo-config',
        }
      }

      if (features.redirects) {
        views['redirects'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#RedirectManagerView',
          path: '/redirects',
        }
      }

      if (features.cannibalization) {
        views['cannibalization'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#CannibalizationView',
          path: '/cannibalization',
        }
      }

      if (features.performance) {
        views['performance'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#PerformanceView',
          path: '/performance',
        }
      }

      if (features.keywords) {
        views['keyword-research'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#KeywordResearchView',
          path: '/keyword-research',
        }
      }

      if (features.schemaBuilder) {
        views['schema-builder'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#SchemaBuilderView',
          path: '/schema-builder',
        }
      }

      if (features.linkGraph) {
        views['link-graph'] = {
          Component: '@consilioweb/payload-seo-analyzer/views#LinkGraphView',
          path: '/link-graph',
        }
      }

      // Inject nav link into admin sidebar
      const navLinks = config.admin.components.afterNavLinks || []
      config.admin.components.afterNavLinks = [
        ...(Array.isArray(navLinks) ? navLinks : [navLinks]),
        '@consilioweb/payload-seo-analyzer/client#SeoNavLink',
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

    // 5. Register custom dashboard translations if provided
    if (pluginConfig.customTranslations) {
      for (const [locale, translations] of Object.entries(pluginConfig.customTranslations)) {
        registerDashboardTranslations(locale, translations)
      }
    }

    // 5. Add cache warm-up on server init
    const existingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (existingOnInit) await existingOnInit(payload)
      // Skip startup pre-loading on low-memory hosts (features.warmCache: false)
      if (features.warmCache) {
        startCacheWarmUp(payload, basePath, targetGlobals, targetCollections)
      }
      // Daily GSC rank snapshots (only when Search Console is enabled)
      if (features.gscApi) {
        startRankTracker(payload, basePath, seoConfig)
      }
      // Proactive monitoring digest (only when alerts are enabled)
      if (features.alerts) {
        startAlertsScheduler(payload, resolveGscSiteUrl(seoConfig))
      }
    }

    return config
  }

/** @deprecated Use `seoAnalyzerPlugin` instead. Kept for backward compatibility. */
export { seoAnalyzerPlugin as seoPlugin }
