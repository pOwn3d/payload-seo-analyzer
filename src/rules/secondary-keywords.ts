/**
 * SEO Rules — Secondary keywords checks (weight: 1, category: bonus).
 *
 * Runs reduced checks for each secondary keyword:
 * - Keyword in title
 * - Keyword in meta description
 * - Keyword in content (presence only, no density/first-paragraph)
 * - Keyword in any H2/H3 heading
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { countWords, normalizeForComparison } from '../helpers.js'
import { getTranslations } from '../i18n.js'


export function checkSecondaryKeywords(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.secondaryKeywords
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
      label: r.titleLabel(suffix),
      status: kwInTitle ? 'pass' : 'warning',
      message: kwInTitle ? r.titlePass(displayKw as string) : r.titleFail(displayKw as string),
      category: 'bonus',
      weight: 1,
      group: 'secondary-keywords',
    })

    // 2. Keyword in meta description
    const kwInDesc = descLower.includes(kw)
    checks.push({
      id: `secondary-kw-desc-${i}`,
      label: r.descLabel(suffix),
      status: kwInDesc ? 'pass' : 'warning',
      message: kwInDesc ? r.descPass(displayKw as string) : r.descFail(displayKw as string),
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
        label: r.contentLabel(suffix),
        status: 'pass',
        message: r.contentPass(displayKw as string, kwCount, density.toFixed(1)),
        category: 'bonus',
        weight: 1,
        group: 'secondary-keywords',
      })
    } else {
      checks.push({
        id: `secondary-kw-content-${i}`,
        label: r.contentLabel(suffix),
        status: 'warning',
        message: r.contentFail(displayKw as string),
        category: 'bonus',
        weight: 1,
        group: 'secondary-keywords',
      })
    }

    // 4. Keyword in any H2/H3
    const kwInHeading = h2h3.some((h) => normalizeForComparison(h.text).includes(kw))
    checks.push({
      id: `secondary-kw-heading-${i}`,
      label: r.headingLabel(suffix),
      status: kwInHeading ? 'pass' : 'warning',
      message: kwInHeading ? r.headingPass(displayKw as string) : r.headingFail(displayKw as string),
      category: 'bonus',
      weight: 1,
      group: 'secondary-keywords',
    })
  }

  return checks
}
