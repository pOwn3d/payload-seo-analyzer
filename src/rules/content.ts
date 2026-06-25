/**
 * SEO Rules — Content checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { normalizeForComparison, keywordMatchesText, countKeywordOccurrences, extractListsFromLexical } from '../helpers.js'
import {
  MIN_WORDS_POST,
  MIN_WORDS_FORM,
  MIN_WORDS_LEGAL,
  MIN_WORDS_GENERIC,
  MIN_WORDS_THIN,
  KEYWORD_DENSITY_MAX,
  KEYWORD_DENSITY_WARN,
  PLACEHOLDER_PATTERNS,
} from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkContent(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.content
  const { fullText, wordCount, normalizedKeyword, isPost, pageType } = ctx

  // Adapted min words by page type
  const isFormPage = pageType === 'form' || pageType === 'contact'
  const isLegalPage = pageType === 'legal'
  const minWords = isPost ? MIN_WORDS_POST : isFormPage ? MIN_WORDS_FORM : isLegalPage ? MIN_WORDS_LEGAL : MIN_WORDS_GENERIC
  const minLabel = isPost
    ? r.minWordsPost
    : isFormPage
      ? r.minWordsForm
      : isLegalPage
        ? r.minWordsLegal
        : r.minWordsGeneric

  // 20. Minimum word count
  if (wordCount < MIN_WORDS_THIN) {
    checks.push({
      id: 'content-wordcount',
      label: r.wordcountLabel,
      status: 'fail',
      message: r.wordcountFail(wordCount, minLabel),
      category: 'important',
      weight: 2,
      group: 'content',
      tip: r.wordcountFailTip,
    })
  } else if (wordCount < minWords) {
    checks.push({
      id: 'content-wordcount',
      label: r.wordcountLabel,
      status: 'warning',
      message: r.wordcountWarn(wordCount, minLabel),
      category: 'important',
      weight: 2,
      group: 'content',
      tip: r.wordcountWarnTip,
    })
  } else {
    checks.push({
      id: 'content-wordcount',
      label: r.wordcountLabel,
      status: 'pass',
      message: r.wordcountPass(wordCount),
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // 21. Focus keyword in the first paragraph (smart French matching)
  if (normalizedKeyword && fullText.trim()) {
    // First ~500 characters or up to first newline / sentence-ending period
    const firstParagraph = normalizeForComparison(fullText.trim().slice(0, 500))
    // Split on sentence-ending periods (followed by space/end) or newlines,
    // but NOT mid-word dots like in "node.js", "next.js", "vue.js", etc.
    const firstParaWords = firstParagraph.split(/\.(?=\s|$)|\n/).slice(0, 2).join(' ')
    const kwInFirstPara = keywordMatchesText(normalizedKeyword, firstParaWords)

    checks.push({
      id: 'content-keyword-intro',
      label: r.keywordIntroLabel,
      status: kwInFirstPara ? 'pass' : 'warning',
      message: kwInFirstPara
        ? r.keywordIntroPass
        : r.keywordIntroFail(input.focusKeyword || normalizedKeyword),
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // 22-23. Keyword density — OVER-optimisation guard ONLY.
  // SEO desintox (2026): a minimum-density floor is a myth that pushes toward
  // keyword stuffing (a Google spam-policy signal). We only PENALISE over-stuffing;
  // at or below the natural range, density is purely informational (weight 0) and
  // never drags the score down.
  if (normalizedKeyword && wordCount > 0) {
    const fullTextLower = normalizeForComparison(fullText)
    const { exactCount, wordLevelMatch, effectiveDensity } =
      countKeywordOccurrences(normalizedKeyword, fullTextLower, wordCount)

    const density = effectiveDensity

    if (density > KEYWORD_DENSITY_MAX) {
      checks.push({
        id: 'content-keyword-density',
        label: r.densityLabel,
        status: 'fail',
        message: r.densityOverstuffed(density.toFixed(1)),
        category: 'critical',
        weight: 3,
        group: 'content',
      })
    } else if (density > KEYWORD_DENSITY_WARN) {
      checks.push({
        id: 'content-keyword-density',
        label: r.densityLabel,
        status: 'warning',
        message: r.densityHigh(density.toFixed(1)),
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else {
      // Natural / low density — informational only (weight 0). No floor penalty.
      const present = exactCount > 0 || wordLevelMatch
      checks.push({
        id: 'content-keyword-density',
        label: r.densityLabel,
        status: 'pass',
        message: present
          ? r.densityPass(density.toFixed(1))
          : r.densityMissing(input.focusKeyword || normalizedKeyword),
        category: 'bonus',
        weight: 0,
        group: 'content',
      })
    }
  }

  // 24. No placeholder content
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some((p) => p.test(fullText))

  checks.push({
    id: 'content-no-placeholder',
    label: r.placeholderLabel,
    status: hasPlaceholder ? 'fail' : 'pass',
    message: hasPlaceholder ? r.placeholderFail : r.placeholderPass,
    category: 'critical',
    weight: 3,
    group: 'content',
    ...(hasPlaceholder && { tip: r.placeholderTip }),
  })

  // 25. Not thin content (>MIN_WORDS_THIN words of unique text)
  if (wordCount > 0 && wordCount <= MIN_WORDS_THIN) {
    checks.push({
      id: 'content-thin',
      label: r.thinWarnLabel,
      status: 'warning',
      message: r.thinWarn(wordCount),
      category: 'important',
      weight: 2,
      group: 'content',
      tip: r.thinWarnTip,
    })
  } else if (wordCount > MIN_WORDS_THIN) {
    checks.push({
      id: 'content-thin',
      label: r.thinPassLabel,
      status: 'pass',
      message: r.thinPass,
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // C1. Keyword distribution across content tiers — INFORMATIONAL only.
  // SEO desintox (2026): this is a disguised density metric, not a ranking factor.
  // Kept as a neutral, non-scoring hint (weight 0) so it never penalises content
  // that simply doesn't repeat the keyword in every section.
  if (normalizedKeyword && wordCount >= 100) {
    const fullTextNorm = normalizeForComparison(fullText)
    const thirdLen = Math.floor(fullTextNorm.length / 3)
    const tier1 = fullTextNorm.slice(0, thirdLen)
    const tier2 = fullTextNorm.slice(thirdLen, thirdLen * 2)
    const tier3 = fullTextNorm.slice(thirdLen * 2)

    const tiersWithKw = [tier1, tier2, tier3].filter(
      (t) => keywordMatchesText(normalizedKeyword, t),
    ).length

    const wellDistributed = tiersWithKw >= 2
    checks.push({
      id: 'content-keyword-distribution',
      label: r.distributionLabel,
      status: wellDistributed ? 'pass' : 'warning',
      message: wellDistributed ? r.distributionPass(tiersWithKw) : r.distributionWarn,
      category: 'bonus',
      weight: 0,
      group: 'content',
      ...(wellDistributed ? {} : { tip: r.distributionWarnTip }),
    })
  }

  // C3. Presence of lists (ol/ul) — improves readability and featured snippets
  if (wordCount > 500) {
    // Collect lists from all Lexical sources
    const allLists: Array<{ listType: string; items: number }> = []

    if (input.heroRichText) {
      allLists.push(...extractListsFromLexical(input.heroRichText))
    }
    if (input.content) {
      allLists.push(...extractListsFromLexical(input.content))
    }
    if (input.blocks && Array.isArray(input.blocks)) {
      for (const block of input.blocks) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        if (b.richText) allLists.push(...extractListsFromLexical(b.richText))
        if (b.columns && Array.isArray(b.columns)) {
          for (const col of b.columns) {
            if (col && typeof col === 'object') {
              const c = col as Record<string, unknown>
              if (c.richText) allLists.push(...extractListsFromLexical(c.richText))
            }
          }
        }
      }
    }

    if (allLists.length > 0) {
      checks.push({
        id: 'content-has-lists',
        label: r.listsLabel,
        status: 'pass',
        message: r.listsPass(allLists.length),
        category: 'bonus',
        weight: 1,
        group: 'content',
      })
    } else {
      checks.push({
        id: 'content-has-lists',
        label: r.listsLabel,
        status: 'warning',
        message: r.listsFail,
        category: 'bonus',
        weight: 1,
        group: 'content',
        tip: r.listsTip,
      })
    }
  }

  return checks
}
