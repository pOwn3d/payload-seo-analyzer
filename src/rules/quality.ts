/**
 * SEO Rules — Content quality checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { MIN_WORDS_QUALITY_FAIL, MIN_WORDS_QUALITY_WARN } from '../constants'

export function checkQuality(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { fullText, wordCount } = ctx

  // 45. No duplicate/placeholder content detected
  const duplicatePatterns = [
    /(.{30,})\1/i, // same 30+ char block repeated
    /\b(lorem ipsum|dolor sit amet|consectetur adipiscing)\b/i,
    /\b(texte de remplacement|contenu temporaire|texte generique)\b/i,
    /\b(titre de la page|description de la page)\b/i,
  ]

  const hasDuplicateContent = duplicatePatterns.some((p) => p.test(fullText))

  checks.push({
    id: 'quality-no-duplicate',
    label: 'Contenu original',
    status: hasDuplicateContent ? 'fail' : 'pass',
    message: hasDuplicateContent
      ? 'Du contenu generique ou duplique a ete detecte — Remplacez par du contenu unique et pertinent.'
      : 'Le contenu semble original et unique.',
    category: 'critical',
    weight: 3,
    group: 'quality',
  })

  // 46. Substantial content (not thin content)
  if (wordCount < MIN_WORDS_QUALITY_FAIL) {
    checks.push({
      id: 'quality-substantial',
      label: 'Contenu substantiel',
      status: 'fail',
      message: `Seulement ${wordCount} mots — Contenu insuffisant pour offrir de la valeur au lecteur.`,
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else if (wordCount < MIN_WORDS_QUALITY_WARN) {
    checks.push({
      id: 'quality-substantial',
      label: 'Contenu substantiel',
      status: 'warning',
      message: `${wordCount} mots — Le contenu est leger. Enrichissez-le pour mieux repondre a l'intention de recherche.`,
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else {
    checks.push({
      id: 'quality-substantial',
      label: 'Contenu substantiel',
      status: 'pass',
      message: `${wordCount} mots — Volume de contenu adequat.`,
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  }

  return checks
}
