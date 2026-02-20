/**
 * SEO Rules — Content freshness / decay detection.
 *
 * Checks:
 * 1. Content age — based on updatedAt
 * 2. Content reviewed — based on contentLastReviewed
 * 3. Year reference — mentions of current/past years in content
 * 4. Thin content aging — thin + old content is penalised harder
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import {
  MS_PER_DAY,
  FRESHNESS_DAYS_EVERGREEN,
  FRESHNESS_DAYS_FAIL,
  FRESHNESS_DAYS_WARN,
  REVIEW_DAYS_WARN,
  EVERGREEN_PAGE_SLUGS,
  THIN_AGING_MIN_WORDS,
} from '../constants'

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY)
}

function isEvergreenPage(slug: string | undefined): boolean {
  if (!slug) return false
  return EVERGREEN_PAGE_SLUGS.some((s) => slug === s || slug.endsWith(`/${s}`))
}

export function checkFreshness(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const evergreen = isEvergreenPage(input.slug)

  // 1. Content age (based on updatedAt)
  const daysOld = daysSince(input.updatedAt)

  if (daysOld === Infinity) {
    // No updatedAt available — skip this check silently
  } else if (evergreen) {
    // Evergreen pages (legal, contact, etc.) use relaxed thresholds
    if (daysOld > FRESHNESS_DAYS_EVERGREEN) {
      checks.push({
        id: 'freshness-age',
        label: 'Anciennete du contenu',
        status: 'warning',
        message: `Contenu non mis a jour depuis ${daysOld} jours (>${'\u00A0'}24 mois) — Verifiez que les informations legales sont toujours a jour.`,
        category: 'bonus',
        weight: 1,
        group: 'freshness',
      })
    } else {
      checks.push({
        id: 'freshness-age',
        label: 'Anciennete du contenu',
        status: 'pass',
        message: `Page evergreen — Mis a jour il y a ${daysOld} jour${daysOld !== 1 ? 's' : ''}.`,
        category: 'bonus',
        weight: 1,
        group: 'freshness',
      })
    }
  } else if (daysOld > FRESHNESS_DAYS_FAIL) {
    checks.push({
      id: 'freshness-age',
      label: 'Anciennete du contenu',
      status: 'fail',
      message: `Contenu non mis a jour depuis ${daysOld} jours (>${'\u00A0'}12 mois) — Ce contenu est potentiellement obsolete.`,
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  } else if (daysOld > FRESHNESS_DAYS_WARN) {
    checks.push({
      id: 'freshness-age',
      label: 'Anciennete du contenu',
      status: 'warning',
      message: `Contenu non mis a jour depuis ${daysOld} jours (>${'\u00A0'}6 mois) — Pensez a le rafraichir.`,
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  } else {
    checks.push({
      id: 'freshness-age',
      label: 'Anciennete du contenu',
      status: 'pass',
      message: `Contenu mis a jour il y a ${daysOld} jour${daysOld !== 1 ? 's' : ''}.`,
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  }

  // 2. Content reviewed
  if (input.contentLastReviewed) {
    const daysReviewed = daysSince(input.contentLastReviewed)

    if (daysReviewed > REVIEW_DAYS_WARN) {
      checks.push({
        id: 'freshness-reviewed',
        label: 'Revision du contenu',
        status: 'warning',
        message: `Derniere revision il y a ${daysReviewed} jours (>${'\u00A0'}6 mois) — Verifiez que le contenu est toujours d'actualite.`,
        category: 'bonus',
        weight: 2,
        group: 'freshness',
      })
    } else {
      checks.push({
        id: 'freshness-reviewed',
        label: 'Revision du contenu',
        status: 'pass',
        message: `Contenu revise il y a ${daysReviewed} jour${daysReviewed !== 1 ? 's' : ''}.`,
        category: 'bonus',
        weight: 2,
        group: 'freshness',
      })
    }
  }

  // 3. Year reference
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1
  const text = ctx.fullText

  const mentionsCurrent = text.includes(String(currentYear))
  const mentionsLast = text.includes(String(lastYear))

  // Check for older year mentions (2 years ago or more)
  const olderYearPattern = new RegExp(`\\b(20[0-2][0-9])\\b`, 'g')
  const yearMatches = [...text.matchAll(olderYearPattern)]
  const olderYears = yearMatches
    .map((m) => parseInt(m[1], 10))
    .filter((y) => y < lastYear)

  if (olderYears.length > 0 && !mentionsCurrent && !mentionsLast) {
    const oldest = Math.min(...olderYears)
    checks.push({
      id: 'freshness-year-ref',
      label: 'References temporelles',
      status: 'warning',
      message: `Le contenu mentionne l'annee ${oldest} sans reference a ${currentYear} ou ${lastYear} — Contenu potentiellement obsolete.`,
      category: 'important',
      weight: 2,
      group: 'freshness',
    })
  } else if (mentionsCurrent) {
    checks.push({
      id: 'freshness-year-ref',
      label: 'References temporelles',
      status: 'pass',
      message: `Le contenu fait reference a l'annee en cours (${currentYear}).`,
      category: 'important',
      weight: 2,
      group: 'freshness',
    })
  }
  // If no year is mentioned at all, skip this check (not all content needs year references)

  // 4. Thin content aging — thin + old is worse (skip for evergreen pages)
  if (!evergreen && ctx.wordCount < THIN_AGING_MIN_WORDS && daysOld > FRESHNESS_DAYS_WARN) {
    checks.push({
      id: 'freshness-thin-aging',
      label: 'Contenu leger et ancien',
      status: 'fail',
      message: `Seulement ${ctx.wordCount} mots et non mis a jour depuis ${daysOld} jours — Un contenu leger ancien perd rapidement en pertinence.`,
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  }

  return checks
}
