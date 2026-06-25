/**
 * SEO Rules — Technical checks: canonical URL, robots meta (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { getTranslations } from '../i18n.js'

/**
 * Detect a "cross-canonical": a page declaring its canonical as a DIFFERENT on-site
 * page. This silently de-indexes the current page in favour of the target URL — a
 * real, high-impact cause of traffic loss when set by mistake. Conservative: returns
 * true only when the canonical path CLEARLY differs from the page's own slug, to keep
 * this crash-class check trustworthy (no false positives).
 */
function isCrossCanonical(canonical: string, siteUrl: string, slug: string): boolean {
  const norm = (p: string) =>
    p.replace(/[?#].*$/, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
  const canonicalPath = norm(canonical.slice(siteUrl.length))
  const selfPath = norm(slug)
  const selfIsHome = selfPath === '' || selfPath === 'home'
  if (selfIsHome) return canonicalPath !== '' && canonicalPath !== 'home'
  return canonicalPath !== selfPath
}

export function checkTechnical(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.technical

  // 1. Canonical URL check
  if (input.canonicalUrl !== undefined) {
    const canonical = input.canonicalUrl.trim()

    if (!canonical) {
      checks.push({
        id: 'canonical-missing',
        label: r.canonicalMissingLabel,
        status: 'warning',
        message: r.canonicalMissingMessage,
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    } else if (!canonical.startsWith('http://') && !canonical.startsWith('https://')) {
      checks.push({
        id: 'canonical-invalid',
        label: r.canonicalInvalidLabel,
        status: 'warning',
        message: r.canonicalInvalidMessage(canonical),
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
          label: r.canonicalExternalLabel,
          status: 'warning',
          message: r.canonicalExternalMessage,
          category: 'important',
          weight: 2,
          group: 'technical',
        })
      } else if (
        siteUrl &&
        input.slug &&
        !input.isGlobal &&
        isCrossCanonical(canonical, siteUrl, input.slug)
      ) {
        // Self-page canonicalising to a DIFFERENT on-site page — de-indexes itself.
        checks.push({
          id: 'canonical-cross',
          label: r.canonicalCrossLabel,
          status: 'warning',
          message: r.canonicalCrossMessage(canonical),
          category: 'important',
          weight: 2,
          group: 'technical',
        })
      } else {
        checks.push({
          id: 'canonical-ok',
          label: r.canonicalOkLabel,
          status: 'pass',
          message: r.canonicalOkMessage,
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
        label: r.robotsNoindexLabel,
        status: acceptableNoindex ? 'warning' : 'fail',
        message: acceptableNoindex
          ? r.robotsNoindexAcceptable(ctx.pageType)
          : r.robotsNoindexFail,
        category: 'critical',
        weight: 3,
        group: 'technical',
      })
    }

    if (robots.includes('nofollow')) {
      checks.push({
        id: 'robots-nofollow',
        label: r.robotsNofollowLabel,
        status: 'warning',
        message: r.robotsNofollowMessage,
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    }

    if (!robots.includes('noindex') && !robots.includes('nofollow')) {
      checks.push({
        id: 'robots-ok',
        label: r.robotsOkLabel,
        status: 'pass',
        message: r.robotsOkMessage,
        category: 'important',
        weight: 2,
        group: 'technical',
      })
    }
  }
  // When robotsMeta is not provided, skip (defaults to index,follow)

  return checks
}
