/**
 * Payload CMS SEO Plugin.
 *
 * Adds SEO analysis capabilities to any Payload CMS project:
 * - SEO fields (focusKeyword, focusKeywords, isCornerstone) on target collections
 * - SeoAnalyzer UI component in the editor sidebar (real-time SEO scoring)
 * - SEO dashboard admin view at /admin/seo
 * - API endpoints for validation, keyword dedup, and audit
 *
 * Usage:
 *   import { seoPlugin } from '@consilioweb/seo-analyzer'
 *
 *   export default buildConfig({
 *     plugins: [
 *       seoPlugin({ collections: ['pages', 'posts'] }),
 *     ],
 *   })
 */

import type { Config, Plugin } from 'payload'
import type { SeoConfig, RuleGroup, SeoThresholds } from './types.js'
import { seoFields } from './fields.js'
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
import { startCacheWarmUp } from './warmCache.js'

export interface SeoPluginConfig {
  /** Collections to add SEO fields to (default: ['pages', 'posts']) */
  collections?: string[]
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

export const seoPlugin =
  (pluginConfig: SeoPluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const targetCollections = pluginConfig.collections ?? ['pages', 'posts']
    const basePath = pluginConfig.endpointBasePath ?? '/seo-plugin'
    const seoConfig = buildSeoConfig(pluginConfig)

    const trackHistory = pluginConfig.trackScoreHistory !== false

    // 1. Add SEO fields + afterChange hook to target collections
    if (config.collections) {
      config.collections = config.collections.map((collection) => {
        if (targetCollections.includes(collection.slug)) {
          const updated = {
            ...collection,
            fields: [...(collection.fields || []), ...seoFields()],
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
        handler: createCheckKeywordHandler(targetCollections),
      },
      {
        path: `${basePath}/audit`,
        method: 'get' as const,
        handler: createAuditHandler(targetCollections, seoConfig),
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
        handler: createSuggestLinksHandler(targetCollections),
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
      // Keyword cannibalization detection
      {
        path: `${basePath}/cannibalization`,
        method: 'get' as const,
        handler: createCannibalizationHandler(targetCollections),
      },
      // External links checker
      {
        path: `${basePath}/external-links`,
        method: 'post' as const,
        handler: createExternalLinksHandler(targetCollections),
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
        handler: createKeywordResearchHandler(targetCollections),
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
        handler: createLinkGraphHandler(targetCollections),
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

    // 4. Add cache warm-up on server init
    const existingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (existingOnInit) await existingOnInit(payload)
      startCacheWarmUp(payload, basePath)
    }

    return config
  }
