/**
 * SEO Rules — JSON-LD / Schema.org checks (weight: 1, category: bonus)
 *
 * Note: Since structured data is typically injected at render time (not stored in CMS),
 * these checks are informational — reminding editors to ensure schema is present.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { getTranslations } from '../i18n.js'

export function checkSchema(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.schema

  // 37. Informational check: structured data reminder
  // We can infer from page structure whether schema is likely needed
  const hasMetaTitle = !!input.metaTitle
  const hasMetaDesc = !!input.metaDescription
  const hasImage = ctx.imageStats.total > 0

  const readyForSchema = hasMetaTitle && hasMetaDesc && hasImage

  checks.push({
    id: 'schema-readiness',
    label: r.readinessLabel,
    status: readyForSchema ? 'pass' : 'warning',
    message: readyForSchema ? r.readinessPass : r.readinessFail,
    category: 'bonus',
    weight: 1,
    group: 'schema',
  })

  return checks
}
