/**
 * SEO Rules — hreflang validation (multi-locale).
 *
 * Runs ONLY when the page provides locale alternates (`input.localeAlternates`) — i.e.
 * mono-locale sites are left silent. Validates what can be checked from the alternate
 * SET itself: code format, duplicates, absolute URLs, x-default presence.
 *
 * NOTE: full *reciprocity* (each alternate links back) requires crawling every alternate
 * URL, which is out of scope for an on-page CMS analyzer — we validate the declared set,
 * not the rendered return tags of other pages.
 *
 * Translations are kept local to avoid bloating the central i18n file.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'

// ISO 639-1/2 language + optional ISO 3166-1 region, or the special 'x-default'.
const HREFLANG_RE = /^[a-z]{2,3}(-[a-z]{2,4})?$/i

const STRINGS = {
  fr: {
    codesLabel: 'Codes hreflang valides',
    codesPass: 'Tous les codes hreflang sont au format valide (langue ISO 639-1, région ISO 3166-1 optionnelle).',
    codesFail: (bad: string) => `Code(s) hreflang invalide(s) : ${bad} — un seul code erroné fait ignorer tout le cluster par Google.`,
    dupLabel: 'Doublons hreflang',
    dupPass: 'Aucun doublon de code hreflang.',
    dupFail: (dup: string) => `Code(s) hreflang en double : ${dup} — chaque locale doit être déclarée une seule fois.`,
    absLabel: 'URLs hreflang absolues',
    absPass: 'Toutes les URLs hreflang sont absolues.',
    absFail: 'Certaines URLs hreflang ne sont pas absolues — utilisez des URLs complètes (https://...).',
    xdefLabel: 'hreflang x-default',
    xdefPass: 'Un x-default est défini — bonne pratique pour les visiteurs hors locales ciblées.',
    xdefFail: 'Aucun x-default — ajoutez un hreflang="x-default" pour les locales non couvertes.',
  },
  en: {
    codesLabel: 'Valid hreflang codes',
    codesPass: 'All hreflang codes are well-formed (ISO 639-1 language, optional ISO 3166-1 region).',
    codesFail: (bad: string) => `Invalid hreflang code(s): ${bad} — a single bad code makes Google ignore the whole cluster.`,
    dupLabel: 'Duplicate hreflang',
    dupPass: 'No duplicate hreflang code.',
    dupFail: (dup: string) => `Duplicate hreflang code(s): ${dup} — each locale must be declared once.`,
    absLabel: 'Absolute hreflang URLs',
    absPass: 'All hreflang URLs are absolute.',
    absFail: 'Some hreflang URLs are not absolute — use full URLs (https://...).',
    xdefLabel: 'hreflang x-default',
    xdefPass: 'An x-default is defined — good practice for visitors outside targeted locales.',
    xdefFail: 'No x-default — add hreflang="x-default" for locales you do not cover.',
  },
} as const

export function checkHreflang(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const alts = input.localeAlternates
  if (!Array.isArray(alts) || alts.length === 0) return [] // mono-locale → silent

  const s = STRINGS[ctx.locale] ?? STRINGS.fr
  const checks: SeoCheck[] = []

  const codes = alts.map((a) => (a.hreflang || '').trim()).filter(Boolean)

  // 1. Valid code format
  const invalid = codes.filter((c) => c.toLowerCase() !== 'x-default' && !HREFLANG_RE.test(c))
  checks.push({
    id: 'hreflang-codes',
    label: s.codesLabel,
    status: invalid.length === 0 ? 'pass' : 'fail',
    message: invalid.length === 0 ? s.codesPass : s.codesFail(invalid.join(', ')),
    category: 'important',
    weight: 2,
    group: 'hreflang',
  })

  // 2. No duplicates
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const c of codes.map((c) => c.toLowerCase())) {
    if (seen.has(c)) dups.add(c)
    seen.add(c)
  }
  checks.push({
    id: 'hreflang-duplicates',
    label: s.dupLabel,
    status: dups.size === 0 ? 'pass' : 'warning',
    message: dups.size === 0 ? s.dupPass : s.dupFail([...dups].join(', ')),
    category: 'important',
    weight: 1,
    group: 'hreflang',
  })

  // 3. Absolute URLs
  const allAbsolute = alts.every((a) => /^https?:\/\//i.test((a.href || '').trim()))
  checks.push({
    id: 'hreflang-absolute',
    label: s.absLabel,
    status: allAbsolute ? 'pass' : 'warning',
    message: allAbsolute ? s.absPass : s.absFail,
    category: 'important',
    weight: 1,
    group: 'hreflang',
  })

  // 4. x-default present (recommended)
  const hasXDefault = codes.some((c) => c.toLowerCase() === 'x-default')
  checks.push({
    id: 'hreflang-x-default',
    label: s.xdefLabel,
    status: hasXDefault ? 'pass' : 'warning',
    message: hasXDefault ? s.xdefPass : s.xdefFail,
    category: 'bonus',
    weight: 1,
    group: 'hreflang',
  })

  return checks
}
