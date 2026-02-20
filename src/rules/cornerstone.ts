/**
 * SEO Rules — Cornerstone / pillar content checks.
 * These checks only run when `isCornerstone` is true on the document.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { CORNERSTONE_MIN_WORDS, CORNERSTONE_MIN_INTERNAL_LINKS, META_DESC_LENGTH_MIN, META_DESC_LENGTH_MAX } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkCornerstone(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  // Skip entirely if the content is not marked as cornerstone
  if (!input.isCornerstone) return []

  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.cornerstone

  // 1. Word count >= CORNERSTONE_MIN_WORDS (cornerstone should be comprehensive)
  if (ctx.wordCount >= CORNERSTONE_MIN_WORDS) {
    checks.push({
      id: 'cornerstone-wordcount',
      label: r.wordcountLabel,
      status: 'pass',
      message: r.wordcountPass(ctx.wordCount),
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-wordcount',
      label: r.wordcountLabel,
      status: 'warning',
      message: r.wordcountFail(ctx.wordCount),
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  }

  // 2. Internal links >= 5 (cornerstone should link to related content)
  const internalLinks = ctx.allLinks.filter(
    (l) => l.url.startsWith('/') || l.url.startsWith('#') || !l.url.startsWith('http'),
  )

  if (internalLinks.length >= CORNERSTONE_MIN_INTERNAL_LINKS) {
    checks.push({
      id: 'cornerstone-internal-links',
      label: r.internalLinksLabel,
      status: 'pass',
      message: r.internalLinksPass(internalLinks.length),
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-internal-links',
      label: r.internalLinksLabel,
      status: 'warning',
      message: r.internalLinksFail(internalLinks.length),
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  }

  // 3. Focus keyword present (mandatory for cornerstone)
  if (ctx.normalizedKeyword) {
    checks.push({
      id: 'cornerstone-focus-keyword',
      label: r.focusKeywordLabel,
      status: 'pass',
      message: r.focusKeywordPass,
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-focus-keyword',
      label: r.focusKeywordLabel,
      status: 'fail',
      message: r.focusKeywordFail,
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  }

  // 4. Meta description present and optimized
  const metaDesc = input.metaDescription || ''
  if (metaDesc.length >= META_DESC_LENGTH_MIN && metaDesc.length <= META_DESC_LENGTH_MAX) {
    checks.push({
      id: 'cornerstone-meta-description',
      label: r.metaDescLabel,
      status: 'pass',
      message: r.metaDescPass(metaDesc.length),
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else if (metaDesc.length > 0) {
    checks.push({
      id: 'cornerstone-meta-description',
      label: r.metaDescLabel,
      status: 'warning',
      message: r.metaDescWarn(metaDesc.length),
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-meta-description',
      label: r.metaDescLabel,
      status: 'fail',
      message: r.metaDescFail,
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  }

  return checks
}
