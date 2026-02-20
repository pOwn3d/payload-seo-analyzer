/**
 * SEO Rules — Headings H1-H6 checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { checkHeadingHierarchy, normalizeForComparison, keywordMatchesText } from '../helpers'
import { WORDS_PER_HEADING } from '../constants'

export function checkHeadings(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { allHeadings, normalizedKeyword, wordCount } = ctx

  // 15. H1 unique — count from heading nodes (includes post title added by buildContext)
  const h1Count = allHeadings.filter((h) => h.tag === 'h1').length

  if (h1Count === 0) {
    checks.push({
      id: 'h1-missing',
      label: 'Titre H1',
      status: 'fail',
      message: 'Aucun titre H1 detecte — Ajoutez un titre principal dans le hero.',
      category: 'important',
      weight: 2,
      group: 'headings',
      tip: 'Le H1 est le titre principal de la page. Il doit contenir le mot-cle et resumer le sujet en une phrase.',
    })
  } else if (h1Count > 1) {
    checks.push({
      id: 'h1-unique',
      label: 'Titre H1 unique',
      status: 'warning',
      message: `${h1Count} titres H1 detectes — Gardez un seul H1 par page.`,
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  } else {
    checks.push({
      id: 'h1-unique',
      label: 'Titre H1 unique',
      status: 'pass',
      message: 'Un seul H1 detecte — Parfait.',
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  }

  // 16. Focus keyword in H1 (smart French matching, post title included by buildContext)
  if (normalizedKeyword) {
    const h1Headings = allHeadings.filter((h) => h.tag === 'h1')
    const allH1Text = h1Headings.map((h) => normalizeForComparison(h.text)).join(' ')
    const kwInH1 = keywordMatchesText(normalizedKeyword, allH1Text)

    checks.push({
      id: 'h1-keyword',
      label: 'Mot-cle dans le H1',
      status: kwInH1 ? 'pass' : 'warning',
      message: kwInH1
        ? 'Le mot-cle est present dans le titre H1.'
        : `Le mot-cle "${input.focusKeyword}" n'est pas dans le H1 — Integrez-le au titre principal.`,
      category: 'important',
      weight: 2,
      group: 'headings',
    })
  }

  // 17. Heading hierarchy (no level skipping)
  const goodHierarchy = checkHeadingHierarchy(allHeadings)
  checks.push({
    id: 'heading-hierarchy',
    label: 'Hierarchie des titres',
    status: goodHierarchy ? 'pass' : 'warning',
    message: goodHierarchy
      ? 'La hierarchie des titres est correcte (h2 avant h3, etc.).'
      : 'La hierarchie des titres n\'est pas respectee — Utilisez h2 avant h3, h3 avant h4, etc.',
    category: 'important',
    weight: 2,
    group: 'headings',
  })

  // 18. Focus keyword in at least one H2 (smart French matching)
  if (normalizedKeyword) {
    const h2s = allHeadings.filter((h) => h.tag === 'h2')
    const kwInH2 = h2s.some((h) => keywordMatchesText(normalizedKeyword, normalizeForComparison(h.text)))

    if (h2s.length > 0) {
      checks.push({
        id: 'h2-keyword',
        label: 'Mot-cle dans un H2',
        status: kwInH2 ? 'pass' : 'warning',
        message: kwInH2
          ? 'Le mot-cle est present dans au moins un sous-titre H2.'
          : `Ajoutez le mot-cle "${input.focusKeyword}" dans l'un des sous-titres H2.`,
        category: 'important',
        weight: 2,
        group: 'headings',
      })
    }
  }

  // 19. One heading every ~WORDS_PER_HEADING words
  const nonH1Headings = allHeadings.filter((h) => h.tag !== 'h1')
  if (wordCount > WORDS_PER_HEADING) {
    const expectedHeadings = Math.floor(wordCount / WORDS_PER_HEADING)
    const hasEnoughHeadings = nonH1Headings.length >= expectedHeadings

    checks.push({
      id: 'heading-frequency',
      label: 'Frequence des sous-titres',
      status: hasEnoughHeadings ? 'pass' : 'warning',
      message: hasEnoughHeadings
        ? `${nonH1Headings.length} sous-titre(s) pour ${wordCount} mots — Bonne structure.`
        : `Seulement ${nonH1Headings.length} sous-titre(s) pour ${wordCount} mots — Ajoutez un sous-titre tous les ~300 mots.`,
      category: 'bonus',
      weight: 1,
      group: 'headings',
      ...(!hasEnoughHeadings && { tip: 'Decoupez les longs paragraphes avec des sous-titres H2/H3 qui resument chaque section.' }),
    })
  }

  // C4. H1 vs meta title — should not be identical
  if (input.metaTitle) {
    const h1Headings = allHeadings.filter((h) => h.tag === 'h1')
    if (h1Headings.length > 0) {
      const h1Norm = normalizeForComparison(h1Headings[0].text)
      const titleNorm = normalizeForComparison(input.metaTitle)

      if (h1Norm && titleNorm && h1Norm === titleNorm) {
        checks.push({
          id: 'h1-title-different',
          label: 'H1 different du meta title',
          status: 'warning',
          message: 'Le H1 et le meta title sont identiques — Differenciez-les pour couvrir plus de variations de mots-cles.',
          category: 'important',
          weight: 1,
          group: 'headings',
          tip: 'Le meta title est optimise pour Google (avec le nom de marque). Le H1 peut etre plus descriptif ou accrocheur pour le visiteur.',
        })
      } else {
        checks.push({
          id: 'h1-title-different',
          label: 'H1 different du meta title',
          status: 'pass',
          message: 'Le H1 et le meta title sont differents — Bonne pratique pour la diversite semantique.',
          category: 'important',
          weight: 1,
          group: 'headings',
        })
      }
    }
  }

  return checks
}
