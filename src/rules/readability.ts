/**
 * SEO Rules — Readability checks (weight: 2, category: important)
 * French-adapted readability analysis (Kandel-Moles / Flesch FR).
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import {
  calculateFleschFR,
  countWords,
  countLongSections,
  detectPassiveVoice,
  hasTransitionWord,
  extractTextFromLexical,
} from '../helpers'
import {
  FLESCH_SCORE_PASS,
  FLESCH_SCORE_WARN,
  LONG_SENTENCE_WORDS,
  LONG_SENTENCE_MAX_RATIO,
  LONG_PARAGRAPH_WORDS,
  PASSIVE_VOICE_MAX_RATIO,
  TRANSITION_WORDS_MIN_RATIO,
  CONSECUTIVE_SAME_START_MAX,
  LONG_SECTION_THRESHOLD,
} from '../constants'

export function checkReadability(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { fullText, sentences, wordCount } = ctx

  // Only run readability checks if there's enough content
  if (wordCount < 50) return checks

  // 38. Flesch reading ease (French adaptation — Kandel-Moles)
  // Thresholds adapted for French: words have more syllables (suffixes -tion, -ment,
  // -ité) and sentences are structurally longer (articles, prepositions, relatives).
  // A score of 40-50 in French is equivalent to 55-65 in English.
  const fleschScore = calculateFleschFR(fullText)

  if (fleschScore >= FLESCH_SCORE_PASS) {
    checks.push({
      id: 'readability-flesch',
      label: 'Score de lisibilite',
      status: 'pass',
      message: `Score Flesch FR : ${fleschScore}/100 — Texte accessible.`,
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else if (fleschScore >= FLESCH_SCORE_WARN) {
    checks.push({
      id: 'readability-flesch',
      label: 'Score de lisibilite',
      status: 'warning',
      message: `Score Flesch FR : ${fleschScore}/100 — Texte assez difficile. Simplifiez les phrases.`,
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else {
    checks.push({
      id: 'readability-flesch',
      label: 'Score de lisibilite',
      status: 'fail',
      message: `Score Flesch FR : ${fleschScore}/100 — Texte difficile a lire. Raccourcissez les phrases et simplifiez le vocabulaire.`,
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  }

  // 39. Long sentences (>25 words) — max 30% of sentences
  // Adapted for French: articles (le/la/les), prepositions (de/du/à/en) and
  // pronouns (qui/que/dont) make French sentences structurally longer than English.
  // A 25-word French sentence carries roughly the same info as a 20-word English one.
  if (sentences.length > 0) {
    const longSentences = sentences.filter((s) => countWords(s) > LONG_SENTENCE_WORDS)
    const longRatio = longSentences.length / sentences.length

    if (longRatio > LONG_SENTENCE_MAX_RATIO) {
      checks.push({
        id: 'readability-long-sentences',
        label: 'Phrases trop longues',
        status: 'warning',
        message: `${longSentences.length}/${sentences.length} phrases de plus de 25 mots (${Math.round(longRatio * 100)}%) — Max recommande : 30%.`,
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-long-sentences',
        label: 'Longueur des phrases',
        status: 'pass',
        message: `${Math.round(longRatio * 100)}% de phrases longues — Bonne distribution.`,
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    }
  }

  // 40. Long paragraphs (>150 words) — check in Lexical content
  const sources = [input.heroRichText, input.content].filter(Boolean)
  if (input.blocks && Array.isArray(input.blocks)) {
    for (const block of input.blocks) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      if (b.columns && Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.richText) sources.push(colObj.richText)
          }
        }
      }
      if (b.richText) sources.push(b.richText)
    }
  }

  // Check for paragraphs > 150 words
  let hasLongParagraph = false
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const n = source as Record<string, unknown>
    const root = (n.root as Record<string, unknown>) || n
    if (!Array.isArray(root.children)) continue

    for (const child of root.children) {
      const c = child as Record<string, unknown>
      if (c.type === 'paragraph') {
        const text = extractTextFromLexical(c)
        if (countWords(text) > LONG_PARAGRAPH_WORDS) {
          hasLongParagraph = true
          break
        }
      }
    }
    if (hasLongParagraph) break
  }

  checks.push({
    id: 'readability-long-paragraphs',
    label: 'Paragraphes longs',
    status: hasLongParagraph ? 'warning' : 'pass',
    message: hasLongParagraph
      ? 'Des paragraphes de plus de 150 mots ont ete detectes — Decoupez-les pour faciliter la lecture.'
      : 'Aucun paragraphe excessivement long.',
    category: 'important',
    weight: 2,
    group: 'readability',
  })

  // 41. Passive voice — max 15% of sentences
  // Raised from 10% to 15%: French naturally uses more "être + participe passé"
  // constructions than English (state descriptions, impersonal forms in B2B copy).
  // The regex also now excludes passé composé with être-verbs (aller, venir, etc.)
  if (sentences.length > 0) {
    const passiveSentences = sentences.filter((s) => detectPassiveVoice(s))
    const passiveRatio = passiveSentences.length / sentences.length

    if (passiveRatio > PASSIVE_VOICE_MAX_RATIO) {
      checks.push({
        id: 'readability-passive',
        label: 'Voix passive',
        status: 'warning',
        message: `${passiveSentences.length}/${sentences.length} phrases a la voix passive (${Math.round(passiveRatio * 100)}%) — Max recommande : 15%.`,
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-passive',
        label: 'Voix active',
        status: 'pass',
        message: `${Math.round(passiveRatio * 100)}% de voix passive — Bon usage de la voix active.`,
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    }
  }

  // 42. Transition words — at least 15% of sentences
  // Lowered from 30% → 20% → 15%: French web copy (especially service pages,
  // landing pages) uses short punchy sentences that don't always need connectors.
  if (sentences.length > 0) {
    const withTransition = sentences.filter((s) => hasTransitionWord(s))
    const transitionRatio = withTransition.length / sentences.length

    if (transitionRatio < TRANSITION_WORDS_MIN_RATIO) {
      checks.push({
        id: 'readability-transitions',
        label: 'Mots de transition',
        status: 'warning',
        message: `${Math.round(transitionRatio * 100)}% des phrases contiennent des mots de transition — Visez 15%+.`,
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-transitions',
        label: 'Mots de transition',
        status: 'pass',
        message: `${Math.round(transitionRatio * 100)}% des phrases avec mots de transition — Bonne fluidite.`,
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    }
  }

  // 43. Consecutive sentences starting with the same word (3+ = warning)
  if (sentences.length >= 3) {
    let maxConsecutive = 1
    let currentStreak = 1

    for (let i = 1; i < sentences.length; i++) {
      const prevFirstWord = sentences[i - 1].trim().split(/\s+/)[0]?.toLowerCase() || ''
      const currFirstWord = sentences[i].trim().split(/\s+/)[0]?.toLowerCase() || ''

      if (prevFirstWord && currFirstWord && prevFirstWord === currFirstWord) {
        currentStreak++
        if (currentStreak > maxConsecutive) maxConsecutive = currentStreak
      } else {
        currentStreak = 1
      }
    }

    if (maxConsecutive >= CONSECUTIVE_SAME_START_MAX) {
      checks.push({
        id: 'readability-consecutive-starts',
        label: 'Debuts de phrases repetitifs',
        status: 'warning',
        message: `${maxConsecutive} phrases consecutives commencent par le meme mot — Variez les debuts de phrases.`,
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-consecutive-starts',
        label: 'Variete des phrases',
        status: 'pass',
        message: 'Les debuts de phrases sont suffisamment varies.',
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    }
  }

  // 44. Sections too long without subheadings (>400 words)
  let totalLongSections = 0
  for (const source of sources) {
    totalLongSections += countLongSections(source, LONG_SECTION_THRESHOLD)
  }

  if (totalLongSections > 0) {
    checks.push({
      id: 'readability-long-sections',
      label: 'Sections sans sous-titre',
      status: 'warning',
      message: `${totalLongSections} section(s) de plus de 400 mots sans sous-titre — Decoupez avec des h2/h3.`,
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else if (wordCount > 300) {
    checks.push({
      id: 'readability-long-sections',
      label: 'Structure en sections',
      status: 'pass',
      message: 'Les sections sont bien decoupees avec des sous-titres.',
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  }

  return checks
}
