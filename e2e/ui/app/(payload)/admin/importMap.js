/**
 * Payload import map for the e2e UI harness.
 *
 * Maps every custom component the SEO plugin injects (9 admin views + the nav
 * link + 6 meta/analyzer field components) to its real implementation so the
 * admin can resolve them at runtime.
 *
 * This is hand-authored on purpose so the harness works WITHOUT a generate step.
 * It stays in sync with the `Component: '@consilioweb/payload-seo-analyzer/...#X'`
 * strings registered in the plugin (see `src/plugin.ts`, `src/metaFields.ts`,
 * `src/fields.ts`). If the plugin adds/renames a view or field component,
 * regenerate it with `npm run generate:importmap` (overwrites this file).
 */
import {
  CannibalizationView,
  KeywordResearchView,
  LinkGraphView,
  PerformanceView,
  RedirectManagerView,
  SchemaBuilderView,
  SeoConfigView,
  SeoView,
  SitemapAuditView,
} from '@consilioweb/payload-seo-analyzer/views'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  SeoAnalyzerField,
  SeoNavLink,
  SerpPreviewField,
} from '@consilioweb/payload-seo-analyzer/client'

export const importMap = {
  // Admin views (server components, wrapped in DefaultTemplate)
  '@consilioweb/payload-seo-analyzer/views#SeoView': SeoView,
  '@consilioweb/payload-seo-analyzer/views#PerformanceView': PerformanceView,
  '@consilioweb/payload-seo-analyzer/views#LinkGraphView': LinkGraphView,
  '@consilioweb/payload-seo-analyzer/views#SitemapAuditView': SitemapAuditView,
  '@consilioweb/payload-seo-analyzer/views#SchemaBuilderView': SchemaBuilderView,
  '@consilioweb/payload-seo-analyzer/views#CannibalizationView': CannibalizationView,
  '@consilioweb/payload-seo-analyzer/views#KeywordResearchView': KeywordResearchView,
  '@consilioweb/payload-seo-analyzer/views#RedirectManagerView': RedirectManagerView,
  '@consilioweb/payload-seo-analyzer/views#SeoConfigView': SeoConfigView,

  // Sidebar nav link (client component, injected via afterNavLinks)
  '@consilioweb/payload-seo-analyzer/client#SeoNavLink': SeoNavLink,

  // Meta + analyzer field components (client components on target collections)
  '@consilioweb/payload-seo-analyzer/client#SeoAnalyzerField': SeoAnalyzerField,
  '@consilioweb/payload-seo-analyzer/client#OverviewField': OverviewField,
  '@consilioweb/payload-seo-analyzer/client#MetaTitleField': MetaTitleField,
  '@consilioweb/payload-seo-analyzer/client#MetaDescriptionField': MetaDescriptionField,
  '@consilioweb/payload-seo-analyzer/client#MetaImageField': MetaImageField,
  '@consilioweb/payload-seo-analyzer/client#SerpPreviewField': SerpPreviewField,
}
