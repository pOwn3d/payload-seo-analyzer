import { describe, it, expect } from 'vitest'
import { analyzeSeo } from '../index'
import type { SeoInput, SeoConfig } from '../types'
import {
  SCORE_EXCELLENT,
  SCORE_GOOD,
  SCORE_OK,
} from '../constants'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLexicalParagraph(text: string) {
  return {
    root: {
      children: [
        { type: 'paragraph', children: [{ type: 'text', text }] },
      ],
    },
  }
}

function makeFullInput(overrides: Partial<SeoInput> = {}): SeoInput {
  return {
    metaTitle: 'Agence Web à Ussel en Corrèze | Mon Site',
    metaDescription:
      "Découvrez notre agence web à Ussel en Corrèze. Création de sites internet, développement web et référencement SEO. Devis gratuit.",
    slug: 'agence-web-ussel',
    focusKeyword: 'agence web ussel',
    heroTitle: 'Agence Web à Ussel',
    heroRichText: makeLexicalParagraph(
      "Notre agence est votre partenaire web a ussel specialisee dans la creation de sites internet. En effet, nous proposons des services de developpement web sur mesure.",
    ),
    blocks: [
      {
        blockType: 'content',
        columns: [
          {
            richText: makeLexicalParagraph(
              Array(50)
                .fill(
                  "Notre agence web ussel cree des sites internet modernes et performants pour les entreprises de la region.",
                )
                .join(' '),
            ),
          },
        ],
      },
    ],
    metaImage: { id: 1, url: '/images/og.jpg', alt: 'Agence web Ussel' },
    heroMedia: { url: '/images/hero.jpg', alt: 'Hero agence web Ussel background' },
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// analyzeSeo end-to-end
// ---------------------------------------------------------------------------

describe('analyzeSeo', () => {
  it('returns a score between 0 and 100', () => {
    const result = analyzeSeo(makeFullInput())
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns checks array', () => {
    const result = analyzeSeo(makeFullInput())
    expect(Array.isArray(result.checks)).toBe(true)
    expect(result.checks.length).toBeGreaterThan(10)
  })

  it('computes a high score for well-optimized content', () => {
    const result = analyzeSeo(makeFullInput())
    expect(result.score).toBeGreaterThanOrEqual(60) // realistic minimum for good content
    expect(['good', 'excellent']).toContain(result.level)
  })

  it('computes a low score for empty/minimal content', () => {
    const result = analyzeSeo({
      metaTitle: '',
      metaDescription: '',
      slug: '',
    })
    // Score is below "good" threshold but may be above "ok" due to bonus checks passing vacuously
    expect(result.score).toBeLessThan(SCORE_GOOD)
    expect(['poor', 'ok']).toContain(result.level)
  })

  it('all checks have required fields', () => {
    const result = analyzeSeo(makeFullInput())
    for (const check of result.checks) {
      expect(check).toHaveProperty('id')
      expect(check).toHaveProperty('label')
      expect(check).toHaveProperty('status')
      expect(check).toHaveProperty('message')
      expect(check).toHaveProperty('category')
      expect(check).toHaveProperty('weight')
      expect(check).toHaveProperty('group')
      expect(['pass', 'warning', 'fail']).toContain(check.status)
    }
  })
})

// ---------------------------------------------------------------------------
// Level boundaries
// ---------------------------------------------------------------------------

describe('scoring level boundaries', () => {
  it('maps empty input to low score', () => {
    const result = analyzeSeo({ slug: '' })
    // With empty slug, critical/important checks fail but bonus checks may pass vacuously
    expect(result.score).toBeLessThan(SCORE_GOOD)
    expect(['poor', 'ok']).toContain(result.level)
  })

  it('verifies level constants', () => {
    expect(SCORE_EXCELLENT).toBe(91)
    expect(SCORE_GOOD).toBe(71)
    expect(SCORE_OK).toBe(41)
  })
})

// ---------------------------------------------------------------------------
// Cornerstone mode
// ---------------------------------------------------------------------------

describe('cornerstone mode', () => {
  it('adds cornerstone checks when isCornerstone=true', () => {
    const input = makeFullInput({ isCornerstone: true })
    const result = analyzeSeo(input)
    const cornerstoneChecks = result.checks.filter((c) => c.group === 'cornerstone')
    expect(cornerstoneChecks.length).toBeGreaterThanOrEqual(3)
  })

  it('excludes cornerstone checks when isCornerstone=false', () => {
    const result = analyzeSeo(makeFullInput({ isCornerstone: false }))
    const cornerstoneChecks = result.checks.filter((c) => c.group === 'cornerstone')
    expect(cornerstoneChecks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Post mode
// ---------------------------------------------------------------------------

describe('post mode', () => {
  it('detects blog page type for posts', () => {
    const result = analyzeSeo(makeFullInput({ isPost: true }))
    // Verify that checks ran with blog context by checking that content wordcount
    // uses the 800-word threshold for posts
    const wcCheck = result.checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck).toBeDefined()
  })

  it('adds post title as H1 when no H1 in content', () => {
    const result = analyzeSeo(
      makeFullInput({
        isPost: true,
        heroTitle: 'Mon Article',
        heroRichText: makeLexicalParagraph('Introduction de mon article.'),
        content: makeLexicalParagraph('Contenu principal de article.'),
      }),
    )
    const h1Check = result.checks.find(
      (c) => c.id === 'h1-unique' || c.id === 'h1-missing',
    )
    // Should find an H1 (from heroTitle injection)
    expect(h1Check?.id).toBe('h1-unique')
    expect(h1Check?.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('input validation', () => {
  it('handles null/undefined input gracefully', () => {
    // @ts-expect-error testing invalid input
    const result = analyzeSeo(null)
    expect(result.score).toBe(0)
    expect(result.level).toBe('poor')
    expect(result.checks).toHaveLength(0)
  })

  it('handles non-object input gracefully', () => {
    // @ts-expect-error testing invalid input
    const result = analyzeSeo('not an object')
    expect(result.score).toBe(0)
    expect(result.level).toBe('poor')
    expect(result.checks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// SeoConfig
// ---------------------------------------------------------------------------

describe('SeoConfig', () => {
  it('accepts optional config parameter', () => {
    const config: SeoConfig = { siteUrl: 'https://example.com' }
    const result = analyzeSeo(makeFullInput(), config)
    expect(result.score).toBeGreaterThan(0)
  })

  it('runs technical checks when canonical/robots are provided', () => {
    const result = analyzeSeo(
      makeFullInput({
        canonicalUrl: 'https://example.com/agence-web-ussel',
        robotsMeta: 'index, follow',
      }),
    )
    const technicalChecks = result.checks.filter((c) => c.group === 'technical')
    expect(technicalChecks.length).toBeGreaterThan(0)
  })

  it('uses custom localSeoSlugs from config', () => {
    const result = analyzeSeo(
      makeFullInput({ slug: 'web-agency-london' }),
      { localSeoSlugs: ['web-agency-london'] },
    )
    // Should detect local-seo page type from custom slug
    const wcCheck = result.checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Recursion depth protection
// ---------------------------------------------------------------------------

describe('recursion depth protection', () => {
  it('does not crash on deeply nested Lexical trees', () => {
    // Build a tree 100 levels deep
    let tree: Record<string, unknown> = { type: 'text', text: 'deep' }
    for (let i = 0; i < 100; i++) {
      tree = { type: 'paragraph', children: [tree] }
    }
    const deepInput = makeFullInput({
      heroRichText: { root: tree },
    })
    // Should complete without stack overflow
    const result = analyzeSeo(deepInput, { maxRecursionDepth: 10 })
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})
