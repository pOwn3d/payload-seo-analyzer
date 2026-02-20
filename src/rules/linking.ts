/**
 * SEO Rules — Internal/external linking checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { getGenericAnchors } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkLinking(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.linking
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
      label: r.internalLabel,
      status: 'warning',
      message: r.internalNone,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (internalLinks.length < 3) {
    checks.push({
      id: 'linking-internal',
      label: r.internalLabel,
      status: 'pass',
      message: r.internalFew(internalLinks.length),
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else {
    checks.push({
      id: 'linking-internal',
      label: r.internalLabel,
      status: 'pass',
      message: r.internalGood(internalLinks.length),
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
      label: r.externalLabel,
      status: 'pass',
      message: r.externalUtilityPass,
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  } else if (externalLinks.length === 0) {
    checks.push({
      id: 'linking-external',
      label: r.externalLabel,
      status: 'warning',
      message: r.externalNone,
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  } else {
    checks.push({
      id: 'linking-external',
      label: r.externalLabel,
      status: 'pass',
      message: r.externalPass(externalLinks.length),
      category: 'bonus',
      weight: 1,
      group: 'linking',
    })
  }

  // 32. No generic anchor texts (check both FR + EN)
  const allGenericAnchors = [...getGenericAnchors('fr'), ...getGenericAnchors('en')]
  const genericAnchors = allLinks.filter((link) => {
    const text = link.text.toLowerCase().trim()
    return allGenericAnchors.includes(text)
  })

  if (genericAnchors.length > 0) {
    checks.push({
      id: 'linking-generic-anchors',
      label: r.genericAnchorsLabel,
      status: 'warning',
      message: r.genericAnchorsFail(genericAnchors.length),
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (allLinks.length > 0) {
    checks.push({
      id: 'linking-generic-anchors',
      label: r.genericAnchorsPassLabel,
      status: 'pass',
      message: r.genericAnchorsPass,
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
      label: r.emptyLinksLabel,
      status: 'warning',
      message: r.emptyLinksFail(emptyLinks.length),
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  } else if (allLinks.length > 0) {
    checks.push({
      id: 'linking-empty',
      label: r.emptyLinksPassLabel,
      status: 'pass',
      message: r.emptyLinksPass,
      category: 'important',
      weight: 2,
      group: 'linking',
    })
  }

  return checks
}
