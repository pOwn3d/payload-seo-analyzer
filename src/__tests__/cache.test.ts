import { describe, it, expect, beforeEach } from 'vitest'
import { seoCache } from '../cache.js'

describe('seoCache.invalidateByPrefix — locale-aware invalidation', () => {
  beforeEach(() => {
    seoCache.invalidate()
  })

  it('clears all locale-scoped variants of a base key', () => {
    seoCache.set('audit:fr', { score: 1 })
    seoCache.set('audit:en', { score: 2 })
    seoCache.set('audit', { score: 3 })

    seoCache.invalidateByPrefix('audit')

    expect(seoCache.get('audit:fr')).toBeNull()
    expect(seoCache.get('audit:en')).toBeNull()
    expect(seoCache.get('audit')).toBeNull()
  })

  it('clears param-scoped variants (base-<param> and base:<locale>:<param>)', () => {
    seoCache.set('duplicate-content:fr:0.7', { a: 1 })
    seoCache.set('duplicate-content:en:0.8', { a: 2 })

    seoCache.invalidateByPrefix('duplicate-content')

    expect(seoCache.get('duplicate-content:fr:0.7')).toBeNull()
    expect(seoCache.get('duplicate-content:en:0.8')).toBeNull()
  })

  it('does not clear unrelated keys', () => {
    seoCache.set('audit:fr', { score: 1 })
    seoCache.set('link-graph:fr', { nodes: [] })

    seoCache.invalidateByPrefix('audit')

    expect(seoCache.get('audit:fr')).toBeNull()
    expect(seoCache.get('link-graph:fr')).not.toBeNull()
  })
})
