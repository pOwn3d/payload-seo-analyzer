/**
 * SEO Rules — URL/Slug checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { getStopWordsFR, slugifyKeyword, isStopWordInCompoundExpression } from '../helpers'
import { SLUG_MAX_LENGTH, UTILITY_PAGE_SLUGS } from '../constants'

export function checkUrl(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const slug = input.slug || ''
  const kw = ctx.normalizedKeyword

  // 10. Slug present
  if (!slug) {
    checks.push({
      id: 'slug-missing',
      label: 'Slug (URL)',
      status: 'fail',
      message: 'Slug manquant — Definissez une URL pour cette page.',
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
      label: 'Longueur du slug',
      status: 'warning',
      message: `Slug trop long (${slug.length} car.) — Gardez-le sous 75 caracteres.`,
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-length',
      label: 'Longueur du slug',
      status: 'pass',
      message: `Slug valide (${slug.length} car.).`,
      category: 'important',
      weight: 2,
      group: 'url',
    })
  }

  // 12. No special characters or uppercase
  if (/[A-Z]/.test(slug) || /[^a-z0-9\-/]/.test(slug)) {
    checks.push({
      id: 'slug-format',
      label: 'Format du slug',
      status: 'warning',
      message:
        'Slug contient des caracteres speciaux ou majuscules — Utilisez uniquement des minuscules, chiffres et tirets.',
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-format',
      label: 'Format du slug',
      status: 'pass',
      message: 'Format du slug correct (minuscules, chiffres, tirets).',
      category: 'important',
      weight: 2,
      group: 'url',
    })
  }

  // 13. Focus keyword in slug (strips accents and special chars like . & /)
  // Skip for utility/standard slugs where keyword in URL is not applicable
  const isUtilitySlug = UTILITY_PAGE_SLUGS.some((us) => slug === us || slug.endsWith(`/${us}`))

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
      label: 'Mot-cle dans le slug',
      status: slugContainsKw ? 'pass' : 'warning',
      message: slugContainsKw
        ? 'Le mot-cle est present dans l\'URL.'
        : `Le mot-cle "${input.focusKeyword}" n'est pas dans l'URL — Integrez-le si possible.`,
      category: 'important',
      weight: 2,
      group: 'url',
    })
  } else if (kw && isUtilitySlug) {
    // Utility slugs get an automatic pass — their purpose is clear from the slug
    checks.push({
      id: 'slug-keyword',
      label: 'Mot-cle dans le slug',
      status: 'pass',
      message: 'Page utilitaire — Le slug standard est adapte.',
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  }

  // 14. No French stop words in slug (excluding compound expressions)
  const stopWords = getStopWordsFR()
  const slugParts = slug.split('-')
  const foundStopWords = slugParts.filter((part, idx) =>
    stopWords.includes(part) && !isStopWordInCompoundExpression(slugParts, idx, ctx.config.stopWordCompounds),
  )

  if (foundStopWords.length > 0) {
    checks.push({
      id: 'slug-stopwords',
      label: 'Stop words dans le slug',
      status: 'warning',
      message: `Le slug contient des mots vides (${foundStopWords.join(', ')}) — Retirez-les pour un slug plus propre.`,
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  } else {
    checks.push({
      id: 'slug-stopwords',
      label: 'Stop words dans le slug',
      status: 'pass',
      message: 'Le slug ne contient pas de mots vides inutiles.',
      category: 'bonus',
      weight: 1,
      group: 'url',
    })
  }

  return checks
}
