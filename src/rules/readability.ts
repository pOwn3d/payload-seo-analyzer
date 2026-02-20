/**
 * SEO Rules — Readability checks (weight: 2, category: important)
 * Locale-adapted readability analysis (FR: Kandel-Moles / Flesch FR, EN: standard Flesch).
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import {
  calculateFlesch,
  countWords,
  countLongSections,
  detectPassiveVoice,
  hasTransitionWord,
  extractTextFromLexical,
} from '../helpers.js'
import {
  FLESCH_THRESHOLDS,
  READABILITY_THRESHOLDS,
  LONG_SENTENCE_MAX_RATIO,
  LONG_PARAGRAPH_WORDS,
  CONSECUTIVE_SAME_START_MAX,
  LONG_SECTION_THRESHOLD,
} from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkReadability(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.readability
  const locale = ctx.locale || 'fr'
  const ft = FLESCH_THRESHOLDS[locale]
  const rt = READABILITY_THRESHOLDS[locale]
  const { fullText, sentences, wordCount } = ctx

  // Only run readability checks if there's enough content
  if (wordCount < 50) return checks

  // 38. Flesch reading ease (locale-adapted: FR = Kandel-Moles, EN = Flesch-Kincaid)
  const fleschScore = calculateFlesch(fullText, locale)

  if (fleschScore >= ft.pass) {
    checks.push({
      id: 'readability-flesch',
      label: r.fleschLabel,
      status: 'pass',
      message: r.fleschPass(fleschScore),
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else if (fleschScore >= ft.warn) {
    checks.push({
      id: 'readability-flesch',
      label: r.fleschLabel,
      status: 'warning',
      message: r.fleschWarn(fleschScore),
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else {
    checks.push({
      id: 'readability-flesch',
      label: r.fleschLabel,
      status: 'fail',
      message: r.fleschFail(fleschScore),
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  }

  // 39. Long sentences (>25 words) — max 30% of sentences
  if (sentences.length > 0) {
    const longSentences = sentences.filter((s) => countWords(s) > rt.longSentenceWords)
    const longRatio = longSentences.length / sentences.length

    if (longRatio > LONG_SENTENCE_MAX_RATIO) {
      checks.push({
        id: 'readability-long-sentences',
        label: r.longSentencesLabelFail,
        status: 'warning',
        message: r.longSentencesFail(longSentences.length, sentences.length, Math.round(longRatio * 100)),
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-long-sentences',
        label: r.longSentencesLabelPass,
        status: 'pass',
        message: r.longSentencesPass(Math.round(longRatio * 100)),
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
    label: r.longParagraphsLabel,
    status: hasLongParagraph ? 'warning' : 'pass',
    message: hasLongParagraph ? r.longParagraphsFail : r.longParagraphsPass,
    category: 'important',
    weight: 2,
    group: 'readability',
  })

  // 41. Passive voice — max 15% of sentences
  if (sentences.length > 0) {
    const passiveSentences = sentences.filter((s) => detectPassiveVoice(s, locale))
    const passiveRatio = passiveSentences.length / sentences.length

    if (passiveRatio > rt.passiveMax) {
      checks.push({
        id: 'readability-passive',
        label: r.passiveLabelFail,
        status: 'warning',
        message: r.passiveFail(passiveSentences.length, sentences.length, Math.round(passiveRatio * 100)),
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-passive',
        label: r.passiveLabelPass,
        status: 'pass',
        message: r.passivePass(Math.round(passiveRatio * 100)),
        category: 'important',
        weight: 2,
        group: 'readability',
      })
    }
  }

  // 42. Transition words — at least 15% of sentences
  if (sentences.length > 0) {
    const withTransition = sentences.filter((s) => hasTransitionWord(s, locale))
    const transitionRatio = withTransition.length / sentences.length

    if (transitionRatio < rt.transitionsMin) {
      checks.push({
        id: 'readability-transitions',
        label: r.transitionsLabel,
        status: 'warning',
        message: r.transitionsFail(Math.round(transitionRatio * 100)),
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-transitions',
        label: r.transitionsLabel,
        status: 'pass',
        message: r.transitionsPass(Math.round(transitionRatio * 100)),
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
        label: r.consecutiveLabelFail,
        status: 'warning',
        message: r.consecutiveFail(maxConsecutive),
        category: 'bonus',
        weight: 1,
        group: 'readability',
      })
    } else {
      checks.push({
        id: 'readability-consecutive-starts',
        label: r.consecutiveLabelPass,
        status: 'pass',
        message: r.consecutivePass,
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
      label: r.longSectionsLabelFail,
      status: 'warning',
      message: r.longSectionsFail(totalLongSections),
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  } else if (wordCount > 300) {
    checks.push({
      id: 'readability-long-sections',
      label: r.longSectionsLabelPass,
      status: 'pass',
      message: r.longSectionsPass,
      category: 'important',
      weight: 2,
      group: 'readability',
    })
  }

  return checks
}
