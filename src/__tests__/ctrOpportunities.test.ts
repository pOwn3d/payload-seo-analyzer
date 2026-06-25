import { describe, it, expect } from 'vitest'
import { expectedCtrForPosition, rankCtrOpportunities } from '../endpoints/ctrOpportunities.js'
import type { GscRow } from '../helpers/gscClient.js'

describe('expectedCtrForPosition', () => {
  it('returns the curve values at integer positions', () => {
    expect(expectedCtrForPosition(1)).toBeCloseTo(0.28)
    expect(expectedCtrForPosition(2)).toBeCloseTo(0.15)
    expect(expectedCtrForPosition(10)).toBeCloseTo(0.022)
  })
  it('interpolates between positions', () => {
    const v = expectedCtrForPosition(1.5)
    expect(v).toBeLessThan(0.28)
    expect(v).toBeGreaterThan(0.15)
  })
  it('floors past page 1 / page 2', () => {
    expect(expectedCtrForPosition(15)).toBeCloseTo(0.012)
    expect(expectedCtrForPosition(50)).toBeCloseTo(0.005)
  })
})

const row = (url: string, impressions: number, ctr: number, position: number): GscRow => ({
  keys: [url],
  impressions,
  clicks: Math.round(impressions * ctr),
  ctr,
  position,
})

describe('rankCtrOpportunities', () => {
  it('flags a well-ranked low-CTR page', () => {
    // position 3 → expected ~0.10 ; actual 0.02 → big gap, 1000 impressions
    const opps = rankCtrOpportunities([row('https://x/a', 1000, 0.02, 3)])
    expect(opps).toHaveLength(1)
    expect(opps[0].potentialClicks).toBe(Math.round(1000 * (0.1 - 0.02)))
  })

  it('skips pages below the impressions floor', () => {
    expect(rankCtrOpportunities([row('https://x/a', 10, 0.0, 3)], { minImpressions: 50 })).toHaveLength(0)
  })

  it('skips pages beyond page 2 (position > 20)', () => {
    expect(rankCtrOpportunities([row('https://x/a', 1000, 0.0, 35)])).toHaveLength(0)
  })

  it('skips pages already above the expected CTR', () => {
    expect(rankCtrOpportunities([row('https://x/a', 1000, 0.5, 3)])).toHaveLength(0)
  })

  it('sorts by potential clicks desc', () => {
    const opps = rankCtrOpportunities([
      row('https://x/small', 200, 0.01, 5),
      row('https://x/big', 5000, 0.01, 5),
    ])
    expect(opps[0].url).toBe('https://x/big')
  })
})
