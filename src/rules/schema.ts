/**
 * SEO Rules — JSON-LD / Schema.org checks.
 *
 * SEO 2026 rewrite: the old check was "theatre" — it passed green whenever a page
 * had title + description + image, WITHOUT ever looking at schema requirements.
 * This version is page-type aware: it determines the schema type expected for the
 * page, then reports which REQUIRED fields are derivable from CMS data and which
 * still need manual confirmation. It also flags FAQPage as "no rich result" (2026)
 * without ever suggesting to remove valid markup.
 *
 * Honesty: structured data is often injected at render time (not stored in CMS),
 * so this is GUIDANCE (low weight), never a hard ranking penalty.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { getTranslations } from '../i18n.js'
import {
  SCHEMA_REQUIREMENTS,
  CMS_VERIFIABLE_SCHEMA_FIELDS,
  evaluateRequiredProperties,
  type SchemaTypeKey,
} from './schema-requirements.js'

const FAQ_BLOCK_TYPES = new Set(['faq', 'FAQ', 'faqBlock', 'faqs'])

/**
 * Local strings for the additive `schema-required-fields` completeness check.
 * Kept LOCAL (like rules/eeat.ts) to avoid bloating the central i18n file and to
 * keep this agent's edits confined to schema rule files.
 */
const SCHEMA_REQUIRED_STRINGS = {
  fr: {
    label: 'Propriétés Google requises (complétude)',
    missing: (type: string, fields: string) =>
      `Schéma ${type} : propriété(s) requise(s) par Google manquante(s) — ${fields}. À renseigner pour l'éligibilité aux résultats enrichis.`,
    remind: (type: string, fields: string) =>
      `Schéma ${type} : champs requis dérivables présents. Confirmez les propriétés non vérifiables depuis le CMS — ${fields}.`,
    complete: (type: string) =>
      `Schéma ${type} : toutes les propriétés requises par Google sont dérivables des données CMS.`,
    tip: "Complétez les propriétés requises (ex. author, datePublished, image) — c'est la condition d'éligibilité aux résultats enrichis et un signal fort pour les moteurs IA.",
  },
  en: {
    label: 'Google-required properties (completeness)',
    missing: (type: string, fields: string) =>
      `${type} schema: Google-required propert(ies) missing — ${fields}. Provide them for rich-result eligibility.`,
    remind: (type: string, fields: string) =>
      `${type} schema: derivable required fields are present. Confirm the CMS-unverifiable properties — ${fields}.`,
    complete: (type: string) =>
      `${type} schema: all Google-required properties are derivable from CMS data.`,
    tip: 'Fill the required properties (e.g. author, datePublished, image) — they gate rich-result eligibility and strongly help AI answer engines.',
  },
} as const

/** Detect whether the page carries an FAQ block (FAQPage markup is generatable). */
function hasFaqBlock(blocks: unknown): boolean {
  if (!Array.isArray(blocks)) return false
  return blocks.some((block) => {
    if (!block || typeof block !== 'object') return false
    const t = (block as Record<string, unknown>).blockType
    return typeof t === 'string' && FAQ_BLOCK_TYPES.has(t)
  })
}

/**
 * Determine the PRIMARY schema type expected for this page.
 * Returns null for page types where structured data is genuinely optional
 * (legal / contact / form) — avoids nagging editors with irrelevant schema.
 */
function detectExpectedSchemaType(input: SeoInput, ctx: AnalysisContext): SchemaTypeKey | null {
  if (input.isProduct) return 'Product'
  if (input.isPost || ctx.pageType === 'blog') return 'Article'
  if (ctx.pageType === 'local-seo') return 'LocalBusiness'
  if (ctx.pageType === 'agency') return 'Organization'
  if (ctx.pageType === 'legal' || ctx.pageType === 'contact' || ctx.pageType === 'form') return null
  // home / service / resource / generic → Article/WebPage is a sensible default
  return 'Article'
}

