/**
 * SEO Rules — Open Graph / Twitter social checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { SOCIAL_TITLE_MAX, SOCIAL_DESC_MAX } from '../constants'

export function checkSocial(input: SeoInput, _ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // 34. OG/meta image defined
  const hasMetaImage =
    !!input.metaImage &&
    (typeof input.metaImage === 'number' ||
      (typeof input.metaImage === 'object' && input.metaImage !== null))

  if (!hasMetaImage) {
    checks.push({
      id: 'social-og-image',
      label: 'Image OG (meta)',
      status: 'warning',
      message:
        'Aucune image meta definie — Ajoutez une image pour le partage sur les reseaux sociaux.',
      category: 'important',
      weight: 2,
      group: 'social',
    })
  } else {
    checks.push({
      id: 'social-og-image',
      label: 'Image OG (meta)',
      status: 'pass',
      message: 'Image meta definie — Parfait pour le partage social.',
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
      label: 'Title sur les reseaux',
      status: 'warning',
      message: `Le title (${title.length} car.) sera tronque sur certains reseaux sociaux (max ~65 car.).`,
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  } else if (title) {
    checks.push({
      id: 'social-title-truncation',
      label: 'Title sur les reseaux',
      status: 'pass',
      message: 'Le title ne sera pas tronque sur les reseaux sociaux.',
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
      label: 'Description sociale',
      status: 'warning',
      message: `La description (${desc.length} car.) sera tronquee sur Facebook/LinkedIn (max ~155 car.).`,
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  } else if (desc) {
    checks.push({
      id: 'social-desc-length',
      label: 'Description sociale',
      status: 'pass',
      message: 'La description est adaptee au partage social.',
      category: 'bonus',
      weight: 1,
      group: 'social',
    })
  }

  return checks
}
