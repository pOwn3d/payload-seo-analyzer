/**
 * SEO Rules — Secondary keywords checks (weight: 1, category: bonus).
 *
 * Runs reduced checks for each secondary keyword:
 * - Keyword in title
 * - Keyword in meta description
 * - Keyword in content (presence only, no density/first-paragraph)
 * - Keyword in any H2/H3 heading
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { countWords, normalizeForComparison } from '../helpers'


export function checkSecondaryKeywords(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { secondaryNormalizedKeywords } = ctx

  if (secondaryNormalizedKeywords.length === 0) return checks

  const title = input.metaTitle || ''
  const titleLower = normalizeForComparison(title)
  const desc = input.metaDescription || ''
  const descLower = normalizeForComparison(desc)
  const fullTextLower = normalizeForComparison(ctx.fullText)
  const h2h3 = ctx.allHeadings.filter((h) => h.tag === 'h2' || h.tag === 'h3')

  for (let i = 0; i < secondaryNormalizedKeywords.length; i++) {
    const kw = secondaryNormalizedKeywords[i]
    // Find the original (non-normalized) keyword for display
    const originalKeywords = input.focusKeywords || []
    const displayKw = originalKeywords.find((k) => normalizeForComparison(k.trim()) === kw) || kw
    const suffix = secondaryNormalizedKeywords.length > 1 ? ` (#${i + 1})` : ''

    // 1. Keyword in title
    const kwInTitle = titleLower.includes(kw)
    checks.push({
      id: `secondary-kw-title-${i}`,
      label: `Mot-cle secondaire dans le title${suffix}`,
      status: kwInTitle ? 'pass' : 'warning',
      message: kwInTitle
        ? `Le mot-cle secondaire "${displayKw}" est present dans le meta title.`
        : `Le mot-cle secondaire "${displayKw}" n'est pas dans le meta title.`,
      category: 'bonus',
      weight: 1,
      group: 'secondary-keywords',
    })

    // 2. Keyword in meta description
    const kwInDesc = descLower.includes(kw)
    checks.push({
      id: `secondary-kw-desc-${i}`,
      label: `Mot-cle secondaire dans la description${suffix}`,
      status: kwInDesc ? 'pass' : 'warning',
      message: kwInDesc
        ? `Le mot-cle secondaire "${displayKw}" est present dans la meta description.`
        : `Le mot-cle secondaire "${displayKw}" n'est pas dans la meta description.`,
      category: 'bonus',
      weight: 1,
      group: 'secondary-keywords',
    })

    // 3. Keyword in content (presence + basic density — no first-paragraph or stuffing check)
    const kwPresent = fullTextLower.includes(kw)
    if (kwPresent && ctx.wordCount > 0) {
      const kwWords = countWords(kw)
      let kwCount = 0
      let searchIdx = 0
      while (true) {
        const idx = fullTextLower.indexOf(kw, searchIdx)
        if (idx === -1) break
        kwCount++
        searchIdx = idx + 1
      }
      const density = (kwCount * kwWords) / ctx.wordCount * 100

      checks.push({
        id: `secondary-kw-content-${i}`,
        label: `Mot-cle secondaire dans le contenu${suffix}`,
        status: 'pass',
        message: `Le mot-cle secondaire "${displayKw}" apparait ${kwCount} fois (${density.toFixed(1)}%).`,
        category: 'bonus',
        weight: 1,
        group: 'secondary-keywords',
      })
    } else {
      checks.push({
        id: `secondary-kw-content-${i}`,
        label: `Mot-cle secondaire dans le contenu${suffix}`,
        status: 'warning',
        message: `Le mot-cle secondaire "${displayKw}" n'apparait pas dans le contenu.`,
        category: 'bonus',
        weight: 1,
        group: 'secondary-keywords',
      })
    }

    // 4. Keyword in any H2/H3
    const kwInHeading = h2h3.some((h) => normalizeForComparison(h.text).includes(kw))
    checks.push({
      id: `secondary-kw-heading-${i}`,
      label: `Mot-cle secondaire dans un H2/H3${suffix}`,
      status: kwInHeading ? 'pass' : 'warning',
      message: kwInHeading
        ? `Le mot-cle secondaire "${displayKw}" est present dans un sous-titre H2 ou H3.`
        : `Ajoutez le mot-cle secondaire "${displayKw}" dans un sous-titre H2 ou H3.`,
      category: 'bonus',
      weight: 1,
      group: 'secondary-keywords',
    })
  }

  return checks
}
