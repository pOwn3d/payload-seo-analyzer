import { describe, it, expect } from 'vitest'
import { buildDocPath, buildDocUrl, DEFAULT_COLLECTION_ROUTES } from '../helpers/docUrl.js'
import { buildSeoMetadata } from '../helpers/buildMetadata.js'
import { buildJsonLd } from '../helpers/buildSchema.js'
import { docToUrl } from '../endpoints/indexNow.js'

const SITE = 'https://example.com'

describe('buildDocPath', () => {
  it('prefixes posts with their collection route by default', () => {
    expect(buildDocPath('mon-article', 'posts')).toBe('/posts/mon-article')
    expect(DEFAULT_COLLECTION_ROUTES.posts).toBe('posts')
  })

  it('leaves other collections flat', () => {
    expect(buildDocPath('a-propos', 'pages')).toBe('/a-propos')
    expect(buildDocPath('a-propos')).toBe('/a-propos')
  })

  it('returns an empty path for the home page', () => {
    expect(buildDocPath('home', 'pages')).toBe('')
    expect(buildDocPath('', 'pages')).toBe('')
    expect(buildDocPath('home', 'posts')).toBe('')
  })

  it('lets a host opt out of the posts prefix', () => {
    expect(buildDocPath('mon-article', 'posts', { posts: '' })).toBe('/mon-article')
  })

  it('supports a custom prefix per collection', () => {
    expect(buildDocPath('vitrine', 'projects', { projects: 'work' })).toBe('/work/vitrine')
    expect(buildDocPath('vitrine', 'projects', { projects: '/work/' })).toBe('/work/vitrine')
  })

  it('never doubles a prefix already present in the slug', () => {
    expect(buildDocPath('posts/mon-article', 'posts')).toBe('/posts/mon-article')
  })

  it('builds an absolute URL without a double slash', () => {
    expect(buildDocUrl(`${SITE}/`, 'mon-article', 'posts')).toBe(`${SITE}/posts/mon-article`)
    expect(buildDocUrl(SITE, 'home', 'pages')).toBe(SITE)
  })
})

// Regression: the canonical used to be siteUrl + '/' + slug for every
// collection, so a post advertised a canonical that 404s.
describe('canonical URL', () => {
  it('prefixes the canonical of a post', () => {
    const md = buildSeoMetadata(
      { slug: 'mon-article', title: 'T' },
      { collection: 'posts', siteUrl: SITE },
    )
    expect(md.alternates?.canonical).toBe(`${SITE}/posts/mon-article`)
    expect(md.openGraph?.url).toBe(`${SITE}/posts/mon-article`)
  })

  it('leaves a page canonical flat', () => {
    const md = buildSeoMetadata(
      { slug: 'a-propos', title: 'T' },
      { collection: 'pages', siteUrl: SITE },
    )
    expect(md.alternates?.canonical).toBe(`${SITE}/a-propos`)
  })

  it('honours an explicit canonical over the computed one', () => {
    const md = buildSeoMetadata(
      { slug: 'mon-article', meta: { canonicalUrl: 'https://other.example/x' } },
      { collection: 'posts', siteUrl: SITE },
    )
    expect(md.alternates?.canonical).toBe('https://other.example/x')
  })

  it('can be opted out per collection', () => {
    const md = buildSeoMetadata(
      { slug: 'mon-article', title: 'T' },
      { collection: 'posts', siteUrl: SITE, collectionRoutes: { posts: '' } },
    )
    expect(md.alternates?.canonical).toBe(`${SITE}/mon-article`)
  })
})

describe('JSON-LD document URLs', () => {
  it('prefixes the Article @id', () => {
    const { jsonLd } = buildJsonLd(
      { slug: 'mon-article', title: 'T' },
      { collection: 'posts', type: 'Article', siteUrl: SITE },
    )
    const mainEntity = jsonLd.mainEntityOfPage as Record<string, unknown>
    expect(mainEntity['@id']).toBe(`${SITE}/posts/mon-article`)
  })

  it('prefixes the Event url', () => {
    const { jsonLd } = buildJsonLd(
      { slug: 'mon-event', title: 'E' },
      { collection: 'posts', type: 'Event', siteUrl: SITE },
    )
    expect(jsonLd.url).toBe(`${SITE}/posts/mon-event`)
  })

  it('keeps a pages document flat', () => {
    const { jsonLd } = buildJsonLd(
      { slug: 'agence', title: 'A' },
      { collection: 'pages', type: 'LocalBusiness', siteUrl: SITE },
    )
    expect(jsonLd.url).toBe(`${SITE}/agence`)
  })
})

