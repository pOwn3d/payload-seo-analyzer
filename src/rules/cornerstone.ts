/**
 * SEO Rules — Cornerstone / pillar content checks.
 * These checks only run when `isCornerstone` is true on the document.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { CORNERSTONE_MIN_WORDS, CORNERSTONE_MIN_INTERNAL_LINKS, META_DESC_LENGTH_MIN, META_DESC_LENGTH_MAX } from '../constants'

export function checkCornerstone(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  // Skip entirely if the content is not marked as cornerstone
  if (!input.isCornerstone) return []

  const checks: SeoCheck[] = []

  // 1. Word count >= CORNERSTONE_MIN_WORDS (cornerstone should be comprehensive)
  if (ctx.wordCount >= CORNERSTONE_MIN_WORDS) {
    checks.push({
      id: 'cornerstone-wordcount',
      label: 'Longueur du contenu pilier',
      status: 'pass',
      message: `${ctx.wordCount} mots — Le contenu pilier est suffisamment complet.`,
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-wordcount',
      label: 'Longueur du contenu pilier',
      status: 'warning',
      message: `${ctx.wordCount} mots — Un contenu pilier devrait contenir au moins 1500 mots pour etre vraiment complet.`,
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
      label: 'Maillage interne du contenu pilier',
      status: 'pass',
      message: `${internalLinks.length} liens internes — Bon maillage pour un contenu pilier.`,
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-internal-links',
      label: 'Maillage interne du contenu pilier',
      status: 'warning',
      message: `${internalLinks.length} lien(s) interne(s) — Un contenu pilier devrait avoir au moins 5 liens internes vers du contenu associe.`,
      category: 'important',
      weight: 4,
      group: 'cornerstone',
    })
  }

  // 3. Focus keyword present (mandatory for cornerstone)
  if (ctx.normalizedKeyword) {
    checks.push({
      id: 'cornerstone-focus-keyword',
      label: 'Mot-cle principal du contenu pilier',
      status: 'pass',
      message: 'Un mot-cle principal est defini pour ce contenu pilier.',
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-focus-keyword',
      label: 'Mot-cle principal du contenu pilier',
      status: 'fail',
      message: 'Un contenu pilier DOIT avoir un mot-cle principal — Definissez-le dans la sidebar.',
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
      label: 'Meta description du contenu pilier',
      status: 'pass',
      message: `Meta description de ${metaDesc.length} caracteres — Optimale pour un contenu pilier.`,
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else if (metaDesc.length > 0) {
    checks.push({
      id: 'cornerstone-meta-description',
      label: 'Meta description du contenu pilier',
      status: 'warning',
      message: `Meta description de ${metaDesc.length} caracteres — Visez entre 120 et 160 caracteres pour un contenu pilier.`,
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  } else {
    checks.push({
      id: 'cornerstone-meta-description',
      label: 'Meta description du contenu pilier',
      status: 'fail',
      message: 'Un contenu pilier DOIT avoir une meta description — C\'est essentiel pour le CTR dans les SERP.',
      category: 'critical',
      weight: 5,
      group: 'cornerstone',
    })
  }

  return checks
}
