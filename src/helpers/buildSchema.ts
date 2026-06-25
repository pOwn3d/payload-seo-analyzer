/**
 * Schema.org / JSON-LD generation — pure, framework-agnostic builders.
 *
 * Single source of truth shared by the admin endpoint (`endpoints/schemaGenerator.ts`) and the
 * frontend render helper (`buildJsonLd` + the `<JsonLd>` component), so the structured data the
 * dashboard previews is byte-for-byte what the site renders.
 */

import { extractTextFromLexical } from '../helpers.js'

export const SCHEMA_TYPES = [
  'Article',
  'LocalBusiness',
  'BreadcrumbList',
  'FAQPage',
  'Product',
  'Organization',
  'Person',
  'Event',
  'Recipe',
  'Video',
] as const

export type SchemaType = (typeof SCHEMA_TYPES)[number]

function resolveSiteUrl(explicit?: string): string {
  return (
    explicit ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

/** Resolve an absolute image URL from a populated meta.image or hero media object. */
export function getSchemaImageUrl(
  metaImage: Record<string, unknown> | undefined,
  heroMedia: Record<string, unknown> | undefined,
  siteUrl: string,
): string | undefined {
  const img = metaImage || heroMedia
  if (!img) return undefined
  if (typeof img.url === 'string') {
    return img.url.startsWith('http') ? img.url : `${siteUrl}${img.url}`
  }
  if (typeof img.filename === 'string') {
    return `${siteUrl}/media/${img.filename}`
  }
  return undefined
}

/** Detect schema type from collection slug and document content. */
export function detectSchemaType(collection: string, doc: Record<string, unknown>): SchemaType {
  if (collection === 'posts') return 'Article'

  const layout = doc.layout as unknown[] | undefined
  if (layout && Array.isArray(layout)) {
    const hasFaqBlock = layout.some((block) => {
      if (!block || typeof block !== 'object') return false
      const b = block as Record<string, unknown>
      return b.blockType === 'faq' || b.blockType === 'FAQ' || b.blockType === 'faqBlock'
    })
    if (hasFaqBlock) return 'FAQPage'
  }

  if (doc.price !== undefined || doc.sku !== undefined || collection === 'products') {
    return 'Product'
  }

  const slug = (doc.slug as string) || ''
  if (/agence|entreprise|cabinet|bureau|boutique|magasin|restaurant/i.test(slug)) {
    return 'LocalBusiness'
  }

  return 'Article'
}

/**
 * Coerce a value into a clean array of non-empty strings — used for entity-disambiguation
 * arrays (`sameAs`, `knowsAbout`). Accepts a single string or an array; trims and drops empties.
 */
function toStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : value != null ? [value] : []
  return arr
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
}

/**
 * Build schema.org `Thing` nodes from strings or `{ name, sameAs }` objects.
 * Powers `about` / `mentions` — the topical-entity signals that let search & AI
 * engines disambiguate what a page is *about*. Returns [] when nothing usable.
 */
function buildThings(value: unknown): Record<string, unknown>[] {
  const arr = Array.isArray(value) ? value : value != null ? [value] : []
  const out: Record<string, unknown>[] = []
  for (const item of arr) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ '@type': 'Thing', name: item.trim() })
      continue
    }
    if (item && typeof item === 'object') {
      const t = item as Record<string, unknown>
      const name = typeof t.name === 'string' ? t.name.trim() : ''
      if (!name) continue
      const node: Record<string, unknown> = {
        '@type': (typeof t['@type'] === 'string' && t['@type']) || 'Thing',
        name,
      }
      const sameAs = toStringArray(t.sameAs)
      if (sameAs.length > 0) node.sameAs = sameAs
      out.push(node)
    }
  }
  return out
}