export function checkSchema(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.schema

  const faqPresent = hasFaqBlock(input.blocks)

  // Which required schema fields are derivable from CMS data available to the analyzer.
  const present: Record<string, boolean> = {
    headline: !!(input.metaTitle || input.heroTitle) || ctx.allHeadings.some((h) => h.tag === 'h1'),
    name: !!(input.metaTitle || input.heroTitle),
    image: ctx.imageStats.total > 0 || !!input.metaImage,
    url: true,
    itemListElement: !!input.slug,
    mainEntity: faqPresent,
  }

  const expected = detectExpectedSchemaType(input, ctx)

  if (expected === null) {
    // Structured data optional for this page type — informational, non-scoring.
    checks.push({
      id: 'schema-coverage',
      label: r.coverageLabel,
      status: 'pass',
      message: r.coverageOptional,
      category: 'bonus',
      weight: 0,
      group: 'schema',
    })
  } else {
    const reqDef = SCHEMA_REQUIREMENTS[expected]

    // Required fields we KNOW are missing (verifiable from CMS + absent).
    const knownMissing = reqDef.required.filter(
      (f) => CMS_VERIFIABLE_SCHEMA_FIELDS.has(f) && !present[f],
    )
    // Required fields we cannot verify from CMS data (author, offers, address...).
    const unverifiable = reqDef.required.filter((f) => !CMS_VERIFIABLE_SCHEMA_FIELDS.has(f))

    if (knownMissing.length > 0) {
      // A page that should carry <type> schema is missing required, CMS-visible fields.
      // → never a false "green", but a low-weight warning (schema may be render-injected).
      checks.push({
        id: 'schema-coverage',
        label: r.coverageLabel,
        status: 'warning',
        message: r.coverageMissing(expected, knownMissing.join(', ')),
        category: 'bonus',
        weight: 1,
        group: 'schema',
        tip: r.coverageMissingTip,
      })
    } else if (unverifiable.length > 0) {
      // CMS-visible required fields are present; remind editor to confirm the rest.
      checks.push({
        id: 'schema-coverage',
        label: r.coverageLabel,
        status: 'pass',
        message: r.coverageRemind(expected, unverifiable.join(', ')),
        category: 'bonus',
        weight: 0,
        group: 'schema',
      })
    } else {
      checks.push({
        id: 'schema-coverage',
        label: r.coverageLabel,
        status: 'pass',
        message: r.coveragePass(expected),
        category: 'bonus',
        weight: 1,
        group: 'schema',
      })
    }
  }

  // Completeness check (SEO 2026): flag the Google-REQUIRED properties that are missing
  // for the detected type. Additive to `schema-coverage` and weight 0 (informational) —
  // schema is often render-injected, so this is honest guidance, never a ranking penalty.
  if (expected !== null) {
    const sr = SCHEMA_REQUIRED_STRINGS[ctx.locale] ?? SCHEMA_REQUIRED_STRINGS.fr
    // Richer presence map: add E-E-A-T / entity-grade fields derivable from SeoInput.
    const presentExt: Record<string, boolean> = {
      ...present,
      author: !!(input.author && input.author.trim()),
      datePublished: !!input.publishedAt,
    }
    const { missing, unverifiable } = evaluateRequiredProperties(expected, presentExt)

    if (missing.length > 0) {
      checks.push({
        id: 'schema-required-fields',
        label: sr.label,
        status: 'warning',
        message: sr.missing(expected, missing.join(', ')),
        category: 'bonus',
        weight: 0,
        group: 'schema',
        tip: sr.tip,
      })
    } else {
      checks.push({
        id: 'schema-required-fields',
        label: sr.label,
        status: 'pass',
        message:
          unverifiable.length > 0
            ? sr.remind(expected, unverifiable.join(', '))
            : sr.complete(expected),
        category: 'bonus',
        weight: 0,
        group: 'schema',
      })
    }
  }

  // FAQ / HowTo: valid markup, but no SERP rich result since 2026 — never recommend removal.
  if (faqPresent && !SCHEMA_REQUIREMENTS.FAQPage.richResult) {
    checks.push({
      id: 'schema-faq-no-rich-result',
      label: r.faqNoRichResultLabel,
      status: 'pass',
      message: r.faqNoRichResult,
      category: 'bonus',
      weight: 0,
      group: 'schema',
    })
  }

  return checks
}
