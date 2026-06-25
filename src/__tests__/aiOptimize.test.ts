import { describe, it, expect } from 'vitest'
import { parseSuggestions, sanitizeSuggestions } from '../endpoints/aiOptimize.js'

describe('aiOptimize — parseSuggestions', () => {
  it('parses plain JSON', () => {
    const r = parseSuggestions('{"metaTitle":"A","metaDescription":"B","focusKeyword":"k","rationale":["x"]}')
    expect(r).toEqual({ metaTitle: 'A', metaDescription: 'B', focusKeyword: 'k', rationale: ['x'] })
  })

  it('strips ```json code fences the model may add despite instructions', () => {
    const r = parseSuggestions('```json\n{"metaTitle":"A","metaDescription":"B","focusKeyword":"","rationale":[]}\n```')
    expect(r?.metaTitle).toBe('A')
  })

  it('isolates the JSON object from surrounding prose', () => {
    const r = parseSuggestions(
      'Sure! Here is the JSON: {"metaTitle":"T","metaDescription":"D","focusKeyword":"","rationale":[]} Hope it helps.',
    )
    expect(r?.metaTitle).toBe('T')
    expect(r?.metaDescription).toBe('D')
  })

  it('returns null on invalid input', () => {
    expect(parseSuggestions('not json at all')).toBeNull()
    expect(parseSuggestions('{ broken')).toBeNull()
    expect(parseSuggestions('')).toBeNull()
  })

  it('coerces missing/wrong-typed fields to safe defaults', () => {
    const r = parseSuggestions('{"metaTitle":123,"rationale":"nope"}')
    expect(r).toEqual({ metaTitle: '', metaDescription: '', focusKeyword: '', rationale: [] })
  })
})

describe('aiOptimize — sanitizeSuggestions (server-side rule guarantee)', () => {
  it('clamps an overlong title to <= 70 chars', () => {
    const longTitle = 'word '.repeat(40).trim() // ~199 chars
    const r = sanitizeSuggestions({ metaTitle: longTitle, metaDescription: '', focusKeyword: '', rationale: [] }, '')
    expect(r.metaTitle.length).toBeLessThanOrEqual(70)
  })

  it('clamps an overlong description to <= 160 chars', () => {
    const longDesc = 'word '.repeat(60).trim()
    const r = sanitizeSuggestions({ metaTitle: '', metaDescription: longDesc, focusKeyword: '', rationale: [] }, '')
    expect(r.metaDescription.length).toBeLessThanOrEqual(160)
  })

  it('never overwrites an editor-set focus keyword', () => {
    const r = sanitizeSuggestions(
      { metaTitle: 'a', metaDescription: 'b', focusKeyword: 'ai-suggested', rationale: [] },
      'editor-choice',
    )
    expect(r.focusKeyword).toBe('editor-choice')
  })

  it('fills an EMPTY focus keyword with the suggestion', () => {
    const r = sanitizeSuggestions({ metaTitle: 'a', metaDescription: 'b', focusKeyword: 'new keyword', rationale: [] }, '')
    expect(r.focusKeyword).toBe('new keyword')
  })

  it('rejects an absurdly long suggested keyword', () => {
    const r = sanitizeSuggestions({ metaTitle: 'a', metaDescription: 'b', focusKeyword: 'x'.repeat(80), rationale: [] }, '')
    expect(r.focusKeyword).toBe('')
  })

  it('caps rationale to 4 items', () => {
    const r = sanitizeSuggestions(
      { metaTitle: 'a', metaDescription: 'b', focusKeyword: '', rationale: ['1', '2', '3', '4', '5', '6'] },
      '',
    )
    expect(r.rationale.length).toBe(4)
  })

  it('drops empty rationale entries', () => {
    const r = sanitizeSuggestions(
      { metaTitle: 'a', metaDescription: 'b', focusKeyword: '', rationale: ['  ', 'real', ''] },
      '',
    )
    expect(r.rationale).toEqual(['real'])
  })
})
