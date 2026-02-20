/**
 * SEO Rules — Internal/external linking checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { GENERIC_ANCHOR_TEXTS } from '../constants'

export function checkLinking(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { allLinks } = ctx

  // Separate internal from external links
  const internalLinks = allLinks.filter(
    (link) =>
      link.url.startsWith('/') || link.url.startsWith('#') || !link.url.startsWith('http'),
  )
  const externalLinks = allLinks.filter((link) => link.url.startsWith('http'))

  // 30. At least 1 internal link (>=3 = excellent)
  if (internalLinks.length === 0) {
    checks.push({
      id: 'linking-internal',
      label: 'Liens internes',
      status: 'warning',
      message: 'Aucun lien interne detecte — Ajoutez des liens vers d\'autres pages du site.',
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (internalLinks.length < 3) {
    checks.push({
      id: 'linking-internal',
      label: 'Liens internes',
      status: 'pass',
      message: `${internalLinks.length} lien(s) interne(s) — Correct. Visez 3+ pour renforcer le maillage.`,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else {
    checks.push({
      id: 'linking-internal',
      label: 'Liens internes',
      status: 'pass',
      message: `${internalLinks.length} liens internes — Excellent maillage interne.`,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  }

  // 31. At least 1 external link (skip for contact/legal/form pages)
  const skipExternalCheck = ctx.pageType === 'contact' || ctx.pageType === 'legal' || ctx.pageType === 'form'
  if (skipExternalCheck) {
    checks.push({
      id: 'linking-external',
      label: 'Liens externes',
      status: 'pass',
      message: 'Page utilitaire — Les liens externes ne sont pas indispensables.',
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  } else if (externalLinks.length === 0) {
    checks.push({
      id: 'linking-external',
      label: 'Liens externes',
      status: 'warning',
      message:
        'Aucun lien externe — Ajoutez des liens vers des sources fiables pour renforcer la credibilite.',
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  } else {
    checks.push({
      id: 'linking-external',
      label: 'Liens externes',
      status: 'pass',
      message: `${externalLinks.length} lien(s) externe(s) detecte(s).`,
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  }

  // 32. No generic anchor texts
  const genericAnchors = allLinks.filter((link) => {
    const text = link.text.toLowerCase().trim()
    return (GENERIC_ANCHOR_TEXTS as readonly string[]).includes(text)
  })

  if (genericAnchors.length > 0) {
    checks.push({
      id: 'linking-generic-anchors',
      label: 'Ancres generiques',
      status: 'warning',
      message: `${genericAnchors.length} lien(s) avec des ancres generiques ("cliquez ici", "ici"...) — Utilisez des textes descriptifs.`,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (allLinks.length > 0) {
    checks.push({
      id: 'linking-generic-anchors',
      label: 'Ancres descriptives',
      status: 'pass',
      message: 'Tous les liens utilisent des textes d\'ancrage descriptifs.',
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  }

  // 33. No empty links (href="" or href="#")
  const emptyLinks = allLinks.filter((link) => {
    const url = link.url.trim()
    return url === '' || url === '#'
  })

  if (emptyLinks.length > 0) {
    checks.push({
      id: 'linking-empty',
      label: 'Liens vides',
      status: 'warning',
      message: `${emptyLinks.length} lien(s) vide(s) detecte(s) (href="" ou href="#") — Ajoutez des destinations valides.`,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (allLinks.length > 0) {
    checks.push({
      id: 'linking-empty',
      label: 'Liens valides',
      status: 'pass',
      message: 'Aucun lien vide detecte.',
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  }

  return checks
}
