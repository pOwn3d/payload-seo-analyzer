/**
 * Schema.org / JSON-LD requirement dictionary (SEO 2026).
 *
 * Source of truth for the `schema` rule group: which schema.org type is expected
 * per page type, the properties Google requires for rich-result eligibility, and
 * whether that type still produces a SERP rich result in 2026.
 *
 * IMPORTANT — honesty constraints:
 *  - Structured data is often injected at RENDER time (frontend), not stored in the
 *    CMS, so the analyzer cannot prove a page lacks JSON-LD. The schema check is
 *    therefore guidance (field availability), never a hard ranking penalty.
 *  - FAQPage / HowTo: markup stays valid and is still parsed by search/AI engines,
 *    but Google removed FAQ rich results (May 2026) and HowTo desktop results (2023).
 *    We flag "no rich result" WITHOUT ever recommending removing the markup.
 */

export type SchemaTypeKey =
  | 'Article'
  | 'Product'
  | 'LocalBusiness'
  | 'BreadcrumbList'
  | 'Organization'
  | 'Person'
  | 'FAQPage'
  | 'Event'
  | 'Recipe'
  | 'Video'

export interface SchemaRequirement {
  /** Properties needed for rich-result eligibility / a valid entity */
  required: readonly string[]
  /** Properties that strengthen the entity (E-E-A-T, AI understanding) */
  recommended: readonly string[]
  /** Whether Google still renders a SERP rich result for this type in 2026 */
  richResult: boolean
  /**
   * Complete Google rich-result REQUIRED property set (SEO 2026), used by the
   * additive `schema-required-fields` completeness check. It is a superset of
   * `required` and is intentionally kept SEPARATE so the legacy `schema-coverage`
   * check (which reads `required`) keeps its exact behavior. Falls back to
   * `required` when omitted.
   */
  googleRequired?: readonly string[]
}

export const SCHEMA_REQUIREMENTS: Record<SchemaTypeKey, SchemaRequirement> = {
  Article: {
    required: ['headline', 'image'],
    recommended: ['author', 'datePublished', 'dateModified', 'publisher'],
    richResult: true,
    // Google Article rich result also needs an attributed author + publication date.
    googleRequired: ['headline', 'image', 'author', 'datePublished'],
  },
  Product: {
    // Google needs name + at least one of offers / review / aggregateRating
    required: ['name', 'offers'],
    recommended: ['image', 'brand', 'aggregateRating', 'review', 'sku'],
    richResult: true,
    // Product snippets are far stronger with an image; flag it as required for completeness.
    googleRequired: ['name', 'image', 'offers'],
  },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHours', 'geo', 'priceRange'],
    richResult: true,
    // A reachable phone number is part of a complete LocalBusiness entity.
    googleRequired: ['name', 'address', 'telephone'],
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
    richResult: true,
  },
  Organization: {
    required: ['name', 'url'],
    recommended: ['logo', 'sameAs', 'knowsAbout'],
    richResult: false,
  },
  Person: {
    required: ['name'],
    recommended: ['sameAs', 'jobTitle', 'image', 'url', 'knowsAbout'],
    richResult: false,
    // A citable Person entity needs a resolvable URL (profile / sameAs anchor).
    googleRequired: ['name', 'url'],
  },
  FAQPage: {
    // mainEntity must hold Question nodes that each carry an acceptedAnswer.
    required: ['mainEntity'],
    recommended: [],
    // FAQ rich results removed by Google (May 2026). Markup still useful for AI/search understanding.
    richResult: false,
  },
  Event: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'offers', 'image', 'performer'],
    richResult: true,
  },
  Recipe: {
    required: ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
    recommended: ['nutrition', 'aggregateRating', 'totalTime', 'recipeYield'],
    richResult: true,
  },
  Video: {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['duration', 'contentUrl', 'description'],
    richResult: true,
  },
}

/**
 * Required properties the analyzer can actually VERIFY from CMS data (SeoInput/ctx).
 * Any required property NOT in this set is "unverifiable" — the analyzer reminds the
 * editor to confirm it instead of asserting it is missing (avoids false positives).
 */
export const CMS_VERIFIABLE_SCHEMA_FIELDS: ReadonlySet<string> = new Set([
  'headline',
  'name',
  'image',
  'url',
  'itemListElement',
  'mainEntity',
])

/**
 * Required properties the COMPLETENESS check (`schema-required-fields`) can derive
 * from CMS data. Superset of {@link CMS_VERIFIABLE_SCHEMA_FIELDS}: `author` and
 * `datePublished` are exposed by SeoInput (author / publishedAt), so the analyzer
 * can legitimately flag them as missing. Anything NOT in this set (offers, address,
 * telephone…) is "unverifiable" → the check reminds instead of asserting absence,
 * keeping the validation offline and free of structural false positives.
 */
export const CMS_DERIVABLE_SCHEMA_FIELDS: ReadonlySet<string> = new Set([
  ...CMS_VERIFIABLE_SCHEMA_FIELDS,
  'author',
  'datePublished',
])

/**
 * Split the Google-required properties of a schema type into:
 *  - `missing`: required AND CMS-derivable AND absent → safe to flag (no false positive)
 *  - `unverifiable`: required but not derivable from CMS → remind the editor to confirm
 *
 * Pure / offline — `present` is a flat map of fieldName → boolean computed by the caller.
 */
export function evaluateRequiredProperties(
  type: SchemaTypeKey,
  present: Record<string, boolean>,
): { missing: string[]; unverifiable: string[]; complete: boolean } {
  const def = SCHEMA_REQUIREMENTS[type]
  const props = def.googleRequired ?? def.required
  const missing = props.filter((p) => CMS_DERIVABLE_SCHEMA_FIELDS.has(p) && !present[p])
  const unverifiable = props.filter((p) => !CMS_DERIVABLE_SCHEMA_FIELDS.has(p))
  return { missing, unverifiable, complete: missing.length === 0 }
}
