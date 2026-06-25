/**
 * Wave 3 — Entities / topical authority (D1) + real schema validation (D2).
 *
 * Covers:
 *  - buildJsonLd entity enrichment: sameAs / knowsAbout / about / mentions / isPartOf
 *    (all optional, driven by present fields, never breaking the legacy output)
 *  - eeat AI-readiness checks (eeat-ai-author-entity, eeat-ai-evidence) — weight 0
 *  - schema completeness check (schema-required-fields) — Google-required matrix, offline
 */
import { describe, it, expect } from 'vitest'
import { buildJsonLd } from '../helpers/buildSchema.js'
import { checkEeat } from '../rules/eeat'
import { checkSchema } from '../rules/schema'
import { evaluateRequiredProperties, SCHEMA_REQUIREMENTS } from '../rules/schema-requirements'
import type { SeoInput, AnalysisContext } from '../types'

const SITE = 'https://example.com'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SeoInput> = {}): SeoInput {
  return {
    metaTitle: 'Guide complet du SEO en 2026',
    metaDescription: 'Tout ce qu’il faut savoir sur le référencement en 2026, données et sources à l’appui.',
    slug: 'guide-seo-2026',
    focusKeyword: 'seo 2026',
    ...overrides,
  }
}

function makeCtx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    fullText:
      'En 2026, 70% des recherches passent par des moteurs IA. Nous avons analysé 1200 pages et observé 3 tendances.',
    readabilityText: '',
    wordCount: 300,
    normalizedKeyword: 'seo 2026',
    secondaryNormalizedKeywords: [],
    allHeadings: [{ tag: 'h1', text: 'Guide SEO 2026' }],
    allLinks: [
      { url: '/services', text: 'Nos services' },
      { url: 'https://developers.google.com/search', text: 'Documentation Google' },
    ],
    imageStats: { total: 1, withAlt: 1, altTexts: ['Schéma SEO'] },
    sentences: [],
    isPost: true,
    pageType: 'blog',
    config: {},
    locale: 'fr',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// D1 — buildJsonLd entity enrichment
// ---------------------------------------------------------------------------

describe('buildJsonLd — author entity (sameAs / knowsAbout / url)', () => {
  it('enriches the Article author with url, sameAs and knowsAbout when available', () => {
    const { jsonLd } = buildJsonLd(
      {
        title: 'T',
        meta: { description: 'D' },
        populatedAuthors: [
          {
            name: 'Jane Doe',
            url: 'https://www.linkedin.com/in/janedoe',
            sameAs: ['https://www.wikidata.org/wiki/Q42', 'https://orcid.org/0000-0002-1825-0097'],
            knowsAbout: ['SEO', 'Content strategy'],
            jobTitle: 'Head of SEO',
          },
        ],
      },
      { collection: 'posts', siteUrl: SITE },
    )
    const author = (jsonLd.author as Record<string, unknown>[])[0]!
    expect(author['@type']).toBe('Person')
    expect(author.name).toBe('Jane Doe')
    expect(author.url).toBe('https://www.linkedin.com/in/janedoe')
    expect(author.sameAs).toEqual([
      'https://www.wikidata.org/wiki/Q42',
      'https://orcid.org/0000-0002-1825-0097',
    ])
    expect(author.knowsAbout).toEqual(['SEO', 'Content strategy'])
    expect(author.jobTitle).toBe('Head of SEO')
  })

  it('keeps the legacy minimal author shape when no entity fields are present', () => {
    const { jsonLd } = buildJsonLd(
      { title: 'T', meta: { description: 'D' }, populatedAuthors: [{ name: 'John' }] },
      { collection: 'posts', siteUrl: SITE },
    )
    const author = (jsonLd.author as Record<string, unknown>[])[0]!
    expect(author).toEqual({ '@type': 'Person', name: 'John' })
    expect('sameAs' in author).toBe(false)
    expect('knowsAbout' in author).toBe(false)
  })
})

