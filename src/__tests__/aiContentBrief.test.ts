import { describe, it, expect } from 'vitest'
import { parseBrief, sanitizeBrief, type ContentBrief } from '../endpoints/aiContentBrief.js'

const valid = JSON.stringify({
  outline: [
    { level: 'h2', text: 'Intro' },
    { level: 'h3', text: 'Sub' },
    { level: 'x', text: 'Coerced to h2' },
    { level: 'h2', text: '' },
  ],
  entities: ['a', 'b', '  ', 'c'],
  questions: ['q1?'],
  internalLinkIdeas: ['link a'],
  recommendedWordCount: 1200.7,
  notes: ['note'],
})

describe('aiContentBrief — parseBrief', () => {
  it('parses a valid brief', () => {
    const b = parseBrief(valid)
    expect(b).not.toBeNull()
    expect(b!.outline).toHaveLength(3) // empty-text outline dropped
    expect(b!.outline[2]).toEqual({ level: 'h2', text: 'Coerced to h2' })
    expect(b!.entities).toEqual(['a', 'b', 'c']) // blank dropped
    expect(b!.recommendedWordCount).toBe(1201) // rounded
  })

  it('strips code fences', () => {
    const b = parseBrief('```json\n' + valid + '\n```')
    expect(b).not.toBeNull()
    expect(b!.questions).toEqual(['q1?'])
  })

  it('isolates JSON from prose', () => {
    const b = parseBrief('Here is your brief: ' + valid + ' — enjoy!')
    expect(b).not.toBeNull()
  })

  it('returns null on invalid input', () => {
    expect(parseBrief('not json')).toBeNull()
    expect(parseBrief('')).toBeNull()
  })
})

describe('aiContentBrief — sanitizeBrief', () => {
  it('caps list lengths and word count range', () => {
    const big: ContentBrief = {
      outline: Array.from({ length: 40 }, (_, i) => ({ level: 'h2' as const, text: `H${i}` })),
      entities: Array.from({ length: 50 }, (_, i) => `e${i}`),
      questions: Array.from({ length: 40 }, (_, i) => `q${i}`),
      internalLinkIdeas: Array.from({ length: 40 }, (_, i) => `l${i}`),
      recommendedWordCount: 999999,
      notes: Array.from({ length: 20 }, (_, i) => `n${i}`),
    }
    const b = sanitizeBrief(big)
    expect(b.outline.length).toBe(25)
    expect(b.entities.length).toBe(30)
    expect(b.questions.length).toBe(15)
    expect(b.internalLinkIdeas.length).toBe(10)
    expect(b.notes.length).toBe(6)
    expect(b.recommendedWordCount).toBe(10000)
  })
})
