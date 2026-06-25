import { describe, it, expect } from 'vitest'
import { seoAnalyzerPlugin } from '../plugin.js'

// Minimal Payload config the plugin transforms. Cast loosely — we only assert what the plugin
// adds (endpoints, collections, fields, hooks), not full Payload typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function baseConfig(): any {
  return {
    collections: [
      { slug: 'pages', fields: [] },
      { slug: 'posts', fields: [] },
      { slug: 'media', fields: [], upload: true },
      { slug: 'users', fields: [], auth: true },
    ],
    globals: [],
    endpoints: [],
    admin: {},
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paths = (out: any): string[] => (out.endpoints || []).map((e: any) => e.path)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slugs = (out: any): string[] => (out.collections || []).map((c: any) => c.slug)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(pluginConfig: any) {
  return seoAnalyzerPlugin(pluginConfig)(baseConfig())
}

describe('seoAnalyzerPlugin — integration (config transform)', () => {
  it('registers the always-on endpoints', () => {
    const out = run({ collections: ['pages', 'posts'] })
    const p = paths(out)
    for (const expected of [
      '/seo-plugin/validate',
      '/seo-plugin/audit',
      '/seo-plugin/health',
      '/seo-plugin/sitemap.xml',
      '/seo-plugin/robots.txt',
    ]) {
      expect(p).toContain(expected)
    }
  })

  it('adds the SEO tab + meta fields to target collections only', () => {
    const out = run({ collections: ['pages', 'posts'] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = out.collections.find((c: any) => c.slug === 'pages')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = out.collections.find((c: any) => c.slug === 'users')
    expect(pages.fields.length).toBeGreaterThan(0)
    // SEO fields were injected (focusKeyword is part of seoFields) — wrapping in a tabs field
    // is an implementation detail that depends on the collection's existing fields.
    expect(JSON.stringify(pages.fields)).toContain('focusKeyword')
    // Non-target collection untouched
    expect(users.fields.length).toBe(0)
  })

  it('registers default-on feature collections (history, redirects, settings)', () => {
    const out = run({ collections: ['pages', 'posts'] })
    const s = slugs(out)
    expect(s).toContain('seo-score-history')
    expect(s).toContain('seo-redirects')
    expect(s).toContain('seo-settings')
    // gscApi off by default → no GSC collections
    expect(s).not.toContain('seo-gsc-auth')
    expect(s).not.toContain('seo-rank-history')
  })

  it('registers AI endpoints when aiFeatures is on (default)', () => {
    const p = paths(run({ collections: ['pages', 'posts'] }))
    expect(p).toContain('/seo-plugin/ai-optimize')
    expect(p).toContain('/seo-plugin/ai-optimize-bulk')
    expect(p).toContain('/seo-plugin/ai-content-brief')
    expect(p).toContain('/seo-plugin/ai-alt-text')
  })

  it('gates AI endpoints off when aiFeatures is false', () => {
    const p = paths(run({ collections: ['pages', 'posts'], features: { aiFeatures: false } }))
    expect(p).not.toContain('/seo-plugin/ai-optimize')
    expect(p).not.toContain('/seo-plugin/ai-optimize-bulk')
  })

  it('enables GSC suite (collections + endpoints) when gscApi is on', () => {
    const out = run({ collections: ['pages', 'posts'], features: { gscApi: true } })
    expect(slugs(out)).toContain('seo-gsc-auth')
    expect(slugs(out)).toContain('seo-rank-history')
    const p = paths(out)
    expect(p).toContain('/seo-plugin/rank-history')
    expect(p).toContain('/seo-plugin/ctr-opportunities')
    expect(p).toContain('/seo-plugin/gsc/status')
  })

  it('enables alerts + indexNow endpoints + hook when opted in', () => {
    const out = run({ collections: ['pages', 'posts'], features: { alerts: true, indexNow: true } })
    const p = paths(out)
    expect(p).toContain('/seo-plugin/alerts-digest')
    expect(p).toContain('/seo-plugin/indexnow-key.txt')
    // IndexNow adds an afterChange hook to target collections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = out.collections.find((c: any) => c.slug === 'pages')
    const after = pages.hooks?.afterChange || []
    expect(Array.isArray(after) ? after.length : 0).toBeGreaterThan(0)
  })

  it('wires a beforeChange redirect hook on target collections by default', () => {
    const out = run({ collections: ['pages', 'posts'] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = out.collections.find((c: any) => c.slug === 'pages')
    const before = pages.hooks?.beforeChange || []
    expect(Array.isArray(before) ? before.length : 0).toBeGreaterThan(0)
  })

  it('respects a custom endpointBasePath', () => {
    const p = paths(run({ collections: ['pages', 'posts'], endpointBasePath: '/seo' }))
    expect(p).toContain('/seo/validate')
    expect(p).toContain('/seo/health')
  })

  it('sets an onInit function (composes with existing)', () => {
    const out = run({ collections: ['pages', 'posts'] })
    expect(typeof out.onInit).toBe('function')
  })
})