describe('buildJsonLd — topical entities (about / mentions / isPartOf)', () => {
  it('emits about and mentions Thing nodes (strings and objects)', () => {
    const { jsonLd } = buildJsonLd(
      {
        title: 'T',
        meta: { description: 'D' },
        about: ['Référencement naturel'],
        mentions: [{ name: 'Google', sameAs: ['https://www.wikidata.org/wiki/Q95'] }],
        isPartOf: 'Série SEO',
      },
      { collection: 'posts', siteUrl: SITE },
    )
    expect(jsonLd.about).toEqual([{ '@type': 'Thing', name: 'Référencement naturel' }])
    expect(jsonLd.mentions).toEqual([
      { '@type': 'Thing', name: 'Google', sameAs: ['https://www.wikidata.org/wiki/Q95'] },
    ])
    expect(jsonLd.isPartOf).toEqual({ '@type': 'CreativeWork', name: 'Série SEO' })
  })

  it('omits about/mentions/isPartOf when absent (no empty keys)', () => {
    const { jsonLd } = buildJsonLd(
      { title: 'T', meta: { description: 'D' } },
      { collection: 'posts', siteUrl: SITE },
    )
    expect('about' in jsonLd).toBe(false)
    expect('mentions' in jsonLd).toBe(false)
    expect('isPartOf' in jsonLd).toBe(false)
  })
})

