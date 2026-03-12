/**
 * Schema.org JSON-LD Auto-Generator endpoint.
 * Generates structured data (JSON-LD) from Payload document fields.
 * Supports: Article, LocalBusiness, BreadcrumbList, FAQPage, Product, Organization.
 *
 * Auto-detects schema type from collection/content, with optional override.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware.
 */

import type { PayloadHandler } from 'payload'
import { extractTextFromLexical } from '../helpers.js'

// ---------------------------------------------------------------------------
// Schema type detection
// ---------------------------------------------------------------------------

type SchemaType = 'Article' | 'LocalBusiness' | 'BreadcrumbList' | 'FAQPage' | 'Product' | 'Organization'

/** Detect schema type from collection slug and document content */
function detectSchemaType(collection: string, doc: Record<string, unknown>): SchemaType {
  // Posts are always articles
  if (collection === 'posts') return 'Article'

  // Check for FAQ blocks in layout
  const layout = doc.layout as unknown[] | undefined
  if (layout && Array.isArray(layout)) {
    const hasFaqBlock = layout.some((block) => {
      if (!block || typeof block !== 'object') return false
      const b = block as Record<string, unknown>
      return b.blockType === 'faq' || b.blockType === 'FAQ' || b.blockType === 'faqBlock'
    })
    if (hasFaqBlock) return 'FAQPage'
  }

  // Check for product-like fields
  if (doc.price !== undefined || doc.sku !== undefined || collection === 'products') {
    return 'Product'
  }

  // Check slug hints for local business pages
  const slug = (doc.slug as string) || ''
  if (/agence|entreprise|cabinet|bureau|boutique|magasin|restaurant/i.test(slug)) {
    return 'LocalBusiness'
  }

  // Default to Organization for global-like content, Article for pages
  return 'Article'
}

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

function buildArticleSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>
  const heroMedia = (doc.hero as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const imageUrl = getImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title || doc.title || '',
    description: meta.description || '',
    datePublished: doc.createdAt || undefined,
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

  return schema
}

function buildLocalBusinessSchema(doc: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const meta = (doc.meta || {}) as Record<string, unknown>

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: doc.title || meta.title || '',
    description: meta.description || '',
    url: `${siteUrl}/${doc.slug || ''}`,
  }

  if (doc.telephone) schema.telephone = doc.telephone
  if (doc.email) schema.email = doc.email
  if (doc.address && typeof doc.address === 'object') {
    schema.address = {
      '@type': 'PostalAddress',
      ...(doc.address as Record<string, unknown>),
    }
  }

  return schema
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

          // If answer is Lexical richText, extract text
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
  const imageUrl = getImageUrl(meta.image as Record<string, unknown> | undefined, heroMedia, siteUrl)

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

  return schema
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getImageUrl(
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

function buildAuthors(authors: unknown[]): unknown[] {
  return authors
    .filter((a) => a && typeof a === 'object')
    .map((a) => {
      const author = a as Record<string, unknown>
      return {
        '@type': 'Person',
        name: author.name || author.firstName || 'Author',
      }
    })
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export function createSchemaGeneratorHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url || '', 'http://localhost')
      const collection = url.searchParams.get('collection')
      const id = url.searchParams.get('id')
      const typeOverride = url.searchParams.get('type') as SchemaType | null

      if (!collection || !id) {
        return Response.json(
          { error: 'Missing required query params: collection, id' },
          { status: 400 },
        )
      }

      // Fetch the document
      let doc: Record<string, unknown>
      try {
        const result = await req.payload.findByID({
          collection,
          id,
          depth: 1,
          overrideAccess: true,
        })
        doc = result as Record<string, unknown>
      } catch {
        return Response.json({ error: `Document not found: ${collection}/${id}` }, { status: 404 })
      }

      // Determine site URL from env or request
      const siteUrl = (
        process.env.NEXT_PUBLIC_SERVER_URL ||
        process.env.PAYLOAD_PUBLIC_SERVER_URL ||
        'http://localhost:3000'
      ).replace(/\/$/, '')

      // Detect or use overridden type
      const schemaType = typeOverride || detectSchemaType(collection, doc)

      // Validate type override
      const validTypes: SchemaType[] = ['Article', 'LocalBusiness', 'BreadcrumbList', 'FAQPage', 'Product', 'Organization']
      if (!validTypes.includes(schemaType)) {
        return Response.json(
          { error: `Invalid schema type. Valid types: ${validTypes.join(', ')}` },
          { status: 400 },
        )
      }

      // Build the JSON-LD
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
      }

      // Remove undefined values for clean output
      const cleaned = JSON.parse(JSON.stringify(jsonLd))

      return Response.json({
        type: schemaType,
        jsonLd: cleaned,
        html: `<script type="application/ld+json">${JSON.stringify(cleaned, null, 2)}</script>`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] schema-generator error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
