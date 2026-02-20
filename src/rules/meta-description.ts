/**
 * SEO Rules — Meta description checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { getActionVerbsFR, normalizeForComparison, keywordMatchesText } from '../helpers'
import { META_DESC_LENGTH_MIN, META_DESC_LENGTH_MAX } from '../constants'

export function checkMetaDescription(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const desc = input.metaDescription || ''
  const descLen = desc.length
  const kw = ctx.normalizedKeyword

  // 6. Meta description present
  if (!desc) {
    checks.push({
      id: 'meta-desc-missing',
      label: 'Meta description',
      status: 'fail',
      message: 'Meta description manquante — Ajoutez une description pour le referencement.',
      category: 'critical',
      weight: 3,
      group: 'meta-description',
      tip: 'Redigez une phrase de 120-160 caracteres qui resume la page et incite au clic. Incluez le mot-cle principal.',
    })
    return checks
  }

  // 7. Length META_DESC_LENGTH_MIN-META_DESC_LENGTH_MAX characters
  if (descLen < META_DESC_LENGTH_MIN) {
    checks.push({
      id: 'meta-desc-length',
      label: 'Longueur de la description',
      status: 'warning',
      message: `Meta description (${descLen} car.) — Trop courte. Visez 120 a 160 caracteres.`,
      category: 'critical',
      weight: 3,
      group: 'meta-description',
      tip: 'Completez avec les benefices de la page ou un appel a l\'action (ex: "Devis gratuit en 24h").',
    })
  } else if (descLen > META_DESC_LENGTH_MAX) {
    checks.push({
      id: 'meta-desc-length',
      label: 'Longueur de la description',
      status: 'warning',
      message: `Meta description (${descLen} car.) — Trop longue, sera coupee. Reduisez a 160 max.`,
      category: 'critical',
      weight: 3,
      group: 'meta-description',
      tip: 'Google tronque au-dela de ~160 caracteres. Supprimez les details secondaires et gardez l\'essentiel.',
    })
  } else {
    checks.push({
      id: 'meta-desc-length',
      label: 'Longueur de la description',
      status: 'pass',
      message: `Meta description (${descLen} car.) — Longueur ideale.`,
      category: 'critical',
      weight: 3,
      group: 'meta-description',
    })
  }

  // 8. Focus keyword present in description (smart French matching)
  if (kw) {
    const descNorm = normalizeForComparison(desc)
    const descContainsKw = keywordMatchesText(kw, descNorm)
    checks.push({
      id: 'meta-desc-keyword',
      label: 'Mot-cle dans la description',
      status: descContainsKw ? 'pass' : 'warning',
      message: descContainsKw
        ? `Le mot-cle "${input.focusKeyword}" est present dans la meta description.`
        : `Le mot-cle "${input.focusKeyword}" n'est pas dans la meta description.`,
      category: 'critical',
      weight: 3,
      group: 'meta-description',
    })
  }

  // 9. Contains an action verb or alternative CTA pattern
  // Accepts: imperative verbs ("découvrez"), numeric patterns ("5 raisons"),
  // or interrogative hooks ("comment", "pourquoi") as valid CTAs
  const actionVerbs = getActionVerbsFR()
  const descLower = desc.toLowerCase()
  const hasActionVerb = actionVerbs.some((verb) => descLower.includes(verb))
  const hasNumericCta = /\b\d+\s+(?:raisons?|étapes?|astuces?|conseils?|erreurs?|avantages?|clés?|points?|façons?|méthodes?|techniques?|outils?|secrets?)\b/i.test(desc)
  const hasInterrogativeCta = /\b(?:comment|pourquoi|quand|quel|quelle|quels|quelles)\b/i.test(desc)
  const hasAction = hasActionVerb || hasNumericCta || hasInterrogativeCta

  checks.push({
    id: 'meta-desc-cta',
    label: 'Verbe d\'action (CTA)',
    status: hasAction ? 'pass' : 'warning',
    message: hasAction
      ? 'La meta description contient un element incitatif — Bon pour le taux de clic.'
      : 'Ajoutez un verbe d\'action (decouvrez, contactez, obtenez...) pour inciter au clic.',
    category: 'important',
    weight: 2,
    group: 'meta-description',
    ...(!hasAction && { tip: 'Commencez par un verbe a l\'imperatif (Decouvrez, Profitez, Obtenez) ou utilisez un chiffre ("5 raisons de...").' }),
  })

  return checks
}
