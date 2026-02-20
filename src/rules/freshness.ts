/**
 * SEO Rules — Content freshness / decay detection.
 *
 * Checks:
 * 1. Content age — based on updatedAt
 * 2. Content reviewed — based on contentLastReviewed
 * 3. Year reference — mentions of current/past years in content
 * 4. Thin content aging — thin + old content is penalised harder
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import {
  MS_PER_DAY,
  FRESHNESS_DAYS_EVERGREEN,
  FRESHNESS_DAYS_FAIL,
  FRESHNESS_DAYS_WARN,
  REVIEW_DAYS_WARN,
  getEvergreenSlugs,
  THIN_AGING_MIN_WORDS,
} from '../constants.js'
import { getTranslations } from '../i18n.js'

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY)
}

function isEvergreenPage(slug: string | undefined): boolean {
  if (!slug) return false
  // Check both FR and EN evergreen slugs — a site may mix languages
  const allEvergreen = [...getEvergreenSlugs('fr'), ...getEvergreenSlugs('en')]
  return allEvergreen.some((s) => slug === s || slug.endsWith(`/${s}`))
}

export function checkFreshness(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.freshness
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
        label: r.ageLabel,
        status: 'warning',
        message: r.ageEvergreenWarn(daysOld),
        category: 'bonus',
        weight: 1,
        group: 'freshness',
      })
    } else {
      checks.push({
        id: 'freshness-age',
        label: r.ageLabel,
        status: 'pass',
        message: r.ageEvergreenPass(daysOld),
        category: 'bonus',
        weight: 1,
        group: 'freshness',
      })
    }
  } else if (daysOld > FRESHNESS_DAYS_FAIL) {
    checks.push({
      id: 'freshness-age',
      label: r.ageLabel,
      status: 'fail',
      message: r.ageFail(daysOld),
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  } else if (daysOld > FRESHNESS_DAYS_WARN) {
    checks.push({
      id: 'freshness-age',
      label: r.ageLabel,
      status: 'warning',
      message: r.ageWarn(daysOld),
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  } else {
    checks.push({
      id: 'freshness-age',
      label: r.ageLabel,
      status: 'pass',
      message: r.agePass(daysOld),
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
        label: r.reviewLabel,
        status: 'warning',
        message: r.reviewWarn(daysReviewed),
        category: 'bonus',
        weight: 2,
        group: 'freshness',
      })
    } else {
      checks.push({
        id: 'freshness-reviewed',
        label: r.reviewLabel,
        status: 'pass',
        message: r.reviewPass(daysReviewed),
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
      label: r.yearRefLabel,
      status: 'warning',
      message: r.yearRefWarn(oldest, currentYear, lastYear),
      category: 'important',
      weight: 2,
      group: 'freshness',
    })
  } else if (mentionsCurrent) {
    checks.push({
      id: 'freshness-year-ref',
      label: r.yearRefLabel,
      status: 'pass',
      message: r.yearRefPass(currentYear),
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
      label: r.thinAgingLabel,
      status: 'fail',
      message: r.thinAgingFail(ctx.wordCount, daysOld),
      category: 'important',
      weight: 3,
      group: 'freshness',
    })
  }

  return checks
}
