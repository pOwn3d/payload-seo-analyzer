/**
 * GEO — AI extractability checks (Vague 3 SEO-2026, D4).
 *
 * Covers the additional weight-0 "AI-readiness" signals layered on top of the
 * existing GEO rule: FAQ/HowTo structure, definition snippet up top, and short
 * self-contained paragraphs (extractable chunks). Every check here is directional
 * (weight 0) — it must never move the SEO score.
 */
import { describe, it, expect } from 'vitest'
import type { SeoInput, AnalysisContext } from '../types'
import { checkGeo } from '../rules/geo'

// ---------------------------------------------------------------------------
// Lexical fixture builders
// ---------------------------------------------------------------------------

const text = (t: string) => ({ type: 'text', text: t })
const paragraph = (t: string) => ({ type: 'paragraph', children: [text(t)] })
const heading = (tag: string, t: string) => ({ type: 'heading', tag, children: [text(t)] })
const listItem = (t: string) => ({ type: 'listitem', children: [text(t)] })
const numberedList = (...items: string[]) => ({
  type: 'list',
  listType: 'number',
  children: items.map(listItem),
})
const root = (...children: unknown[]) => ({ root: { children } })

// ---------------------------------------------------------------------------
// Context / input helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SeoInput> = {}): SeoInput {
  return {
    metaTitle: 'Guide complet du SEO en 2026',
    metaDescription: 'Tout savoir sur le SEO moderne et la citation par les IA.',
    slug: 'guide-seo-2026',
    focusKeyword: 'seo 2026',
    ...overrides,
  }
}

function makeCtx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    fullText:
      'Voici une introduction generale au sujet traite ici. Nous explorons les bonnes pratiques actuelles. Le contenu se veut clair et structure.',
    readabilityText:
      'Voici une introduction generale au sujet traite ici. Nous explorons les bonnes pratiques actuelles. Le contenu se veut clair et structure.',
    wordCount: 300,
    normalizedKeyword: 'seo 2026',
    secondaryNormalizedKeywords: [],
    allHeadings: [
      { tag: 'h1', text: 'Guide complet du SEO' },
      { tag: 'h2', text: 'Introduction' },
    ],
    allLinks: [],
    imageStats: { total: 0, withAlt: 0, altTexts: [] },
    sentences: [
      'Voici une introduction generale au sujet traite ici.',
      'Nous explorons les bonnes pratiques actuelles.',
      'Le contenu se veut clair et structure.',
    ],
    isPost: true,
    pageType: 'blog',
    config: {},
    locale: 'fr',
    ...overrides,
  }
}

const idOf = (checks: ReturnType<typeof checkGeo>, id: string) => checks.find((c) => c.id === id)

// ---------------------------------------------------------------------------
// Invariants (must not regress existing behavior)
// ---------------------------------------------------------------------------

