/**
 * SEO Rules — Technical checks: canonical URL, robots meta (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'

export function checkTechnical(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // 1. Canonical URL check
  if (input.canonicalUrl !== undefined) {
    const canonical = input.canonicalUrl.trim()

    if (!canonical) {
      checks.push({
        id: 'canonical-missing',
        label: 'URL canonique',
        status: 'warning',
        message: 'URL canonique vide — Definissez une URL canonique pour eviter le contenu duplique.',
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    } else if (!canonical.startsWith('http://') && !canonical.startsWith('https://')) {
      checks.push({
        id: 'canonical-invalid',
        label: 'URL canonique',
        status: 'warning',
        message: `URL canonique "${canonical}" invalide — Utilisez une URL absolue (https://...).`,
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    } else {
      // Validate against site URL if provided
      const siteUrl = ctx.config.siteUrl
      if (siteUrl && !canonical.startsWith(siteUrl)) {
        checks.push({
          id: 'canonical-external',
          label: 'URL canonique',
          status: 'warning',
          message: `URL canonique pointe vers un domaine externe — Verifiez que c'est intentionnel.`,
          category: 'important',
          weight: 2,
          group: 'technical',
        })
      } else {
        checks.push({
          id: 'canonical-ok',
          label: 'URL canonique',
          status: 'pass',
          message: 'URL canonique correctement definie.',
          category: 'important',
          weight: 2,
          group: 'technical',
        })
      }
    }
  }
  // When canonicalUrl is not provided at all, skip the check (not all CMS expose it)

  // 2. Robots meta check
  if (input.robotsMeta !== undefined) {
    const robots = input.robotsMeta.toLowerCase().trim()

    if (robots.includes('noindex')) {
      // noindex is valid for certain page types
      const acceptableNoindex = ['legal', 'form', 'contact'].includes(ctx.pageType)

      checks.push({
        id: 'robots-noindex',
        label: 'Robots noindex',
        status: acceptableNoindex ? 'warning' : 'fail',
        message: acceptableNoindex
          ? `Page en noindex — Acceptable pour une page ${ctx.pageType}, mais verifiez que c'est voulu.`
          : 'Page en noindex — Cette page ne sera PAS indexee par Google. Retirez le noindex sauf si c\'est intentionnel.',
        category: 'critical',
        weight: 3,
        group: 'technical',
      })
    }

    if (robots.includes('nofollow')) {
      checks.push({
        id: 'robots-nofollow',
        label: 'Robots nofollow',
        status: 'warning',
        message:
          'Page en nofollow — Les liens de cette page ne transmettront pas de "link juice". Verifiez que c\'est intentionnel.',
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    }

    if (!robots.includes('noindex') && !robots.includes('nofollow')) {
      checks.push({
        id: 'robots-ok',
        label: 'Robots meta',
        status: 'pass',
        message: 'Directives robots correctes — La page est indexable et suivie.',
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    }
  }
  // When robotsMeta is not provided, skip (defaults to index,follow)

  return checks
}