describe('IndexNow docToUrl', () => {
  it('stays flat without a collection (backward compatible)', () => {
    expect(docToUrl('a-propos', SITE)).toBe(`${SITE}/a-propos`)
  })

  it('prefixes when the collection is known', () => {
    expect(docToUrl('mon-article', SITE, 'posts')).toBe(`${SITE}/posts/mon-article`)
  })
})

// End-to-end regression on the public endpoint Googlebot actually reads.
describe('sitemap.xml loc', () => {
  function makePayload(docsByCollection: Record<string, Array<Record<string, unknown>>>) {
    return {
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      async find({ collection }: { collection: string }) {
        if (collection === 'seo-settings') return { docs: [], hasNextPage: false, totalDocs: 0 }
        const docs = docsByCollection[collection] || []
        return { docs, hasNextPage: false, totalDocs: docs.length }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('emits /posts/<slug> for posts and /<slug> for pages', async () => {
    const { createSitemapHandler } = await import('../endpoints/sitemap.js')
    process.env.NEXT_PUBLIC_SERVER_URL = SITE
    const req = {
      payload: makePayload({
        pages: [{ slug: 'home' }, { slug: 'a-propos' }],
        posts: [{ slug: 'mon-article' }],
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const res = await createSitemapHandler(['pages', 'posts'])(req)
    const xml = await res.text()

    expect(xml).toContain(`<loc>${SITE}</loc>`)
    expect(xml).toContain(`<loc>${SITE}/a-propos</loc>`)
    expect(xml).toContain(`<loc>${SITE}/posts/mon-article</loc>`)
    expect(xml).not.toContain(`<loc>${SITE}/mon-article</loc>`)
    delete process.env.NEXT_PUBLIC_SERVER_URL
  })
})

// The admin "Sitemap configuration" screen renders a preview of the entries
// sitemap.xml will publish (SeoConfigView.tsx). It used to build its own URLs
// (`/${slug}`) while sitemap.ts prefixed the collection route, so the screen
// advertised `/mon-article` for an entry actually published as
// `/posts/mon-article`. Lock the two generators together.
describe('sitemap-config preview matches sitemap.xml', () => {
  const DOCS = {
    pages: [{ slug: 'home' }, { slug: 'a-propos' }],
    posts: [{ slug: 'mon-article' }],
  }

  function makePayload() {
    return {
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      async find({ collection }: { collection: string }) {
        if (collection === 'seo-settings') return { docs: [], hasNextPage: false, totalDocs: 0 }
        const docs = (DOCS as Record<string, Array<Record<string, unknown>>>)[collection] || []
        return { docs, hasNextPage: false, totalDocs: docs.length }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('previews the same paths that sitemap.xml emits as <loc>', async () => {
    const { createSitemapConfigHandler } = await import('../endpoints/sitemapConfig.js')
    const { createSitemapHandler } = await import('../endpoints/sitemap.js')
    process.env.NEXT_PUBLIC_SERVER_URL = SITE

    const collections = ['pages', 'posts']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configReq = { user: { id: 1 }, payload: makePayload() } as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sitemapReq = { payload: makePayload() } as any

    const configRes = await createSitemapConfigHandler(collections)(configReq)
    const { preview } = (await configRes.json()) as { preview: Array<{ url: string; collection: string }> }
    const xml = await (await createSitemapHandler(collections)(sitemapReq)).text()

    expect(preview).toHaveLength(3)
    const post = preview.find((e) => e.collection === 'posts')
    expect(post?.url).toBe('/posts/mon-article')

    for (const entry of preview) {
      // The home page is previewed as '/' where the XML emits the bare site URL.
      const loc = entry.url === '/' ? SITE : `${SITE}${entry.url}`
      expect(xml).toContain(`<loc>${loc}</loc>`)
    }
    expect(xml).not.toContain(`<loc>${SITE}/mon-article</loc>`)

    delete process.env.NEXT_PUBLIC_SERVER_URL
  })

  it('follows the collectionRoutes opt-out on both sides', async () => {
    const { createSitemapConfigHandler } = await import('../endpoints/sitemapConfig.js')
    const { createSitemapHandler } = await import('../endpoints/sitemap.js')
    process.env.NEXT_PUBLIC_SERVER_URL = SITE

    const collections = ['posts']
    const seoConfig = { collectionRoutes: { posts: '' } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configReq = { user: { id: 1 }, payload: makePayload() } as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sitemapReq = { payload: makePayload() } as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configRes = await createSitemapConfigHandler(collections, seoConfig as any)(configReq)
    const { preview } = (await configRes.json()) as { preview: Array<{ url: string }> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xml = await (await createSitemapHandler(collections, seoConfig as any)(sitemapReq)).text()

    expect(preview[0]?.url).toBe('/mon-article')
    expect(xml).toContain(`<loc>${SITE}/mon-article</loc>`)

    delete process.env.NEXT_PUBLIC_SERVER_URL
  })
})
