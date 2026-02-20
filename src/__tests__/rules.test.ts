import { describe, it, expect } from 'vitest'
import { analyzeSeo } from '../index'
import type { SeoInput, AnalysisContext, SeoConfig, PageType } from '../types'
import { checkTitle } from '../rules/title'
import { checkMetaDescription } from '../rules/meta-description'
import { checkUrl } from '../rules/url'
import { checkHeadings } from '../rules/headings'
import { checkContent } from '../rules/content'
import { checkImages } from '../rules/images'
import { checkLinking } from '../rules/linking'
import { checkSocial } from '../rules/social'
import { checkSchema } from '../rules/schema'
import { checkReadability } from '../rules/readability'
import { checkQuality } from '../rules/quality'
import { checkSecondaryKeywords } from '../rules/secondary-keywords'
import { checkCornerstone } from '../rules/cornerstone'
import { checkFreshness } from '../rules/freshness'
import { checkTechnical } from '../rules/technical'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SeoInput> = {}): SeoInput {
  return {
    metaTitle: 'Agence Web à Ussel en Corrèze | Mon Site',
    metaDescription:
      "Découvrez notre agence web à Ussel en Corrèze. Création de sites internet, développement web et référencement SEO. Devis gratuit.",
    slug: 'agence-web-ussel',
    focusKeyword: 'agence web ussel',
    ...overrides,
  }
}

function makeCtx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    fullText: "Notre agence est votre partenaire web a ussel en correze. Nous creons des sites web modernes et performants. Notre equipe de developpeurs maitrise les dernieres technologies.",
    wordCount: 300,
    normalizedKeyword: 'agence web ussel',
    secondaryNormalizedKeywords: [],
    allHeadings: [
      { tag: 'h1', text: 'Agence Web à Ussel' },
      { tag: 'h2', text: 'Nos services web' },
    ],
    allLinks: [
      { url: '/services/creation-site', text: 'Création de site' },
      { url: '/contact', text: 'Contactez-nous' },
      { url: 'https://example.com', text: 'Source externe' },
    ],
    imageStats: { total: 2, withAlt: 2, altTexts: ['Photo agence web Ussel', 'Logo agence web'] },
    sentences: [
      'Notre agence est votre partenaire web a ussel en correze.',
      'Nous creons des sites web modernes et performants.',
      'Notre equipe de developpeurs maitrise les dernieres technologies.',
    ],
    isPost: false,
    pageType: 'local-seo',
    config: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Title checks
// ---------------------------------------------------------------------------

