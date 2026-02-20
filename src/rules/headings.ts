/**
 * SEO Rules — Headings H1-H6 checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { checkHeadingHierarchy, normalizeForComparison, keywordMatchesText } from '../helpers.js'
import { WORDS_PER_HEADING } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkHeadings(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.headings
  const { allHeadings, normalizedKeyword, wordCount } = ctx

  // 15. H1 unique — count from heading nodes (includes post title added by buildContext)
  const h1Count = allHeadings.filter((h) => h.tag === 'h1').length

  if (h1Count === 0) {
    checks.push({
      id: 'h1-missing',
      label: r.h1MissingLabel,
      status: 'fail',
      message: r.h1MissingMessage,
      category: 'important',
      weight: 2,
      group: 'headings',
      tip: r.h1MissingTip,
    })
  } else if (h1Count > 1) {
    checks.push({
      id: 'h1-unique',
      label: r.h1UniqueLabel,
      status: 'warning',
      message: r.h1MultipleMessage(h1Count),
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  } else {
    checks.push({
      id: 'h1-unique',
      label: r.h1UniqueLabel,
      status: 'pass',
      message: r.h1UniquePass,
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  }

  // 16. Focus keyword in H1 (smart French matching, post title included by buildContext)
  if (normalizedKeyword) {
    const h1Headings = allHeadings.filter((h) => h.tag === 'h1')
    const allH1Text = h1Headings.map((h) => normalizeForComparison(h.text)).join(' ')
    const kwInH1 = keywordMatchesText(normalizedKeyword, allH1Text)

    checks.push({
      id: 'h1-keyword',
      label: r.h1KeywordLabel,
      status: kwInH1 ? 'pass' : 'warning',
      message: kwInH1
        ? r.h1KeywordPass
        : r.h1KeywordFail(input.focusKeyword || normalizedKeyword),
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  }

  // 17. Heading hierarchy (no level skipping)
  const goodHierarchy = checkHeadingHierarchy(allHeadings)
  checks.push({
    id: 'heading-hierarchy',
    label: r.hierarchyLabel,
    status: goodHierarchy ? 'pass' : 'warning',
    message: goodHierarchy ? r.hierarchyPass : r.hierarchyFail,
    category: 'important',
    weight: 2,
    group: 'headings',
  })

  // 18. Focus keyword in at least one H2 (smart French matching)
  if (normalizedKeyword) {
    const h2s = allHeadings.filter((h) => h.tag === 'h2')
    const kwInH2 = h2s.some((h) => keywordMatchesText(normalizedKeyword, normalizeForComparison(h.text)))

    if (h2s.length > 0) {
      checks.push({
        id: 'h2-keyword',
        label: r.h2KeywordLabel,
        status: kwInH2 ? 'pass' : 'warning',
        message: kwInH2
          ? r.h2KeywordPass
          : r.h2KeywordFail(input.focusKeyword || normalizedKeyword),
        category: 'important',
        weight: 2,
        group: 'headings',
      })
    }
  }

  // 19. One heading every ~WORDS_PER_HEADING words
  const nonH1Headings = allHeadings.filter((h) => h.tag !== 'h1')
  if (wordCount > WORDS_PER_HEADING) {
    const expectedHeadings = Math.floor(wordCount / WORDS_PER_HEADING)
    const hasEnoughHeadings = nonH1Headings.length >= expectedHeadings

    checks.push({
      id: 'heading-frequency',
      label: r.frequencyLabel,
      status: hasEnoughHeadings ? 'pass' : 'warning',
      message: hasEnoughHeadings
        ? r.frequencyPass(nonH1Headings.length, wordCount)
        : r.frequencyFail(nonH1Headings.length, wordCount),
      category: 'bonus',
      weight: 1,
      group: 'headings',
      ...(!hasEnoughHeadings && { tip: r.frequencyTip }),
    })
  }

  // C4. H1 vs meta title — should not be identical
  if (input.metaTitle) {
    const h1Headings = allHeadings.filter((h) => h.tag === 'h1')
    if (h1Headings.length > 0) {
      const h1Norm = normalizeForComparison(h1Headings[0].text)
      const titleNorm = normalizeForComparison(input.metaTitle)

      if (h1Norm && titleNorm && h1Norm === titleNorm) {
        checks.push({
          id: 'h1-title-different',
          label: r.h1TitleDiffLabel,
          status: 'warning',
          message: r.h1TitleDiffFail,
          category: 'important',
          weight: 1,
          group: 'headings',
          tip: r.h1TitleDiffTip,
        })
      } else {
        checks.push({
          id: 'h1-title-different',
          label: r.h1TitleDiffLabel,
          status: 'pass',
          message: r.h1TitleDiffPass,
          category: 'important',
          weight: 1,
          group: 'headings',
        })
      }
    }
  }

  return checks
}