describe('checkGeo — invariants', () => {
  it('every check (existing + new) is weight 0 — never moves the SEO score', () => {
    const checks = checkGeo(makeInput({ content: root(paragraph('Un paragraphe.')) }), makeCtx())
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.every((c) => c.weight === 0)).toBe(true)
    expect(checks.every((c) => c.category === 'bonus')).toBe(true)
    expect(checks.every((c) => c.group === 'geo')).toBe(true)
  })

  it('keeps the 4 original GEO checks intact', () => {
    const checks = checkGeo(makeInput(), makeCtx())
    for (const id of ['geo-answer-first', 'geo-question-headings', 'geo-extractable-structure', 'geo-chunked']) {
      expect(idOf(checks, id)).toBeDefined()
    }
  })

  it('skips entirely when content is too short (<150 words)', () => {
    expect(checkGeo(makeInput(), makeCtx({ wordCount: 100 }))).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// geo-faq-howto
// ---------------------------------------------------------------------------

describe('checkGeo — geo-faq-howto', () => {
  it('passes when ≥2 question-style headings form an FAQ', () => {
    const checks = checkGeo(
      makeInput(),
      makeCtx({
        allHeadings: [
          { tag: 'h2', text: 'Comment installer le plugin ?' },
          { tag: 'h2', text: 'Pourquoi utiliser le SEO ?' },
        ],
      }),
    )
    const c = idOf(checks, 'geo-faq-howto')
    expect(c?.status).toBe('pass')
    expect(c?.weight).toBe(0)
  })

  it('passes when a numbered HowTo procedure (≥3 steps) is present', () => {
    const checks = checkGeo(
      makeInput({ content: root(numberedList('Étape une', 'Étape deux', 'Étape trois')) }),
      makeCtx(),
    )
    expect(idOf(checks, 'geo-faq-howto')?.status).toBe('pass')
  })

  it('warns (with a tip) when neither FAQ nor HowTo is present', () => {
    const c = idOf(checkGeo(makeInput(), makeCtx()), 'geo-faq-howto')
    expect(c?.status).toBe('warning')
    expect(c?.tip).toBeTruthy()
  })

  it('does not count a single question heading as an FAQ', () => {
    const checks = checkGeo(
      makeInput(),
      makeCtx({ allHeadings: [{ tag: 'h2', text: 'Comment optimiser le SEO ?' }] }),
    )
    expect(idOf(checks, 'geo-faq-howto')?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// geo-definition
// ---------------------------------------------------------------------------

describe('checkGeo — geo-definition', () => {
  it('passes with a concise "X est …" definition near the top (FR)', () => {
    const checks = checkGeo(
      makeInput(),
      makeCtx({
        sentences: [
          "Le SEO est l'optimisation pour les moteurs de recherche.",
          'Il regroupe de nombreuses techniques.',
        ],
      }),
    )
    expect(idOf(checks, 'geo-definition')?.status).toBe('pass')
  })

  it('passes with a concise "X is …" definition near the top (EN)', () => {
    const checks = checkGeo(
      makeInput(),
      makeCtx({
        locale: 'en',
        sentences: ['SEO is the practice of optimizing web content.', 'It covers many techniques.'],
      }),
    )
    expect(idOf(checks, 'geo-definition')?.status).toBe('pass')
  })

  it('warns (with a tip) when no definition sentence is present up top', () => {
    const c = idOf(checkGeo(makeInput(), makeCtx()), 'geo-definition')
    expect(c?.status).toBe('warning')
    expect(c?.tip).toBeTruthy()
  })

  it('does not match an over-long sentence as a snippet', () => {
    const longDef =
      'Le SEO est une discipline ' + Array.from({ length: 40 }, () => 'mot').join(' ') + '.'
    const checks = checkGeo(makeInput(), makeCtx({ sentences: [longDef] }))
    expect(idOf(checks, 'geo-definition')?.status).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// geo-extractable-chunks
// ---------------------------------------------------------------------------

describe('checkGeo — geo-extractable-chunks', () => {
  it('passes when paragraphs are short and self-contained', () => {
    const content = root(
      paragraph('Un court paragraphe autonome.'),
      heading('h2', 'Section'),
      paragraph('Un autre paragraphe bref et clair.'),
    )
    expect(idOf(checkGeo(makeInput({ content }), makeCtx()), 'geo-extractable-chunks')?.status).toBe('pass')
  })

  it('warns (with a tip) on a long wall of text', () => {
    const wall = Array.from({ length: 210 }, () => 'mot').join(' ')
    const c = idOf(
      checkGeo(makeInput({ content: root(paragraph(wall)) }), makeCtx()),
      'geo-extractable-chunks',
    )
    expect(c?.status).toBe('warning')
    expect(c?.tip).toBeTruthy()
  })

  it('is not emitted when there is no paragraph-level structure to inspect', () => {
    const checks = checkGeo(makeInput(), makeCtx())
    expect(idOf(checks, 'geo-extractable-chunks')).toBeUndefined()
  })
})
