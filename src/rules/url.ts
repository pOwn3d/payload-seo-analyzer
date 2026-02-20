/**
 * SEO Rules — URL/Slug checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { slugifyKeyword, isStopWordInCompoundExpression } from '../helpers.js'
import { SLUG_MAX_LENGTH, getUtilitySlugs, getStopWords, getStopWordCompounds } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkUrl(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.url
  const slug = input.slug || ''
  const kw = ctx.normalizedKeyword

  // 10. Slug present
  if (!slug) {
    checks.push({
      id: 'slug-missing',
      label: r.missingLabel,
      status: 'fail',
      message: r.missingMessage,
      category: 'important',
      weight: 2,
      group: 'url',
    })
    return checks
  }

  // 11. Length <= SLUG_MAX_LENGTH characters
  if (slug.length > SLUG_MAX_LENGTH) {
    checks.push({
      id: 'slug-length',
      label: r.lengthLabel,
      status: 'warning',
      message: r.lengthFail(slug.length),
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-length',
      label: r.lengthLabel,
      status: 'pass',
      message: r.lengthPass(slug.length),
      category: 'important',
      weight: 2,
      group: 'url',
    })
  }

  // 12. No special characters or uppercase
  if (/[A-Z]/.test(slug) || /[^a-z0-9\-/]/.test(slug)) {
    checks.push({
      id: 'slug-format',
      label: r.formatLabel,
      status: 'warning',
      message: r.formatFail,
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-format',
      label: r.formatLabel,
      status: 'pass',
      message: r.formatPass,
      category: 'important',
      weight: 2,
      group: 'url',
    })
  }

  // 13. Focus keyword in slug (strips accents and special chars like . & /)
  // Skip for utility/standard slugs where keyword in URL is not applicable
  const locale = ctx.locale || 'fr'
  const allUtilitySlugs = [...getUtilitySlugs('fr'), ...getUtilitySlugs('en')]
  const isUtilitySlug = allUtilitySlugs.some((us) => slug === us || slug.endsWith(`/${us}`))

  if (kw && !isUtilitySlug) {
    const kwSlugified = slugifyKeyword(input.focusKeyword || kw)
    const slugLower = slug.toLowerCase()
    // Check if slug contains the slugified keyword (or individual significant words)
    const slugContainsKw =
      slugLower.includes(kwSlugified) ||
      // Fallback: check if all significant keyword words (>3 chars) appear in slug
      kwSlugified.split('-').filter((w) => w.length > 3).every((w) => slugLower.includes(w))
    checks.push({
      id: 'slug-keyword',
      label: r.keywordLabel,
      status: slugContainsKw ? 'pass' : 'warning',
      message: slugContainsKw
        ? r.keywordPass
        : r.keywordFail(input.focusKeyword || kw),
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else if (kw && isUtilitySlug) {
    // Utility slugs get an automatic pass — their purpose is clear from the slug
    checks.push({
      id: 'slug-keyword',
      label: r.keywordLabel,
      status: 'pass',
      message: r.keywordUtilityPass,
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  }

  // 14. No stop words in slug (excluding compound expressions)
  const stopWords = getStopWords(locale)
  const compounds = [...getStopWordCompounds(locale), ...(ctx.config.stopWordCompounds || [])]
  const slugParts = slug.split('-')
  const foundStopWords = slugParts.filter((part, idx) =>
    stopWords.includes(part) && !isStopWordInCompoundExpression(slugParts, idx, compounds),
  )

  if (foundStopWords.length > 0) {
    checks.push({
      id: 'slug-stopwords',
      label: r.stopwordsLabel,
      status: 'warning',
      message: r.stopwordsFail(foundStopWords.join(', ')),
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-stopwords',
      label: r.stopwordsLabel,
      status: 'pass',
      message: r.stopwordsPass,
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  }

  return checks
}