describe('buildJsonLd — Organization & Person knowsAbout / sameAs', () => {
  it('adds sameAs and knowsAbout to Organization', () => {
    const { jsonLd } = buildJsonLd(
      {
        title: 'Acme',
        sameAs: ['https://www.linkedin.com/company/acme'],
        knowsAbout: ['Web', 'SEO', 'IA'],
      },
      { collection: 'pages', type: 'Organization', siteUrl: SITE },
    )
    expect(jsonLd.sameAs).toEqual(['https://www.linkedin.com/company/acme'])
    expect(jsonLd.knowsAbout).toEqual(['Web', 'SEO', 'IA'])
  })

  it('adds sameAs and knowsAbout to Person (single string coerced to array)', () => {
    const { jsonLd } = buildJsonLd(
      { name: 'Jane', sameAs: 'https://orcid.org/0000-0002-1825-0097', knowsAbout: 'SEO' },
      { collection: 'pages', type: 'Person', siteUrl: SITE },
    )
    expect(jsonLd.sameAs).toEqual(['https://orcid.org/0000-0002-1825-0097'])
    expect(jsonLd.knowsAbout).toEqual(['SEO'])
  })

  it('Organization without entity fields has no sameAs/knowsAbout keys (legacy)', () => {
    const { jsonLd } = buildJsonLd({ title: 'Acme' }, { collection: 'pages', type: 'Organization', siteUrl: SITE })
    expect('sameAs' in jsonLd).toBe(false)
    expect('knowsAbout' in jsonLd).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D1 — eeat AI-readiness checks
// ---------------------------------------------------------------------------

describe('checkEeat — eeat-ai-author-entity (verifiable entity)', () => {
  it('passes when the author URL is a recognized profile (sameAs-grade)', () => {
    const checks = checkEeat(
      makeInput({ author: 'Jane', authorUrl: 'https://www.linkedin.com/in/janedoe' }),
      makeCtx(),
    )
    const c = checks.find((x) => x.id === 'eeat-ai-author-entity')
    expect(c?.status).toBe('pass')
    expect(c?.weight).toBe(0)
    expect(c?.group).toBe('eeat')
  })

  it('passes when the author URL is a profile-shaped path', () => {
    const checks = checkEeat(
      makeInput({ author: 'Jane', authorUrl: 'https://mysite.fr/author/jane-doe' }),
      makeCtx(),
    )
    expect(checks.find((x) => x.id === 'eeat-ai-author-entity')?.status).toBe('pass')
  })

  it('warns when the author URL does not look like an entity profile', () => {
    const checks = checkEeat(
      makeInput({ author: 'Jane', authorUrl: 'https://mysite.fr/random-page' }),
      makeCtx(),
    )
    expect(checks.find((x) => x.id === 'eeat-ai-author-entity')?.status).toBe('warning')
  })

  it('is absent when there is no author', () => {
    const checks = checkEeat(makeInput({ author: '' }), makeCtx())
    expect(checks.find((x) => x.id === 'eeat-ai-author-entity')).toBeUndefined()
  })
})

describe('checkEeat — eeat-ai-evidence (original data + sources)', () => {
  it('passes when content has quantitative data AND cited external sources', () => {
    const checks = checkEeat(makeInput({ author: 'Jane' }), makeCtx())
    const c = checks.find((x) => x.id === 'eeat-ai-evidence')
    expect(c?.status).toBe('pass')
    expect(c?.weight).toBe(0)
  })

  it('warns when external sources are missing', () => {
    const checks = checkEeat(
      makeInput({ author: 'Jane' }),
      makeCtx({ allLinks: [{ url: '/internal', text: 'interne' }] }),
    )
    expect(checks.find((x) => x.id === 'eeat-ai-evidence')?.status).toBe('warning')
  })

  it('all eeat checks remain weight 0 (non-scoring)', () => {
    const checks = checkEeat(
      makeInput({ author: 'Jane', authorUrl: 'https://www.linkedin.com/in/janedoe' }),
      makeCtx(),
    )
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.every((c) => c.weight === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// D2 — schema completeness (required fields by type, offline)
// ---------------------------------------------------------------------------

describe('evaluateRequiredProperties (pure matrix helper)', () => {
  it('flags CMS-derivable missing required props and reminds about unverifiable ones', () => {
    // Article googleRequired = headline, image, author, datePublished
    const res = evaluateRequiredProperties('Article', { headline: true, image: true, author: false, datePublished: false })
    expect(res.missing.sort()).toEqual(['author', 'datePublished'])
    expect(res.complete).toBe(false)
  })

  it('marks LocalBusiness address/telephone as unverifiable (no false positive)', () => {
    const res = evaluateRequiredProperties('LocalBusiness', { name: true })
    expect(res.missing).toEqual([]) // name present, address/telephone not derivable
    expect(res.unverifiable.sort()).toEqual(['address', 'telephone'])
    expect(res.complete).toBe(true)
  })

  it('falls back to `required` when no googleRequired is defined (BreadcrumbList)', () => {
    expect(SCHEMA_REQUIREMENTS.BreadcrumbList.googleRequired).toBeUndefined()
    const res = evaluateRequiredProperties('BreadcrumbList', { itemListElement: false })
    expect(res.missing).toEqual(['itemListElement'])
  })
})

describe('checkSchema — schema-required-fields check', () => {
  it('warns when an Article is missing author + datePublished', () => {
    const checks = checkSchema(makeInput({ isPost: true, metaImage: { id: 1 } }), makeCtx({ pageType: 'blog' }))
    const c = checks.find((x) => x.id === 'schema-required-fields')
    expect(c?.status).toBe('warning')
    expect(c?.weight).toBe(0)
    expect(c?.group).toBe('schema')
    expect(c?.message.toLowerCase()).toContain('author')
  })

  it('passes when the Article required fields are all derivable (author + publishedAt + image)', () => {
    const checks = checkSchema(
      makeInput({ isPost: true, metaImage: { id: 1 }, author: 'Jane', publishedAt: '2026-01-01' }),
      makeCtx({ pageType: 'blog' }),
    )
    const c = checks.find((x) => x.id === 'schema-required-fields')
    expect(c?.status).toBe('pass')
    expect(c?.weight).toBe(0)
  })

  it('reminds about address/telephone for a complete LocalBusiness name', () => {
    const checks = checkSchema(
      makeInput({ metaImage: { id: 1 } }),
      makeCtx({ pageType: 'local-seo' }),
    )
    const c = checks.find((x) => x.id === 'schema-required-fields')
    expect(c?.status).toBe('pass')
    expect(c?.message.toLowerCase()).toContain('address')
    expect(c?.message.toLowerCase()).toContain('telephone')
  })

  it('does not emit the completeness check for optional-schema page types (legal)', () => {
    const checks = checkSchema(makeInput(), makeCtx({ pageType: 'legal' }))
    expect(checks.find((x) => x.id === 'schema-required-fields')).toBeUndefined()
  })

  it('does not affect the existing schema-coverage check', () => {
    const checks = checkSchema(makeInput({ isPost: true, metaImage: { id: 1 } }), makeCtx({ pageType: 'blog' }))
    const cov = checks.find((x) => x.id === 'schema-coverage')
    expect(cov?.status).toBe('pass')
    expect(cov?.message).toContain('Article')
  })
})
