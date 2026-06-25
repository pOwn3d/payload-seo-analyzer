import { describe, it, expect } from 'vitest'
import { normalizeToSlug, resolveToDocSlug } from '../helpers/linkExtractor'

describe('normalizeToSlug', () => {
  it('strips leading slash, anchors and query strings', () => {
    expect(normalizeToSlug('/posts/my-post')).toBe('posts/my-post')
    expect(normalizeToSlug('/contact#form')).toBe('contact')
    expect(normalizeToSlug('/search?q=x')).toBe('search')
    expect(normalizeToSlug('/')).toBe('home')
  })

  it('ignores external / non-page links', () => {
    expect(normalizeToSlug('https://example.com')).toBeNull()
    expect(normalizeToSlug('mailto:a@b.c')).toBeNull()
    expect(normalizeToSlug('#')).toBeNull()
  })
})

describe('resolveToDocSlug', () => {
  const allSlugs = new Set([
    'seo-local-limoges', // a post (bare slug, served at /posts/seo-local-limoges)
    'services/creation-site-internet', // a nested page (served at /services/creation-site-internet)
    'agence-web-limoges', // a top-level page
  ])
  const routePrefixes = new Set(['posts', 'pages'])

  it('returns the slug unchanged when it already matches a document', () => {
    expect(resolveToDocSlug('agence-web-limoges', allSlugs, routePrefixes)).toBe('agence-web-limoges')
    expect(resolveToDocSlug('services/creation-site-internet', allSlugs, routePrefixes)).toBe(
      'services/creation-site-internet',
    )
  })

  it('strips a known collection-route prefix so /posts/<slug> resolves to the post', () => {
    // This is the core fix: posts linked via their public route must NOT be flagged broken.
    expect(resolveToDocSlug('posts/seo-local-limoges', allSlugs, routePrefixes)).toBe('seo-local-limoges')
  })

  it('leaves a genuinely missing target unchanged (still detectable as broken)', () => {
    expect(resolveToDocSlug('posts/deleted-post', allSlugs, routePrefixes)).toBe('posts/deleted-post')
    expect(resolveToDocSlug('does-not-exist', allSlugs, routePrefixes)).toBe('does-not-exist')
  })

  it('does not strip a prefix that is not a known route', () => {
    expect(resolveToDocSlug('random/seo-local-limoges', allSlugs, routePrefixes)).toBe(
      'random/seo-local-limoges',
    )
  })
})
