import { describe, it, expect } from 'vitest'
import {
  computeQueryCoverage,
  weightedAveragePosition,
  matchPageRows,
  gradeContentCoverage,
  type GscQueryRow,
} from '../endpoints/contentGrade.js'
import { normalizeForComparison } from '../helpers.js'
import type { GscRow } from '../helpers/gscClient.js'

// Shorthand: build a GscRow (dimensions ['page','query']).
const row = (page: string, query: string, p: Partial<GscRow> = {}): GscRow => ({
  keys: [page, query],
  clicks: p.clicks ?? 0,
  impressions: p.impressions ?? 0,
  ctr: p.ctr ?? 0,
  position: p.position ?? 0,
})

// Shorthand: build a query-level row.
const qrow = (query: string, p: Partial<GscQueryRow> = {}): GscQueryRow => ({
  query,
  clicks: p.clicks ?? 0,
  impressions: p.impressions ?? 0,
  ctr: p.ctr ?? 0,
  position: p.position ?? 0,
})

describe('computeQueryCoverage', () => {
  const content = normalizeForComparison(
    'Plombier chauffagiste à Lyon. Installation et dépannage de chaudière.',
  )

  it('returns full coverage when all significant terms are present (accent-insensitive)', () => {
    const cov = computeQueryCoverage('plombier Lyon', content, 'fr')
    expect(cov.coverage).toBe(1)
    expect(cov.missingTerms).toEqual([])
    expect(cov.presentTerms).toEqual(['plombier', 'lyon'])
  })

  it('matches accented query terms against accent-stripped content', () => {
    // "dépannage" → "depannage" is present in the normalized content
    const cov = computeQueryCoverage('dépannage chaudière', content, 'fr')
    expect(cov.coverage).toBe(1)
  })

  it('reports missing terms and a partial coverage ratio', () => {
    const cov = computeQueryCoverage('dépannage fuite eau', content, 'fr')
    expect(cov.terms).toEqual(['depannage', 'fuite', 'eau'])
    expect(cov.presentTerms).toEqual(['depannage'])
    expect(cov.missingTerms).toEqual(['fuite', 'eau'])
    expect(cov.coverage).toBeCloseTo(1 / 3, 5)
  })

  it('treats a stopword-only / too-short query as fully covered (no significant terms)', () => {
    const cov = computeQueryCoverage('à la de', content, 'fr')
    expect(cov.terms).toEqual([])
    expect(cov.coverage).toBe(1)
  })
})

describe('weightedAveragePosition', () => {
  it('weights position by impressions', () => {
    expect(
      weightedAveragePosition([
        { impressions: 100, position: 2 },
        { impressions: 300, position: 6 },
      ]),
    ).toBe(5) // (100*2 + 300*6) / 400 = 5
  })

  it('ignores rows without impressions and returns 0 when none', () => {
    expect(weightedAveragePosition([{ impressions: 0, position: 3 }])).toBe(0)
    expect(weightedAveragePosition([])).toBe(0)
  })
})

describe('matchPageRows', () => {
  const rows: GscRow[] = [
    row('https://x.fr/services/plomberie', 'plombier', { impressions: 50, clicks: 5, position: 3 }),
    row('https://x.fr/services/plomberie', 'plombier lyon', { impressions: 30, clicks: 2, position: 5 }),
    row('https://x.fr/contact', 'contact', { impressions: 10, clicks: 1, position: 8 }),
    row('https://x.fr/', 'accueil', { impressions: 20, clicks: 3, position: 4 }),
  ]

  it('matches a page by its last path segment slug (accent-insensitive)', () => {
    const { matchedUrl, queryRows } = matchPageRows(rows, { slug: 'plomberie' })
    expect(matchedUrl).toBe('https://x.fr/services/plomberie')
    expect(queryRows.map((r) => r.query).sort()).toEqual(['plombier', 'plombier lyon'])
  })

  it('maps the home slug to the root path', () => {
    const { matchedUrl, queryRows } = matchPageRows(rows, { slug: 'home' })
    expect(matchedUrl).toBe('https://x.fr/')
    expect(queryRows).toHaveLength(1)
    expect(queryRows[0]!.query).toBe('accueil')
  })

  it('honours an explicit url (trailing-slash tolerant)', () => {
    const { matchedUrl } = matchPageRows(rows, { explicitUrl: 'https://x.fr/contact/' })
    expect(matchedUrl).toBe('https://x.fr/contact')
  })

  it('returns no match when nothing resolves', () => {
    expect(matchPageRows(rows, { slug: 'inexistant' })).toEqual({ matchedUrl: null, queryRows: [] })
    expect(matchPageRows([], { slug: 'plomberie' })).toEqual({ matchedUrl: null, queryRows: [] })
  })

  it('picks the highest-impression candidate when several pages share a slug', () => {
    const variants: GscRow[] = [
      row('https://x.fr/fr/about', 'a propos', { impressions: 100 }),
      row('https://x.fr/en/about', 'about', { impressions: 20 }),
    ]
    const { matchedUrl } = matchPageRows(variants, { slug: 'about' })
    expect(matchedUrl).toBe('https://x.fr/fr/about')
  })
})

