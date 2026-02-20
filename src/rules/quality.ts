/**
 * SEO Rules — Content quality checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { MIN_WORDS_QUALITY_FAIL, MIN_WORDS_QUALITY_WARN } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkQuality(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.quality
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
    label: r.noDuplicateLabel,
    status: hasDuplicateContent ? 'fail' : 'pass',
    message: hasDuplicateContent ? r.noDuplicateFail : r.noDuplicatePass,
    category: 'critical',
    weight: 3,
    group: 'quality',
  })

  // 46. Substantial content (not thin content)
  if (wordCount < MIN_WORDS_QUALITY_FAIL) {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'fail',
      message: r.substantialFail(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else if (wordCount < MIN_WORDS_QUALITY_WARN) {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'warning',
      message: r.substantialWarn(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'pass',
      message: r.substantialPass(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  }

  return checks
}
