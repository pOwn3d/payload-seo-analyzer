/**
 * SEO Rules — Images checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { ALT_TEXT_MIN_RATIO, ALT_TEXT_MIN_LENGTH } from '../constants'

export function checkImages(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { imageStats, normalizedKeyword, isPost, pageType } = ctx

  // Legal, contact and form pages don't need images — auto-pass
  if (pageType === 'legal' || pageType === 'contact' || pageType === 'form') {
    if (imageStats.total > 0) {
      // Still check alt text if images exist
      const altRate = imageStats.withAlt / imageStats.total
      const missing = imageStats.total - imageStats.withAlt
      checks.push({
        id: 'images-alt',
        label: 'Alt text images',
        status: altRate === 1 ? 'pass' : 'warning',
        message: altRate === 1
          ? `${imageStats.total} image(s) avec alt text — Parfait.`
          : `${missing}/${imageStats.total} image(s) sans texte alternatif.`,
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
    checks.push({
      id: 'images-present',
      label: 'Presence d\'images',
      status: 'pass',
      message: 'Page utilitaire — Les images ne sont pas indispensables.',
      category: 'bonus',
      weight: 1,
      group: 'images',
    })
    return checks
  }

  // 26. Alt text on all images (>= 80%)
  if (imageStats.total > 0) {
    const altRate = imageStats.withAlt / imageStats.total
    const missing = imageStats.total - imageStats.withAlt

    if (altRate >= ALT_TEXT_MIN_RATIO) {
      checks.push({
        id: 'images-alt',
        label: 'Alt text images',
        status: altRate === 1 ? 'pass' : 'warning',
        message:
          altRate === 1
            ? `${imageStats.total} image(s) avec alt text — Parfait.`
            : `${missing}/${imageStats.total} image(s) sans texte alternatif — Ajoutez des alt texts descriptifs.`,
        category: 'important',
        weight: 2,
        group: 'images',
      })
    } else {
      checks.push({
        id: 'images-alt',
        label: 'Alt text images',
        status: 'fail',
        message: `${missing}/${imageStats.total} image(s) sans texte alternatif — L'accessibilite et le SEO en souffrent.`,
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
  }

  // 27. Focus keyword in at least 1 alt text (or descriptive alt present)
  if (normalizedKeyword && imageStats.altTexts.length > 0) {
    const kwNorm = normalizedKeyword // already accent-stripped
    const kwInAlt = imageStats.altTexts.some((alt) => {
      const altNorm = alt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Exact keyword match (accent-insensitive)
      if (altNorm.includes(kwNorm)) return true
      // Word-level: any significant keyword word (>3 chars) in alt
      const kwWords = kwNorm.split(/\s+/).filter((w) => w.length > 3)
      if (kwWords.length > 0 && kwWords.some((w) => altNorm.includes(w))) return true
      // Descriptive alt (>ALT_TEXT_MIN_LENGTH chars) is acceptable — Google values
      // descriptive alt over keyword-stuffed alt. Shared media can't contain every keyword.
      return alt.trim().length >= ALT_TEXT_MIN_LENGTH
    })

    checks.push({
      id: 'images-alt-keyword',
      label: 'Mot-cle dans un alt',
      status: kwInAlt ? 'pass' : 'warning',
      message: kwInAlt
        ? 'Le mot-cle ou un alt descriptif est present sur au moins une image.'
        : 'Integrez le mot-cle dans le texte alternatif d\'au moins une image.',
      category: 'bonus',
      weight: 1,
      group: 'images',
    })
  }

  // 28. At least 1 image/media present
  if (imageStats.total === 0) {
    checks.push({
      id: 'images-present',
      label: 'Presence d\'images',
      status: 'warning',
      message:
        'Aucune image detectee — Ajoutez des visuels pour enrichir le contenu.',
      category: 'important',
      weight: 2,
      group: 'images',
    })
  } else {
    checks.push({
      id: 'images-present',
      label: 'Presence d\'images',
      status: 'pass',
      message: `${imageStats.total} image(s) detectee(s).`,
      category: 'important',
      weight: 2,
      group: 'images',
    })
  }

  // 29. Image quantity quality (4+ excellent, 1-3 ok, 0 fail for posts)
  if (isPost) {
    if (imageStats.total >= 1) {
      checks.push({
        id: 'images-quantity',
        label: 'Nombre d\'images',
        status: 'pass',
        message: `${imageStats.total} image(s) — Visuels presents.`,
        category: 'bonus',
        weight: 1,
        group: 'images',
      })
    } else {
      checks.push({
        id: 'images-quantity',
        label: 'Nombre d\'images',
        status: 'fail',
        message: 'Aucune image dans cet article — Les articles sans images sont moins engageants.',
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
  }

  return checks
}