describe('checkTitle', () => {
  it('passes with valid title', () => {
    const checks = checkTitle(makeInput(), makeCtx())
    const lengthCheck = checks.find((c) => c.id === 'title-length')
    expect(lengthCheck?.status).toBe('pass')
  })

  it('warns for short title', () => {
    const checks = checkTitle(makeInput({ metaTitle: 'Short' }), makeCtx())
    const lengthCheck = checks.find((c) => c.id === 'title-length')
    expect(lengthCheck?.status).toBe('warning')
  })

  it('warns for long title', () => {
    const checks = checkTitle(
      makeInput({ metaTitle: 'A'.repeat(65) }),
      makeCtx(),
    )
    const lengthCheck = checks.find((c) => c.id === 'title-length')
    expect(lengthCheck?.status).toBe('warning')
  })

  it('fails when title is missing', () => {
    const checks = checkTitle(makeInput({ metaTitle: '' }), makeCtx())
    expect(checks[0].id).toBe('title-missing')
    expect(checks[0].status).toBe('fail')
  })

  it('passes when keyword is in title', () => {
    const checks = checkTitle(makeInput(), makeCtx())
    const kwCheck = checks.find((c) => c.id === 'title-keyword')
    expect(kwCheck?.status).toBe('pass')
  })

  it('detects duplicate brand in title', () => {
    const checks = checkTitle(
      makeInput({ metaTitle: 'Mon Site | Mon Site' }),
      makeCtx(),
    )
    const dupCheck = checks.find((c) => c.id === 'title-duplicate-brand')
    expect(dupCheck?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Meta description checks
// ---------------------------------------------------------------------------

describe('checkMetaDescription', () => {
  it('passes with valid description', () => {
    const checks = checkMetaDescription(makeInput(), makeCtx())
    const lengthCheck = checks.find((c) => c.id === 'meta-desc-length')
    expect(lengthCheck?.status).toBe('pass')
  })

  it('warns for short description', () => {
    const checks = checkMetaDescription(
      makeInput({ metaDescription: 'Trop court' }),
      makeCtx(),
    )
    const lengthCheck = checks.find((c) => c.id === 'meta-desc-length')
    expect(lengthCheck?.status).toBe('warning')
  })

  it('fails when missing', () => {
    const checks = checkMetaDescription(
      makeInput({ metaDescription: '' }),
      makeCtx(),
    )
    expect(checks[0].status).toBe('fail')
  })

  it('detects action verb CTA', () => {
    const checks = checkMetaDescription(makeInput(), makeCtx())
    const ctaCheck = checks.find((c) => c.id === 'meta-desc-cta')
    expect(ctaCheck?.status).toBe('pass')
  })

  it('warns when no CTA', () => {
    const checks = checkMetaDescription(
      makeInput({
        metaDescription:
          "Notre agence propose ses services en Corrèze pour la création de sites internet professionnels et le développement web.",
      }),
      makeCtx(),
    )
    const ctaCheck = checks.find((c) => c.id === 'meta-desc-cta')
    expect(ctaCheck?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// URL checks
// ---------------------------------------------------------------------------

describe('checkUrl', () => {
  it('passes with good slug', () => {
    const checks = checkUrl(makeInput(), makeCtx())
    const lengthCheck = checks.find((c) => c.id === 'slug-length')
    expect(lengthCheck?.status).toBe('pass')
  })

  it('warns for long slug', () => {
    const checks = checkUrl(
      makeInput({ slug: 'a'.repeat(80) }),
      makeCtx(),
    )
    const lengthCheck = checks.find((c) => c.id === 'slug-length')
    expect(lengthCheck?.status).toBe('warning')
  })

  it('fails for missing slug', () => {
    const checks = checkUrl(makeInput({ slug: '' }), makeCtx())
    expect(checks[0].status).toBe('fail')
  })

  it('auto-passes utility slugs for keyword check', () => {
    const checks = checkUrl(
      makeInput({ slug: 'contact' }),
      makeCtx({ pageType: 'contact' }),
    )
    const kwCheck = checks.find((c) => c.id === 'slug-keyword')
    expect(kwCheck?.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// Headings checks
// ---------------------------------------------------------------------------

describe('checkHeadings', () => {
  it('passes with single H1 and keyword', () => {
    const checks = checkHeadings(makeInput(), makeCtx())
    const h1Check = checks.find((c) => c.id === 'h1-unique')
    expect(h1Check?.status).toBe('pass')
  })

  it('fails when no H1', () => {
    const checks = checkHeadings(
      makeInput(),
      makeCtx({ allHeadings: [{ tag: 'h2', text: 'Only subtitle' }] }),
    )
    const h1Check = checks.find((c) => c.id === 'h1-missing')
    expect(h1Check?.status).toBe('fail')
  })

  it('warns for multiple H1s', () => {
    const checks = checkHeadings(
      makeInput(),
      makeCtx({
        allHeadings: [
          { tag: 'h1', text: 'First' },
          { tag: 'h1', text: 'Second' },
        ],
      }),
    )
    const h1Check = checks.find((c) => c.id === 'h1-unique')
    expect(h1Check?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Content checks
// ---------------------------------------------------------------------------

describe('checkContent', () => {
  it('passes with sufficient word count', () => {
    const checks = checkContent(makeInput(), makeCtx({ wordCount: 400 }))
    const wcCheck = checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck?.status).toBe('pass')
  })

  it('fails with very low word count', () => {
    const checks = checkContent(makeInput(), makeCtx({ wordCount: 50 }))
    const wcCheck = checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck?.status).toBe('fail')
  })

  it('warns for word count below minimum', () => {
    const checks = checkContent(makeInput(), makeCtx({ wordCount: 200 }))
    const wcCheck = checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck?.status).toBe('warning')
  })

  it('detects placeholder content', () => {
    const checks = checkContent(
      makeInput(),
      makeCtx({ fullText: 'This is lorem ipsum dolor sit amet content' }),
    )
    const phCheck = checks.find((c) => c.id === 'content-no-placeholder')
    expect(phCheck?.status).toBe('fail')
  })

  it('passes with real content', () => {
    const checks = checkContent(makeInput(), makeCtx())
    const phCheck = checks.find((c) => c.id === 'content-no-placeholder')
    expect(phCheck?.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// Images checks
// ---------------------------------------------------------------------------

describe('checkImages', () => {
  it('passes when all images have alt text', () => {
    const checks = checkImages(makeInput(), makeCtx())
    const altCheck = checks.find((c) => c.id === 'images-alt')
    expect(altCheck?.status).toBe('pass')
  })

  it('auto-passes for legal pages', () => {
    const checks = checkImages(
      makeInput(),
      makeCtx({ pageType: 'legal', imageStats: { total: 0, withAlt: 0, altTexts: [] } }),
    )
    const presentCheck = checks.find((c) => c.id === 'images-present')
    expect(presentCheck?.status).toBe('pass')
  })

  it('warns when no images', () => {
    const checks = checkImages(
      makeInput(),
      makeCtx({ imageStats: { total: 0, withAlt: 0, altTexts: [] } }),
    )
    const presentCheck = checks.find((c) => c.id === 'images-present')
    expect(presentCheck?.status).toBe('warning')
  })

  it('fails for low alt text ratio', () => {
    const checks = checkImages(
      makeInput(),
      makeCtx({ imageStats: { total: 10, withAlt: 2, altTexts: ['alt1', 'alt2'] } }),
    )
    const altCheck = checks.find((c) => c.id === 'images-alt')
    expect(altCheck?.status).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// Linking checks
// ---------------------------------------------------------------------------

describe('checkLinking', () => {
  it('passes with internal links', () => {
    const checks = checkLinking(makeInput(), makeCtx())
    const intCheck = checks.find((c) => c.id === 'linking-internal')
    expect(intCheck?.status).toBe('pass')
  })

  it('warns for no internal links', () => {
    const checks = checkLinking(
      makeInput(),
      makeCtx({ allLinks: [{ url: 'https://external.com', text: 'External' }] }),
    )
    const intCheck = checks.find((c) => c.id === 'linking-internal')
    expect(intCheck?.status).toBe('warning')
  })

  it('warns for generic anchors', () => {
    const checks = checkLinking(
      makeInput(),
      makeCtx({
        allLinks: [
          { url: '/page', text: 'cliquez ici' },
          { url: '/autre', text: 'en savoir plus' },
        ],
      }),
    )
    const genCheck = checks.find((c) => c.id === 'linking-generic-anchors')
    expect(genCheck?.status).toBe('warning')
  })

  it('warns for empty links', () => {
    const checks = checkLinking(
      makeInput(),
      makeCtx({ allLinks: [{ url: '', text: 'empty' }, { url: '#', text: 'hash' }] }),
    )
    const emptyCheck = checks.find((c) => c.id === 'linking-empty')
    expect(emptyCheck?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Social checks
// ---------------------------------------------------------------------------

describe('checkSocial', () => {
  it('passes with OG image', () => {
    const checks = checkSocial(makeInput({ metaImage: { id: 1, url: '/img.jpg' } }), makeCtx())
    const ogCheck = checks.find((c) => c.id === 'social-og-image')
    expect(ogCheck?.status).toBe('pass')
  })

  it('warns without OG image', () => {
    const checks = checkSocial(makeInput({ metaImage: undefined }), makeCtx())
    const ogCheck = checks.find((c) => c.id === 'social-og-image')
    expect(ogCheck?.status).toBe('warning')
  })

  it('warns for long title on social', () => {
    const checks = checkSocial(
      makeInput({ metaTitle: 'A'.repeat(70) }),
      makeCtx(),
    )
    const titleCheck = checks.find((c) => c.id === 'social-title-truncation')
    expect(titleCheck?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Schema checks
// ---------------------------------------------------------------------------

describe('checkSchema', () => {
  it('passes when ready for schema', () => {
    const checks = checkSchema(
      makeInput({ metaImage: { id: 1 } }),
      makeCtx(),
    )
    expect(checks[0].status).toBe('pass')
  })

  it('warns when not ready', () => {
    const checks = checkSchema(
      makeInput({ metaTitle: '', metaDescription: '' }),
      makeCtx({ imageStats: { total: 0, withAlt: 0, altTexts: [] } }),
    )
    expect(checks[0].status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Readability checks
// ---------------------------------------------------------------------------

describe('checkReadability', () => {
  it('skips for very short content', () => {
    const checks = checkReadability(makeInput(), makeCtx({ wordCount: 30 }))
    expect(checks).toHaveLength(0)
  })

  it('runs all checks for sufficient content', () => {
    const longText = Array(100).fill('Le developpement web est un domaine passionnant.').join(' ')
    const sentences = longText.split('. ').filter(Boolean)
    const checks = checkReadability(
      makeInput({ heroRichText: null, content: null, blocks: [] }),
      makeCtx({
        fullText: longText,
        wordCount: 700,
        sentences,
      }),
    )
    // Should have Flesch, long sentences, paragraphs, passive, transitions checks
    expect(checks.length).toBeGreaterThanOrEqual(4)
  })
})

// ---------------------------------------------------------------------------
// Quality checks
// ---------------------------------------------------------------------------

describe('checkQuality', () => {
  it('passes with good content', () => {
    const checks = checkQuality(makeInput(), makeCtx())
    const dupCheck = checks.find((c) => c.id === 'quality-no-duplicate')
    const subCheck = checks.find((c) => c.id === 'quality-substantial')
    expect(dupCheck?.status).toBe('pass')
    expect(subCheck?.status).toBe('pass')
  })

  it('fails for very thin content', () => {
    const checks = checkQuality(makeInput(), makeCtx({ wordCount: 30 }))
    const subCheck = checks.find((c) => c.id === 'quality-substantial')
    expect(subCheck?.status).toBe('fail')
  })

  it('warns for light content', () => {
    const checks = checkQuality(makeInput(), makeCtx({ wordCount: 100 }))
    const subCheck = checks.find((c) => c.id === 'quality-substantial')
    expect(subCheck?.status).toBe('warning')
  })

  it('detects duplicate content', () => {
    const checks = checkQuality(
      makeInput(),
      makeCtx({ fullText: 'lorem ipsum dolor sit amet consectetur' }),
    )
    const dupCheck = checks.find((c) => c.id === 'quality-no-duplicate')
    expect(dupCheck?.status).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// Secondary keywords checks
// ---------------------------------------------------------------------------

describe('checkSecondaryKeywords', () => {
  it('returns nothing when no secondary keywords', () => {
    const checks = checkSecondaryKeywords(makeInput(), makeCtx())
    expect(checks).toHaveLength(0)
  })

  it('checks secondary keywords in title/desc/content/headings', () => {
    const checks = checkSecondaryKeywords(
      makeInput({ focusKeywords: ['création site'] }),
      makeCtx({ secondaryNormalizedKeywords: ['creation site'] }),
    )
    expect(checks.length).toBe(4) // title, desc, content, heading
  })

  it('displays original accented keyword (fix 3b)', () => {
    const checks = checkSecondaryKeywords(
      makeInput({ focusKeywords: ['développement web'] }),
      makeCtx({ secondaryNormalizedKeywords: ['developpement web'] }),
    )
    const titleCheck = checks.find((c) => c.id === 'secondary-kw-title-0')
    // Should display the original "développement web" not the normalized "developpement web"
    expect(titleCheck?.message).toContain('développement web')
  })
})

// ---------------------------------------------------------------------------
// Cornerstone checks
// ---------------------------------------------------------------------------

describe('checkCornerstone', () => {
  it('returns nothing when not cornerstone', () => {
    const checks = checkCornerstone(makeInput(), makeCtx())
    expect(checks).toHaveLength(0)
  })

  it('runs all cornerstone checks', () => {
    const checks = checkCornerstone(
      makeInput({ isCornerstone: true }),
      makeCtx({ wordCount: 2000 }),
    )
    expect(checks.length).toBeGreaterThanOrEqual(3)
    const wcCheck = checks.find((c) => c.id === 'cornerstone-wordcount')
    expect(wcCheck?.status).toBe('pass')
  })

  it('warns for insufficient word count', () => {
    const checks = checkCornerstone(
      makeInput({ isCornerstone: true }),
      makeCtx({ wordCount: 500 }),
    )
    const wcCheck = checks.find((c) => c.id === 'cornerstone-wordcount')
    expect(wcCheck?.status).toBe('warning')
  })

  it('warns for insufficient internal links', () => {
    const checks = checkCornerstone(
      makeInput({ isCornerstone: true }),
      makeCtx({ allLinks: [{ url: '/page', text: 'Link' }] }),
    )
    const linkCheck = checks.find((c) => c.id === 'cornerstone-internal-links')
    expect(linkCheck?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Freshness checks
// ---------------------------------------------------------------------------

describe('checkFreshness', () => {
  it('passes for recently updated content', () => {
    const today = new Date().toISOString()
    const checks = checkFreshness(
      makeInput({ updatedAt: today }),
      makeCtx(),
    )
    const ageCheck = checks.find((c) => c.id === 'freshness-age')
    expect(ageCheck?.status).toBe('pass')
  })

  it('fails for very old content', () => {
    const oldDate = new Date(Date.now() - 400 * 86400000).toISOString()
    const checks = checkFreshness(
      makeInput({ updatedAt: oldDate }),
      makeCtx(),
    )
    const ageCheck = checks.find((c) => c.id === 'freshness-age')
    expect(ageCheck?.status).toBe('fail')
  })

  it('warns for moderately old content', () => {
    const date = new Date(Date.now() - 200 * 86400000).toISOString()
    const checks = checkFreshness(
      makeInput({ updatedAt: date }),
      makeCtx(),
    )
    const ageCheck = checks.find((c) => c.id === 'freshness-age')
    expect(ageCheck?.status).toBe('warning')
  })

  it('uses relaxed thresholds for evergreen pages', () => {
    const date = new Date(Date.now() - 400 * 86400000).toISOString()
    const checks = checkFreshness(
      makeInput({ slug: 'mentions-legales', updatedAt: date }),
      makeCtx({ pageType: 'legal' }),
    )
    const ageCheck = checks.find((c) => c.id === 'freshness-age')
    // 400 days < 730 (evergreen threshold), so should pass
    expect(ageCheck?.status).toBe('pass')
  })

  it('detects thin aging content', () => {
    const oldDate = new Date(Date.now() - 200 * 86400000).toISOString()
    const checks = checkFreshness(
      makeInput({ updatedAt: oldDate }),
      makeCtx({ wordCount: 200 }),
    )
    const thinCheck = checks.find((c) => c.id === 'freshness-thin-aging')
    expect(thinCheck?.status).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// Technical checks (canonical, robots)
// ---------------------------------------------------------------------------

describe('checkTechnical', () => {
  it('returns nothing when no canonical/robots defined', () => {
    const checks = checkTechnical(makeInput(), makeCtx())
    expect(checks).toHaveLength(0)
  })

  it('passes for valid canonical URL', () => {
    const checks = checkTechnical(
      makeInput({ canonicalUrl: 'https://example.com/agence-web-ussel' }),
      makeCtx(),
    )
    const canonCheck = checks.find((c) => c.id === 'canonical-ok')
    expect(canonCheck?.status).toBe('pass')
  })

  it('warns for empty canonical', () => {
    const checks = checkTechnical(
      makeInput({ canonicalUrl: '' }),
      makeCtx(),
    )
    const canonCheck = checks.find((c) => c.id === 'canonical-missing')
    expect(canonCheck?.status).toBe('warning')
  })

  it('warns for relative canonical URL', () => {
    const checks = checkTechnical(
      makeInput({ canonicalUrl: '/agence-web-ussel' }),
      makeCtx(),
    )
    const canonCheck = checks.find((c) => c.id === 'canonical-invalid')
    expect(canonCheck?.status).toBe('warning')
  })

  it('warns for external canonical when siteUrl is set', () => {
    const checks = checkTechnical(
      makeInput({ canonicalUrl: 'https://other-site.com/page' }),
      makeCtx({ config: { siteUrl: 'https://example.com' } }),
    )
    const canonCheck = checks.find((c) => c.id === 'canonical-external')
    expect(canonCheck?.status).toBe('warning')
  })

  it('fails for noindex on content pages', () => {
    const checks = checkTechnical(
      makeInput({ robotsMeta: 'noindex' }),
      makeCtx({ pageType: 'local-seo' }),
    )
    const robotsCheck = checks.find((c) => c.id === 'robots-noindex')
    expect(robotsCheck?.status).toBe('fail')
  })

  it('warns for noindex on legal pages (acceptable)', () => {
    const checks = checkTechnical(
      makeInput({ robotsMeta: 'noindex' }),
      makeCtx({ pageType: 'legal' }),
    )
    const robotsCheck = checks.find((c) => c.id === 'robots-noindex')
    expect(robotsCheck?.status).toBe('warning')
  })

  it('warns for nofollow', () => {
    const checks = checkTechnical(
      makeInput({ robotsMeta: 'nofollow' }),
      makeCtx(),
    )
    const nofollowCheck = checks.find((c) => c.id === 'robots-nofollow')
    expect(nofollowCheck?.status).toBe('warning')
  })

  it('passes for index,follow', () => {
    const checks = checkTechnical(
      makeInput({ robotsMeta: 'index, follow' }),
      makeCtx(),
    )
    const robotsCheck = checks.find((c) => c.id === 'robots-ok')
    expect(robotsCheck?.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// C1. Keyword distribution in content
// ---------------------------------------------------------------------------

describe('C1 — keyword distribution', () => {
  const kwText = (kw: string, tiers: number[]) => {
    // Build text where keyword appears only in specified tiers (0, 1, 2)
    const filler = 'Le developpement web est un domaine passionnant et en pleine evolution constante. '
    const fillerBlock = filler.repeat(10) // ~180 chars per block
    const parts = [fillerBlock, fillerBlock, fillerBlock]
    for (const t of tiers) {
      parts[t] = parts[t] + ` Le ${kw} est important. `
    }
    return parts.join('')
  }

  it('passes when keyword is well distributed (2+ tiers)', () => {
    const text = kwText('agence web ussel', [0, 2])
    const checks = checkContent(
      makeInput({ focusKeyword: 'agence web ussel' }),
      makeCtx({ fullText: text, wordCount: 500, normalizedKeyword: 'agence web ussel' }),
    )
    const distCheck = checks.find((c) => c.id === 'content-keyword-distribution')
    expect(distCheck).toBeDefined()
    expect(distCheck?.status).toBe('pass')
  })

  it('warns when keyword is in only 1 tier', () => {
    const text = kwText('agence web ussel', [1])
    const checks = checkContent(
      makeInput({ focusKeyword: 'agence web ussel' }),
      makeCtx({ fullText: text, wordCount: 500, normalizedKeyword: 'agence web ussel' }),
    )
    const distCheck = checks.find((c) => c.id === 'content-keyword-distribution')
    expect(distCheck?.status).toBe('warning')
  })

  it('fails when keyword is in 0 tiers', () => {
    const text = kwText('agence web ussel', [])
    const checks = checkContent(
      makeInput({ focusKeyword: 'agence web ussel' }),
      makeCtx({ fullText: text, wordCount: 500, normalizedKeyword: 'agence web ussel' }),
    )
    const distCheck = checks.find((c) => c.id === 'content-keyword-distribution')
    expect(distCheck?.status).toBe('fail')
  })

  it('skips distribution check for short content (<100 words)', () => {
    const checks = checkContent(
      makeInput({ focusKeyword: 'agence web' }),
      makeCtx({ wordCount: 50, normalizedKeyword: 'agence web' }),
    )
    const distCheck = checks.find((c) => c.id === 'content-keyword-distribution')
    expect(distCheck).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// C2. Power words in title
// ---------------------------------------------------------------------------

describe('C2 — power words in title', () => {
  it('passes when title contains a power word', () => {
    const checks = checkTitle(
      makeInput({ metaTitle: 'Guide complet agence web Ussel' }),
      makeCtx(),
    )
    const pwCheck = checks.find((c) => c.id === 'title-power-words')
    expect(pwCheck).toBeDefined()
    expect(pwCheck?.status).toBe('pass')
    expect(pwCheck?.message).toContain('guide')
  })

  it('warns when title has no power word', () => {
    const checks = checkTitle(
      makeInput({ metaTitle: 'Agence Web a Ussel en Correze' }),
      makeCtx(),
    )
    const pwCheck = checks.find((c) => c.id === 'title-power-words')
    expect(pwCheck?.status).toBe('warning')
  })

  it('detects accented power words (e.g. "méthode" → "methode")', () => {
    const checks = checkTitle(
      makeInput({ metaTitle: 'Notre méthode pour créer votre site' }),
      makeCtx(),
    )
    const pwCheck = checks.find((c) => c.id === 'title-power-words')
    expect(pwCheck?.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// C3. Lists in content
// ---------------------------------------------------------------------------

describe('C3 — lists in content', () => {
  const lexicalWithList = {
    root: {
      children: [
        { type: 'list', tag: 'ul', listType: 'bullet', children: [
          { type: 'listitem', children: [{ type: 'text', text: 'Item 1' }] },
          { type: 'listitem', children: [{ type: 'text', text: 'Item 2' }] },
        ] },
      ],
    },
  }

  const lexicalWithoutList = {
    root: {
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Simple paragraph' }] },
      ],
    },
  }

  it('passes when content has lists (>500 words)', () => {
    const checks = checkContent(
      makeInput({ content: lexicalWithList }),
      makeCtx({ wordCount: 600 }),
    )
    const listCheck = checks.find((c) => c.id === 'content-has-lists')
    expect(listCheck).toBeDefined()
    expect(listCheck?.status).toBe('pass')
  })

  it('warns when no lists in long content', () => {
    const checks = checkContent(
      makeInput({ heroRichText: null, content: lexicalWithoutList, blocks: [] }),
      makeCtx({ wordCount: 600 }),
    )
    const listCheck = checks.find((c) => c.id === 'content-has-lists')
    expect(listCheck?.status).toBe('warning')
  })

  it('skips lists check for short content (<=500 words)', () => {
    const checks = checkContent(
      makeInput({ content: lexicalWithoutList }),
      makeCtx({ wordCount: 300 }),
    )
    const listCheck = checks.find((c) => c.id === 'content-has-lists')
    expect(listCheck).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// C4. H1 vs meta title
// ---------------------------------------------------------------------------

describe('C4 — H1 vs meta title different', () => {
  it('passes when H1 and meta title are different', () => {
    const checks = checkHeadings(
      makeInput({ metaTitle: 'Agence Web à Ussel | Mon Site' }),
      makeCtx({
        allHeadings: [{ tag: 'h1', text: 'Votre agence web de confiance à Ussel' }],
      }),
    )
    const h1TitleCheck = checks.find((c) => c.id === 'h1-title-different')
    expect(h1TitleCheck).toBeDefined()
    expect(h1TitleCheck?.status).toBe('pass')
  })

  it('warns when H1 and meta title are identical', () => {
    const checks = checkHeadings(
      makeInput({ metaTitle: 'Agence Web à Ussel' }),
      makeCtx({
        allHeadings: [{ tag: 'h1', text: 'Agence Web à Ussel' }],
      }),
    )
    const h1TitleCheck = checks.find((c) => c.id === 'h1-title-different')
    expect(h1TitleCheck?.status).toBe('warning')
  })

  it('skips when no meta title', () => {
    const checks = checkHeadings(
      makeInput({ metaTitle: '' }),
      makeCtx({
        allHeadings: [{ tag: 'h1', text: 'Agence Web à Ussel' }],
      }),
    )
    const h1TitleCheck = checks.find((c) => c.id === 'h1-title-different')
    // H1-title check only runs when metaTitle is set (title-missing fires instead)
    expect(h1TitleCheck).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Tips on checks (D3)
// ---------------------------------------------------------------------------

describe('Tips on checks', () => {
  it('includes tip on fail checks', () => {
    const checks = checkTitle(makeInput({ metaTitle: '' }), makeCtx())
    const failCheck = checks.find((c) => c.id === 'title-missing')
    expect(failCheck?.status).toBe('fail')
    expect(failCheck?.tip).toBeDefined()
    expect(failCheck!.tip!.length).toBeGreaterThan(10)
  })

  it('includes tip on warning checks', () => {
    const checks = checkContent(
      makeInput({ focusKeyword: 'agence web ussel' }),
      makeCtx({ wordCount: 200, normalizedKeyword: 'agence web ussel' }),
    )
    const wcCheck = checks.find((c) => c.id === 'content-wordcount')
    expect(wcCheck?.status).toBe('warning')
    expect(wcCheck?.tip).toBeDefined()
  })

  it('does not include tip on pass checks', () => {
    const checks = checkTitle(makeInput(), makeCtx())
    const passCheck = checks.find((c) => c.id === 'title-length')
    expect(passCheck?.status).toBe('pass')
    expect(passCheck?.tip).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// analyzeSeo() — disabledRules & overrideWeights (B2-B3)
// ---------------------------------------------------------------------------

describe('analyzeSeo — disabledRules', () => {
  it('excludes all checks from a disabled rule group', () => {
    const result = analyzeSeo(makeInput(), {
      disabledRules: ['title'],
    })
    const titleChecks = result.checks.filter((c) => c.group === 'title')
    expect(titleChecks).toHaveLength(0)
    // Other groups should still be present
    const urlChecks = result.checks.filter((c) => c.group === 'url')
    expect(urlChecks.length).toBeGreaterThan(0)
  })

  it('can disable multiple rule groups', () => {
    const result = analyzeSeo(makeInput(), {
      disabledRules: ['title', 'meta-description', 'social'],
    })
    const titleChecks = result.checks.filter((c) => c.group === 'title')
    const metaChecks = result.checks.filter((c) => c.group === 'meta-description')
    const socialChecks = result.checks.filter((c) => c.group === 'social')
    expect(titleChecks).toHaveLength(0)
    expect(metaChecks).toHaveLength(0)
    expect(socialChecks).toHaveLength(0)
  })
})

describe('analyzeSeo — overrideWeights', () => {
  it('overrides weight for all checks in a group', () => {
    const result = analyzeSeo(makeInput(), {
      overrideWeights: { title: 10 },
    })
    const titleChecks = result.checks.filter((c) => c.group === 'title')
    expect(titleChecks.length).toBeGreaterThan(0)
    for (const check of titleChecks) {
      expect(check.weight).toBe(10)
    }
  })

  it('does not affect other groups', () => {
    const resultWith = analyzeSeo(makeInput(), {
      overrideWeights: { title: 0 },
    })
    const resultWithout = analyzeSeo(makeInput())

    // URL checks should have same weights in both
    const urlWith = resultWith.checks.filter((c) => c.group === 'url')
    const urlWithout = resultWithout.checks.filter((c) => c.group === 'url')
    expect(urlWith.length).toBe(urlWithout.length)
    for (let i = 0; i < urlWith.length; i++) {
      expect(urlWith[i].weight).toBe(urlWithout[i].weight)
    }
  })
})
