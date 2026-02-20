/**
 * SEO Rules — JSON-LD / Schema.org checks (weight: 1, category: bonus)
 *
 * Note: Since structured data is typically injected at render time (not stored in CMS),
 * these checks are informational — reminding editors to ensure schema is present.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'

export function checkSchema(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // 37. Informational check: structured data reminder
  // We can infer from page structure whether schema is likely needed
  const hasMetaTitle = !!input.metaTitle
  const hasMetaDesc = !!input.metaDescription
  const hasImage = ctx.imageStats.total > 0

  const readyForSchema = hasMetaTitle && hasMetaDesc && hasImage

  checks.push({
    id: 'schema-readiness',
    label: 'Donnees structurees',
    status: readyForSchema ? 'pass' : 'warning',
    message: readyForSchema
      ? 'La page a suffisamment de metadonnees pour generer du JSON-LD (title, description, image).'
      : 'Completez le title, la description et ajoutez une image pour exploiter pleinement les donnees structurees.',
    category: 'bonus',
    weight: 1,
    group: 'schema',
  })

  return checks
}
