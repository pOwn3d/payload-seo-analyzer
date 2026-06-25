/**
 * SEO Rules — Open Graph / Twitter social checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { SOCIAL_TITLE_MAX, SOCIAL_DESC_MAX } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkSocial(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.social

  // 34. OG/meta image defined
  const hasMetaImage =
    !!input.metaImage &&
    (typeof input.metaImage === 'number' ||
      (typeof input.metaImage === 'object' && input.metaImage !== null))

  if (!hasMetaImage) {
    checks.push({
      id: 'social-og-image',
      label: r.ogImageLabel,
      status: 'warning',
      message: r.ogImageFail,
      category: 'important',
      weight: 2,
      group: 'social',
    })
  } else {
    checks.push({
      id: 'social-og-image',
      label: r.ogImageLabel,
      status: 'pass',
      message: r.ogImagePass,
      category: 'important',
      weight: 2,
      group: 'social',
    })
  }

  // 35. Meta title not too long for OG (truncation on social platforms ~65 chars)
  const title = input.metaTitle || ''
  if (title && title.length > SOCIAL_TITLE_MAX) {
    checks.push({
      id: 'social-title-truncation',
      label: r.titleTruncLabel,
      status: 'warning',
      message: r.titleTruncFail(title.length),
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  } else if (title) {
    checks.push({
      id: 'social-title-truncation',
      label: r.titleTruncLabel,
      status: 'pass',
      message: r.titleTruncPass,
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  }

  // 36. Meta description appropriate for social sharing (~155 chars on Facebook)
  const desc = input.metaDescription || ''
  if (desc && desc.length > SOCIAL_DESC_MAX) {
    checks.push({
      id: 'social-desc-length',
      label: r.descLengthLabel,
      status: 'warning',
      message: r.descLengthFail(desc.length),
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  } else if (desc) {
    checks.push({
      id: 'social-desc-length',
      label: r.descLengthLabel,
      status: 'pass',
      message: r.descLengthPass,
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  }

  return checks
}