function buildAuthors(authors: unknown[]): unknown[] {
  return authors
    .filter((a) => a && typeof a === 'object')
    .map((a) => {
      const author = a as Record<string, unknown>
      const node: Record<string, unknown> = {
        '@type': 'Person',
        name: author.name || author.firstName || 'Author',
      }
      // Entity disambiguation (#1 lever for AI citations): resolvable profile URL...
      const url = author.url || author.profileUrl || author.authorUrl
      if (typeof url === 'string' && url.trim()) node.url = url.trim()
      // ...and sameAs anchors (Wikidata / LinkedIn / Crunchbase / ORCID…).
      const sameAs = toStringArray(author.sameAs ?? author.links ?? author.socialLinks)
      if (sameAs.length > 0) node.sameAs = sameAs
      // Topical authority of the author (areas of expertise).
      const knowsAbout = toStringArray(author.knowsAbout ?? author.expertise ?? author.topics)
      if (knowsAbout.length > 0) node.knowsAbout = knowsAbout
      if (typeof author.jobTitle === 'string' && author.jobTitle.trim()) {
        node.jobTitle = author.jobTitle.trim()
      }
      return node
    })
}

function buildArticleSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const imageUrl = getSchemaImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title || doc.title || '',
    description: meta.description || '',
    datePublished: doc.publishedAt || doc.createdAt || undefined,
    dateModified: doc.updatedAt || undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/${doc.slug || ''}`,
    },
  }

  if (imageUrl) schema.image = imageUrl
  if (doc.populatedAuthors) {
    schema.author = buildAuthors(doc.populatedAuthors as unknown[])
  }

  // Topical entities (SEO 2026): `about` = primary subject(s), `mentions` = secondary
  // entities referenced. Both let AI/search engines disambiguate the page's topic.
  const about = buildThings(doc.about)
  if (about.length > 0) schema.about = about
  const mentions = buildThings(doc.mentions)
  if (mentions.length > 0) schema.mentions = mentions

  // `isPartOf` ties the article to its parent work (a series, a pillar page, a site section).
  if (doc.isPartOf && typeof doc.isPartOf === 'object') {
    schema.isPartOf = doc.isPartOf
  } else if (typeof doc.isPartOf === 'string' && doc.isPartOf.trim()) {
    schema.isPartOf = { '@type': 'CreativeWork', name: doc.isPartOf.trim() }
  }

  return schema
}

/** Build a single LocalBusiness node from a location object (or the doc itself). */
function buildLocationNode(
  loc: Record<string, unknown>,
  doc: Record<string, unknown>,
  siteUrl: string,
): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const node: Record<string, unknown> = {
    '@type': (typeof loc.type === 'string' && loc.type) || 'LocalBusiness',
    name: loc.name || doc.title || meta.title || '',
    description: loc.description || meta.description || '',
    url: loc.url || `${siteUrl}/${doc.slug || ''}`,
  }

  if (loc.telephone) node.telephone = loc.telephone
  if (loc.email) node.email = loc.email
  if (loc.priceRange) node.priceRange = loc.priceRange

  const address = loc.address
  if (address && typeof address === 'object') {
    node.address = { '@type': 'PostalAddress', ...(address as Record<string, unknown>) }
  } else if (typeof address === 'string' && address) {
    node.address = address
  }

  // Geo coordinates — accept geo:{latitude,longitude} or flat lat/lng.
  const geo = (loc.geo || {}) as Record<string, unknown>
  const lat = geo.latitude ?? loc.latitude ?? loc.lat
  const lng = geo.longitude ?? loc.longitude ?? loc.lng
  if (lat != null && lng != null) {
    node.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
  }

  // Opening hours — array (e.g. ["Mo-Fr 09:00-18:00"]) or a single string.
  if (Array.isArray(loc.openingHours) && loc.openingHours.length > 0) {
    node.openingHours = loc.openingHours
  } else if (typeof loc.openingHours === 'string' && loc.openingHours) {
    node.openingHours = loc.openingHours
  }

  return node
}

/**
 * LocalBusiness schema with multi-location support: when `doc.locations` holds more than one
 * entry, emit a `@graph` of LocalBusiness nodes (multi-establishment local SEO). A single
 * location (or none) produces one node, preserving the original single-business behavior.
 */
function buildLocalBusinessSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const locations = Array.isArray(doc.locations)
    ? (doc.locations as unknown[]).filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    : []

  if (locations.length > 1) {
    return {
      '@context': 'https://schema.org',
      '@graph': locations.map((loc) => buildLocationNode(loc, doc, siteUrl)),
    }
  }

  const base = locations.length === 1 ? locations[0]! : doc
  return { '@context': 'https://schema.org', ...buildLocationNode(base, doc, siteUrl) }
}

function buildBreadcrumbSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const slug = (doc.slug as string) || ''
  const parts = slug.split('/').filter(Boolean)

  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
      item: siteUrl,
    },
  ]

  let path = ''
  for (let i = 0; i < parts.length; i++) {
    path += `/${parts[i]}`
    items.push({
      '@type': 'ListItem',
      position: i + 2,
      name: i === parts.length - 1 ? ((doc.title as string) || parts[i]!) : parts[i]!,
      item: `${siteUrl}${path}`,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

function buildFAQSchema(doc: Record<string, unknown>): Record<string, unknown> {
  const layout = (doc.layout as unknown[]) || []
  const questions: Array<Record<string, unknown>> = []

  for (const block of layout) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>

    if (b.blockType === 'faq' || b.blockType === 'FAQ' || b.blockType === 'faqBlock') {
      const items = (b.items || b.questions || b.faqs) as unknown[] | undefined
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (!item || typeof item !== 'object') continue
          const q = item as Record<string, unknown>
          const question = (q.question as string) || (q.title as string) || ''
          let answer = (q.answer as string) || ''

          if (!answer && q.answer && typeof q.answer === 'object') {
            answer = extractTextFromLexical(q.answer, 10)
          }

          if (question && answer) {
            questions.push({
              '@type': 'Question',
              name: question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: answer,
              },
            })
          }
        }
      }
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions,
  }
}

function buildProductSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const imageUrl = getSchemaImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: doc.title || meta.title || '',
    description: meta.description || '',
  }

  if (imageUrl) schema.image = imageUrl
  if (doc.sku) schema.sku = doc.sku
  if (doc.price !== undefined) {
    schema.offers = {
      '@type': 'Offer',
      price: doc.price,
      priceCurrency: (doc.currency as string) || 'EUR',
      availability: 'https://schema.org/InStock',
      url: `${siteUrl}/${doc.slug || ''}`,
    }
  }

  return schema
}

function buildOrganizationSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: doc.title || meta.title || '',
    description: meta.description || '',
    url: siteUrl,
  }

  if (doc.logo) {
    schema.logo = typeof doc.logo === 'string' ? doc.logo : (doc.logo as Record<string, unknown>)?.url
  }
  // sameAs = official entity profiles (Wikidata, LinkedIn, Crunchbase…) — the single
  // strongest signal for an organization to be recognized & cited by AI engines.
  const orgSameAs = toStringArray(doc.sameAs)
  if (orgSameAs.length > 0) schema.sameAs = orgSameAs
  // knowsAbout = the topics the organization has authority on (topical authority).
  const orgKnowsAbout = toStringArray(doc.knowsAbout)
  if (orgKnowsAbout.length > 0) schema.knowsAbout = orgKnowsAbout

  return schema
}

function buildPersonSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: doc.name || doc.title || meta.title || '',
  }

  if (doc.jobTitle) schema.jobTitle = doc.jobTitle
  if (doc.description || meta.description) schema.description = doc.description || meta.description
  schema.url = (typeof doc.url === 'string' && doc.url) || `${siteUrl}/${doc.slug || ''}`
  // sameAs = verifiable profiles → entity disambiguation for the Person (author E-E-A-T).
  const personSameAs = toStringArray(doc.sameAs)
  if (personSameAs.length > 0) schema.sameAs = personSameAs
  // knowsAbout = the person's areas of expertise (topical authority).
  const personKnowsAbout = toStringArray(doc.knowsAbout)
  if (personKnowsAbout.length > 0) schema.knowsAbout = personKnowsAbout

  return schema
}

function buildEventSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: doc.title || meta.title || '',
    description: meta.description || '',
    startDate: doc.startDate || doc.eventStart || undefined,
    endDate: doc.endDate || doc.eventEnd || undefined,
    url: `${siteUrl}/${doc.slug || ''}`,
  }

  if (doc.location) {
    schema.location =
      typeof doc.location === 'string'
        ? { '@type': 'Place', name: doc.location }
        : { '@type': 'Place', ...(doc.location as Record<string, unknown>) }
  }

  return schema
}

function buildRecipeSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const imageUrl = getSchemaImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: doc.title || meta.title || '',
    description: meta.description || '',
  }

  if (imageUrl) schema.image = imageUrl
  if (Array.isArray(doc.recipeIngredient)) schema.recipeIngredient = doc.recipeIngredient
  else if (Array.isArray(doc.ingredients)) schema.recipeIngredient = doc.ingredients
  if (doc.recipeInstructions) schema.recipeInstructions = doc.recipeInstructions
  else if (doc.instructions) schema.recipeInstructions = doc.instructions

  return schema
}

function buildVideoSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const imageUrl = getSchemaImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: doc.title || meta.title || '',
    description: meta.description || '',
    uploadDate: doc.uploadDate || doc.createdAt || undefined,
  }

  if (imageUrl) schema.thumbnailUrl = imageUrl
  if (doc.videoUrl || doc.contentUrl) schema.contentUrl = doc.videoUrl || doc.contentUrl
  if (doc.duration) schema.duration = doc.duration

  return schema
}

export interface BuildJsonLdOptions {
  /** Collection slug — used to auto-detect the schema type when `type` is omitted */
  collection?: string
  /** Absolute site URL (defaults to NEXT_PUBLIC_SERVER_URL / PAYLOAD_PUBLIC_SERVER_URL) */
  siteUrl?: string
  /** Force a specific schema type instead of auto-detecting */
  type?: SchemaType
}

/**
 * Build a clean JSON-LD object from a Payload document. Pure — safe to call on the server
 * during rendering (e.g. in a Next.js Server Component) or from the admin endpoint.
 */
export function buildJsonLd(
  doc: Record<string, unknown>,
  options: BuildJsonLdOptions = {},
): { type: SchemaType; jsonLd: Record<string, unknown> } {
  const siteUrl = resolveSiteUrl(options.siteUrl)
  const schemaType = options.type || detectSchemaType(options.collection || '', doc)

  let jsonLd: Record<string, unknown>
  switch (schemaType) {
    case 'Article':
      jsonLd = buildArticleSchema(doc, siteUrl)
      break
    case 'LocalBusiness':
      jsonLd = buildLocalBusinessSchema(doc, siteUrl)
      break
    case 'BreadcrumbList':
      jsonLd = buildBreadcrumbSchema(doc, siteUrl)
      break
    case 'FAQPage':
      jsonLd = buildFAQSchema(doc)
      break
    case 'Product':
      jsonLd = buildProductSchema(doc, siteUrl)
      break
    case 'Organization':
      jsonLd = buildOrganizationSchema(doc, siteUrl)
      break
    case 'Person':
      jsonLd = buildPersonSchema(doc, siteUrl)
      break
    case 'Event':
      jsonLd = buildEventSchema(doc, siteUrl)
      break
    case 'Recipe':
      jsonLd = buildRecipeSchema(doc, siteUrl)
      break
    case 'Video':
      jsonLd = buildVideoSchema(doc, siteUrl)
      break
  }

  // Strip undefined values for clean output.
  const cleaned = JSON.parse(JSON.stringify(jsonLd)) as Record<string, unknown>
  return { type: schemaType, jsonLd: cleaned }
}

/**
 * Convenience: build the JSON-LD and return a ready-to-inject `<script>` string.
 * In React/Next you can instead render the object directly:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(doc, opts).jsonLd) }} />
 */
export function renderJsonLdScript(doc: Record<string, unknown>, options: BuildJsonLdOptions = {}): string {
  const { jsonLd } = buildJsonLd(doc, options)
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
}