describe('gradeContentCoverage', () => {
  it('returns an F / zero result with a clear message when there is no data', () => {
    const res = gradeContentCoverage('whatever content', [], { locale: 'fr' })
    expect(res.grade).toBe('F')
    expect(res.score).toBe(0)
    expect(res.queryCount).toBe(0)
    expect(res.recommendations[0]).toMatch(/Pas encore assez/)
  })

  it('grades A when content fully covers queries that already convert at the curve', () => {
    const res = gradeContentCoverage('Plombier à Lyon.', [
      qrow('plombier lyon', { impressions: 500, clicks: 140, ctr: 0.28, position: 1 }),
    ])
    expect(res.components.coverage).toBe(100)
    expect(res.components.ctr).toBe(100) // 140 clicks == expected at position 1
    expect(res.components.position).toBe(100)
    expect(res.score).toBe(100)
    expect(res.grade).toBe('A')
    expect(res.coverageGaps).toHaveLength(0)
    expect(res.ctrGaps).toHaveLength(0)
  })

  it('detects coverage gaps and CTR gaps from real query rows', () => {
    const rows: GscQueryRow[] = [
      // fully covered, clicks at curve → no gap
      qrow('plombier lyon', { impressions: 300, clicks: 30, ctr: 0.1, position: 3 }),
      // terms absent from content + under-performing CTR + near-top position
      qrow('devis chaudière gaz', { impressions: 200, clicks: 2, ctr: 0.01, position: 5 }),
    ]
    const res = gradeContentCoverage('Plombier à Lyon.', rows, { locale: 'fr' })

    // weighted position = (300*3 + 200*5) / 500 = 3.8
    expect(res.weightedPosition).toBe(3.8)
    expect(res.totalImpressions).toBe(500)

    // coverage gap on the uncovered, near-top query
    expect(res.coverageGaps).toHaveLength(1)
    const gap = res.coverageGaps[0]!
    expect(gap.query).toBe('devis chaudière gaz')
    expect(gap.coverage).toBe(0)
    expect(gap.nearTop).toBe(true)
    expect(gap.missingTerms).toEqual(['devis', 'chaudiere', 'gaz'])

    // CTR gap: position 5 → expected ~0.055, actual 0.01 → ~9 potential clicks
    expect(res.ctrGaps).toHaveLength(1)
    const ctr = res.ctrGaps[0]!
    expect(ctr.query).toBe('devis chaudière gaz')
    expect(ctr.potentialClicks).toBe(9) // round(200 * (0.055 - 0.01))

    // recommendations reference both levers, in French
    expect(res.recommendations.some((r) => /Ajoutez une section/.test(r))).toBe(true)
    expect(res.recommendations.some((r) => /Optimisez le titre/.test(r))).toBe(true)
  })

  it('sorts coverage gaps with near-top queries first', () => {
    const rows: GscQueryRow[] = [
      qrow('terme absent un', { impressions: 1000, clicks: 0, ctr: 0, position: 40 }), // far, high impressions
      qrow('terme absent deux', { impressions: 100, clicks: 0, ctr: 0, position: 6 }), // near-top, fewer impressions
    ]
    const res = gradeContentCoverage('contenu sans rapport', rows, { locale: 'fr' })
    expect(res.coverageGaps[0]!.query).toBe('terme absent deux') // near-top wins ordering
    expect(res.coverageGaps[0]!.nearTop).toBe(true)
  })

  it('produces English recommendations when locale is en', () => {
    const res = gradeContentCoverage('Plumber in town.', [
      qrow('emergency boiler repair', { impressions: 200, clicks: 1, ctr: 0.005, position: 6 }),
    ], { locale: 'en' })
    expect(res.recommendations.some((r) => /Add a section covering/.test(r))).toBe(true)
  })

  it('caps gaps and recommendations via options', () => {
    const rows: GscQueryRow[] = Array.from({ length: 20 }, (_, i) =>
      qrow(`requete manquante ${i}`, { impressions: 100 + i, clicks: 0, ctr: 0, position: 6 }),
    )
    const res = gradeContentCoverage('contenu', rows, { locale: 'fr', maxGaps: 5, maxRecommendations: 3 })
    expect(res.coverageGaps.length).toBeLessThanOrEqual(5)
    expect(res.recommendations.length).toBeLessThanOrEqual(3)
  })
})
