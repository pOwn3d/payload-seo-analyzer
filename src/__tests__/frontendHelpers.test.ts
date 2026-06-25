import { describe, it, expect } from 'vitest'
import { buildJsonLd, detectSchemaType, renderJsonLdScript } from '../helpers/buildSchema.js'
import { buildSeoMetadata } from '../helpers/buildMetadata.js'

const SITE = 'https://example.com'

describe('buildJsonLd', () => {
  it('detects Article for posts', () => {
    expect(detectSchemaType('posts', {})).toBe('Article')
    const { type, jsonLd } = buildJsonLd({ title: 'T', meta: { description: 'D' } }, { collection: 'posts', siteUrl: SITE })
    expect(type).toBe('Article')
    expect(jsonLd['@type']).toBe('Article')
    expect(jsonLd.headline).toBe('T')
  })

  it('detects Product from product fields', () => {
    const { type, jsonLd } = buildJsonLd(
      { title: 'Widget', slug: 'widget', price: 9.9, meta: { description: 'A widget' } },
      { collection: 'products', siteUrl: SITE },
    )
    expect(type).toBe('Product')
    expect((jsonLd.offers as Record<string, unknown>).price).toBe(9.9)
    expect((jsonLd.offers as Record<string, unknown>).priceCurrency).toBe('EUR')
  })

  it('honours an explicit type override', () => {
    const { type } = buildJsonLd({ title: 'Org' }, { collection: 'pages', type: 'Organization', siteUrl: SITE })
    expect(type).toBe('Organization')
  })

  it('strips undefined values', () => {
    const { jsonLd } = buildJsonLd({ title: 'T' }, { collection: 'pages', type: 'Article', siteUrl: SITE })
    // datePublished/dateModified absent → must not appear as undefined keys
    expect(Object.values(jsonLd)).not.toContain(undefined)
    expect('datePublished' in jsonLd).toBe(false)
  })

  it('renderJsonLdScript wraps the JSON in a script tag', () => {
    const html = renderJsonLdScript({ title: 'T' }, { collection: 'pages', type: 'Article', siteUrl: SITE })
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(html).toContain('"@type":"Article"')
  })
})

describe('buildJsonLd — LocalBusiness multi-location', () => {
  it('emits a single node when there are no locations (legacy behavior)', () => {
    const { jsonLd } = buildJsonLd(
      { title: 'Agence', slug: 'agence', telephone: '0102030405', address: { streetAddress: '1 rue X' } },
      { collection: 'pages', type: 'LocalBusiness', siteUrl: SITE },
    )
    expect(jsonLd['@type']).toBe('LocalBusiness')
    expect(jsonLd.telephone).toBe('0102030405')
    expect((jsonLd.address as Record<string, unknown>)['@type']).toBe('PostalAddress')
    expect(jsonLd['@graph']).toBeUndefined()
  })

  it('emits a @graph of LocalBusiness nodes for multiple locations', () => {
    const { jsonLd } = buildJsonLd(
      {
        title: 'Chain',
        slug: 'chain',
        locations: [
          { name: 'Paris', telephone: '01', geo: { latitude: 48.8, longitude: 2.3 }, openingHours: ['Mo-Fr 09:00-18:00'] },
          { name: 'Lyon', telephone: '04', lat: 45.7, lng: 4.8 },
        ],
      },
      { collection: 'pages', type: 'LocalBusiness', siteUrl: SITE },
    )
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>
    expect(Array.isArray(graph)).toBe(true)
    expect(graph).toHaveLength(2)
    expect(graph[0].name).toBe('Paris')
    expect((graph[0].geo as Record<string, unknown>)['@type']).toBe('GeoCoordinates')
    expect(graph[0].openingHours).toEqual(['Mo-Fr 09:00-18:00'])
    expect((graph[1].geo as Record<string, unknown>).latitude).toBe(45.7)
  })
})

describe('buildSeoMetadata', () => {
  const doc = {
    title: 'Fallback',
    slug: 'about',
    meta: { title: 'About us', description: 'Who we are' },
  }

  it('maps meta title/description', () => {
    const md = buildSeoMetadata(doc, { siteUrl: SITE })
    expect(md.title).toBe('About us')
    expect(md.description).toBe('Who we are')
  })

  it('applies the title template', () => {
    const md = buildSeoMetadata(doc, { siteUrl: SITE, titleTemplate: '%s | Acme' })
    expect(md.title).toBe('About us | Acme')
  })

  it('derives canonical from siteUrl + slug', () => {
    const md = buildSeoMetadata(doc, { siteUrl: SITE })
    expect(md.alternates?.canonical).toBe('https://example.com/about')
  })

  it('prefers an explicit canonical', () => {
    const md = buildSeoMetadata({ ...doc, meta: { ...doc.meta, canonicalUrl: 'https://canonical.test/x' } }, { siteUrl: SITE })
    expect(md.alternates?.canonical).toBe('https://canonical.test/x')
  })

  it('reflects noindex/nofollow in robots', () => {
    const md = buildSeoMetadata({ ...doc, noindex: true }, { siteUrl: SITE })
    expect(md.robots).toEqual({ index: false, follow: true })
    const md2 = buildSeoMetadata({ ...doc, robots: 'noindex, nofollow' }, { siteUrl: SITE })
    expect(md2.robots).toEqual({ index: false, follow: false })
  })

  it('builds hreflang languages from localeAlternates', () => {
    const md = buildSeoMetadata(
      { ...doc, localeAlternates: [{ hreflang: 'fr', href: `${SITE}/fr/about` }, { hreflang: 'en', href: `${SITE}/en/about` }] },
      { siteUrl: SITE },
    )
    expect(md.alternates?.languages).toEqual({ fr: `${SITE}/fr/about`, en: `${SITE}/en/about` })
  })

  it('sets OG type article for posts and twitter card by image presence', () => {
    const md = buildSeoMetadata({ ...doc, meta: { ...doc.meta, image: { url: '/media/x.jpg' } } }, { collection: 'posts', siteUrl: SITE })
    expect(md.openGraph?.type).toBe('article')
    expect(md.openGraph?.images?.[0].url).toBe('https://example.com/media/x.jpg')
    expect(md.twitter?.card).toBe('summary_large_image')
  })

  it('defaults twitter card to summary without an image', () => {
    const md = buildSeoMetadata(doc, { siteUrl: SITE })
    expect(md.twitter?.card).toBe('summary')
    expect(md.openGraph?.type).toBe('website')
  })
})
