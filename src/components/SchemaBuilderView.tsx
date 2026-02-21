'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'
import type { DashboardTranslations } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Design tokens — uses Payload CSS variables for theme compatibility
// ---------------------------------------------------------------------------
const V = {
  text: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  bg: 'var(--theme-elevation-0, #fff)',
  bgCard: 'var(--theme-elevation-50, #f9fafb)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  borderDark: 'var(--theme-border-color, #000)',
  green: '#22c55e',
  red: '#ef4444',
  cyan: '#00E5FF',
  yellow: '#FFD600',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------
const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontSize: 13,
  color: V.text,
  backgroundColor: V.bg,
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: V.textSecondary,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const cardStyle: React.CSSProperties = {
  border: `1px solid ${V.border}`,
  borderRadius: 10,
  backgroundColor: V.bgCard,
  overflow: 'hidden',
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: `1px solid ${V.border}`,
  fontWeight: 700,
  fontSize: 14,
  color: V.text,
  backgroundColor: V.bg,
}

const cardBodyStyle: React.CSSProperties = {
  padding: '18px',
}

// ---------------------------------------------------------------------------
// Schema type definitions
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'datetime' | 'array'

interface SchemaField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  /** For array fields — the sub-fields of each item */
  subFields?: SchemaField[]
}

interface SchemaTypeDef {
  label: string
  icon: string
  color: string
  jsonType: string
  fields: SchemaField[]
}

function getSchemaTypes(t: DashboardTranslations): Record<string, SchemaTypeDef> {
  return {
    LocalBusiness: {
      label: t.schemaBuilder.localBusiness,
      icon: '\uD83C\uDFEA',
      color: V.orange,
      jsonType: 'LocalBusiness',
      fields: [
        { name: 'name', label: t.schemaBuilder.name, type: 'text', required: true, placeholder: 'Ma Boulangerie' },
        { name: 'description', label: t.schemaBuilder.description, type: 'textarea', placeholder: 'Boulangerie artisanale depuis 1985...' },
        { name: 'streetAddress', label: t.schemaBuilder.address, type: 'text', placeholder: '12 rue de la Paix' },
        { name: 'addressLocality', label: t.schemaBuilder.city, type: 'text', placeholder: 'Paris' },
        { name: 'postalCode', label: t.schemaBuilder.postalCode, type: 'text', placeholder: '75002' },
        { name: 'addressCountry', label: t.schemaBuilder.country, type: 'text', placeholder: 'FR' },
        { name: 'telephone', label: t.schemaBuilder.phone, type: 'text', placeholder: '+33 1 23 45 67 89' },
        { name: 'email', label: t.schemaBuilder.email, type: 'text', placeholder: 'contact@boulangerie.fr' },
        { name: 'openingHours', label: t.schemaBuilder.openingHours, type: 'text', placeholder: 'Mo-Fr 07:00-19:00, Sa 08:00-18:00' },
        { name: 'latitude', label: t.schemaBuilder.latitude, type: 'text', placeholder: '48.8566' },
        { name: 'longitude', label: t.schemaBuilder.longitude, type: 'text', placeholder: '2.3522' },
        { name: 'image', label: t.schemaBuilder.imageUrl, type: 'text', placeholder: 'https://example.com/photo.jpg' },
        { name: 'priceRange', label: t.schemaBuilder.priceRange, type: 'text', placeholder: '\u20AC\u20AC' },
        { name: 'url', label: t.schemaBuilder.website, type: 'text', placeholder: 'https://boulangerie.fr' },
      ],
    },
    Article: {
      label: t.schemaBuilder.article,
      icon: '\uD83D\uDCDD',
      color: V.blue,
      jsonType: 'Article',
      fields: [
        { name: 'headline', label: t.schemaBuilder.title, type: 'text', required: true, placeholder: 'Comment faire du pain maison' },
        { name: 'authorName', label: t.schemaBuilder.author, type: 'text', placeholder: 'Jean Dupont' },
        { name: 'datePublished', label: t.schemaBuilder.publicationDate, type: 'datetime' },
        { name: 'dateModified', label: t.schemaBuilder.modificationDate, type: 'datetime' },
        { name: 'image', label: t.schemaBuilder.imageUrl, type: 'text', placeholder: 'https://example.com/article.jpg' },
        { name: 'publisherName', label: t.schemaBuilder.publisherName, type: 'text', placeholder: 'Mon Blog' },
        { name: 'publisherLogo', label: t.schemaBuilder.publisherLogo, type: 'text', placeholder: 'https://example.com/logo.png' },
        { name: 'description', label: t.schemaBuilder.description, type: 'textarea', placeholder: 'Un guide complet pour...' },
      ],
    },
    Product: {
      label: t.schemaBuilder.product,
      icon: '\uD83D\uDED2',
      color: V.green,
      jsonType: 'Product',
      fields: [
        { name: 'name', label: t.schemaBuilder.productName, type: 'text', required: true, placeholder: 'Pain de campagne bio' },
        { name: 'description', label: t.schemaBuilder.description, type: 'textarea', placeholder: 'Pain artisanal au levain naturel...' },
        { name: 'image', label: t.schemaBuilder.imageUrl, type: 'text', placeholder: 'https://example.com/pain.jpg' },
        { name: 'sku', label: t.schemaBuilder.sku, type: 'text', placeholder: 'PAIN-BIO-001' },
        { name: 'brand', label: t.schemaBuilder.brand, type: 'text', placeholder: 'Boulangerie Dupont' },
        { name: 'price', label: t.schemaBuilder.price, type: 'number', placeholder: '4.50' },
        { name: 'priceCurrency', label: t.schemaBuilder.currency, type: 'text', placeholder: 'EUR' },
        {
          name: 'availability',
          label: t.schemaBuilder.availability,
          type: 'select',
          options: [
            { label: t.schemaBuilder.inStock, value: 'https://schema.org/InStock' },
            { label: t.schemaBuilder.outOfStock, value: 'https://schema.org/OutOfStock' },
            { label: t.schemaBuilder.preOrder, value: 'https://schema.org/PreOrder' },
            { label: t.schemaBuilder.madeToOrder, value: 'https://schema.org/MadeToOrder' },
          ],
        },
        { name: 'reviewCount', label: t.schemaBuilder.reviewCount, type: 'number', placeholder: '42' },
        { name: 'ratingValue', label: t.schemaBuilder.ratingValue, type: 'number', placeholder: '4.5' },
      ],
    },
    FAQ: {
      label: t.schemaBuilder.faq,
      icon: '\u2753',
      color: V.purple,
      jsonType: 'FAQPage',
      fields: [
        {
          name: 'questions',
          label: t.schemaBuilder.questionsAnswers,
          type: 'array',
          subFields: [
            { name: 'question', label: t.schemaBuilder.question, type: 'text', required: true, placeholder: 'Quels sont vos horaires ?' },
            { name: 'answer', label: t.schemaBuilder.answer, type: 'textarea', required: true, placeholder: 'Nous sommes ouverts du lundi au...' },
          ],
        },
      ],
    },
    HowTo: {
      label: t.schemaBuilder.howTo,
      icon: '\uD83D\uDCD6',
      color: V.cyan,
      jsonType: 'HowTo',
      fields: [
        { name: 'name', label: t.schemaBuilder.guideTitle, type: 'text', required: true, placeholder: 'Comment faire un gateau au chocolat' },
        { name: 'description', label: t.schemaBuilder.description, type: 'textarea', placeholder: 'Un guide etape par etape pour...' },
        {
          name: 'steps',
          label: t.schemaBuilder.steps,
          type: 'array',
          subFields: [
            { name: 'name', label: t.schemaBuilder.stepTitle, type: 'text', required: true, placeholder: 'Preparer les ingredients' },
            { name: 'text', label: t.schemaBuilder.stepDescription, type: 'textarea', required: true, placeholder: 'Pesez 200g de farine...' },
            { name: 'image', label: t.schemaBuilder.imageLabel, type: 'text', placeholder: 'https://example.com/step1.jpg' },
          ],
        },
      ],
    },
    Organization: {
      label: t.schemaBuilder.organization,
      icon: '\uD83C\uDFE2',
      color: '#6366f1',
      jsonType: 'Organization',
      fields: [
        { name: 'name', label: t.schemaBuilder.name, type: 'text', required: true, placeholder: 'My Company' },
        { name: 'url', label: t.schemaBuilder.website, type: 'text', placeholder: 'https://example.com' },
        { name: 'logo', label: t.schemaBuilder.logoUrl, type: 'text', placeholder: 'https://example.com/logo.png' },
        { name: 'contactEmail', label: t.schemaBuilder.contactEmail, type: 'text', placeholder: 'contact@example.com' },
        { name: 'contactPhone', label: t.schemaBuilder.phone, type: 'text', placeholder: '+33 6 12 34 56 78' },
        {
          name: 'sameAs',
          label: t.schemaBuilder.socialMediaUrls,
          type: 'array',
          subFields: [
            { name: 'url', label: t.schemaBuilder.urlLabel, type: 'text', required: true, placeholder: 'https://linkedin.com/company/...' },
          ],
        },
      ],
    },
    Event: {
      label: t.schemaBuilder.event,
      icon: '\uD83C\uDF89',
      color: '#ec4899',
      jsonType: 'Event',
      fields: [
        { name: 'name', label: t.schemaBuilder.name, type: 'text', required: true, placeholder: 'Salon du web 2026' },
        { name: 'startDate', label: t.schemaBuilder.startDate, type: 'datetime' },
        { name: 'endDate', label: t.schemaBuilder.endDate, type: 'datetime' },
        { name: 'locationName', label: t.schemaBuilder.location, type: 'text', placeholder: 'Palais des Congres' },
        { name: 'locationAddress', label: t.schemaBuilder.locationAddress, type: 'text', placeholder: '2 place de la Porte Maillot, Paris' },
        { name: 'description', label: t.schemaBuilder.description, type: 'textarea', placeholder: 'Le plus grand salon du digital en France...' },
        { name: 'offerPrice', label: t.schemaBuilder.price, type: 'number', placeholder: '25' },
        { name: 'offerCurrency', label: t.schemaBuilder.currency, type: 'text', placeholder: 'EUR' },
        { name: 'offerUrl', label: t.schemaBuilder.ticketUrl, type: 'text', placeholder: 'https://example.com/billets' },
        { name: 'image', label: t.schemaBuilder.imageLabel, type: 'text', placeholder: 'https://example.com/event.jpg' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// JSON-LD builder — converts form data to structured JSON-LD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildJsonLd(type: string, values: Record<string, any>): Record<string, unknown> {
  switch (type) {
    case 'LocalBusiness': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
      }
      if (values.name) result.name = values.name
      if (values.description) result.description = values.description
      if (values.telephone) result.telephone = values.telephone
      if (values.email) result.email = values.email
      if (values.url) result.url = values.url
      if (values.image) result.image = values.image
      if (values.priceRange) result.priceRange = values.priceRange
      if (values.openingHours) result.openingHoursSpecification = values.openingHours

      // Address
      if (values.streetAddress || values.addressLocality || values.postalCode) {
        result.address = {
          '@type': 'PostalAddress',
          ...(values.streetAddress && { streetAddress: values.streetAddress }),
          ...(values.addressLocality && { addressLocality: values.addressLocality }),
          ...(values.postalCode && { postalCode: values.postalCode }),
          ...(values.addressCountry && { addressCountry: values.addressCountry }),
        }
      }

      // Geo
      if (values.latitude && values.longitude) {
        result.geo = {
          '@type': 'GeoCoordinates',
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
        }
      }

      return result
    }

    case 'Article': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
      }
      if (values.headline) result.headline = values.headline
      if (values.description) result.description = values.description
      if (values.image) result.image = values.image
      if (values.datePublished) result.datePublished = values.datePublished
      if (values.dateModified) result.dateModified = values.dateModified

      if (values.authorName) {
        result.author = { '@type': 'Person', name: values.authorName }
      }

      if (values.publisherName) {
        result.publisher = {
          '@type': 'Organization',
          name: values.publisherName,
          ...(values.publisherLogo && {
            logo: { '@type': 'ImageObject', url: values.publisherLogo },
          }),
        }
      }

      return result
    }

    case 'Product': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
      }
      if (values.name) result.name = values.name
      if (values.description) result.description = values.description
      if (values.image) result.image = values.image
      if (values.sku) result.sku = values.sku
      if (values.brand) result.brand = { '@type': 'Brand', name: values.brand }

      if (values.price) {
        result.offers = {
          '@type': 'Offer',
          price: Number(values.price),
          priceCurrency: values.priceCurrency || 'EUR',
          ...(values.availability && { availability: values.availability }),
        }
      }

      if (values.ratingValue && values.reviewCount) {
        result.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: Number(values.ratingValue),
          reviewCount: Number(values.reviewCount),
        }
      }

      return result
    }

    case 'FAQ': {
      const questions = (values.questions || []) as Array<{ question: string; answer: string }>
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions
          .filter((q) => q.question && q.answer)
          .map((q) => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: q.answer,
            },
          })),
      }
    }

    case 'HowTo': {
      const steps = (values.steps || []) as Array<{ name: string; text: string; image?: string }>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
      }
      if (values.name) result.name = values.name
      if (values.description) result.description = values.description
      result.step = steps
        .filter((s) => s.name && s.text)
        .map((s) => ({
          '@type': 'HowToStep',
          name: s.name,
          text: s.text,
          ...(s.image && { image: s.image }),
        }))
      return result
    }

    case 'Organization': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
      }
      if (values.name) result.name = values.name
      if (values.url) result.url = values.url
      if (values.logo) result.logo = values.logo

      if (values.contactEmail || values.contactPhone) {
        result.contactPoint = {
          '@type': 'ContactPoint',
          ...(values.contactEmail && { email: values.contactEmail }),
          ...(values.contactPhone && { telephone: values.contactPhone }),
        }
      }

      const sameAs = (values.sameAs || []) as Array<{ url: string }>
      const urls = sameAs.filter((s) => s.url).map((s) => s.url)
      if (urls.length > 0) result.sameAs = urls

      return result
    }

    case 'Event': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Event',
      }
      if (values.name) result.name = values.name
      if (values.description) result.description = values.description
      if (values.startDate) result.startDate = values.startDate
      if (values.endDate) result.endDate = values.endDate
      if (values.image) result.image = values.image

      if (values.locationName) {
        result.location = {
          '@type': 'Place',
          name: values.locationName,
          ...(values.locationAddress && {
            address: { '@type': 'PostalAddress', streetAddress: values.locationAddress },
          }),
        }
      }

      if (values.offerPrice) {
        result.offers = {
          '@type': 'Offer',
          price: Number(values.offerPrice),
          priceCurrency: values.offerCurrency || 'EUR',
          ...(values.offerUrl && { url: values.offerUrl }),
        }
      }

      return result
    }

    default:
      return {}
  }
}

// ---------------------------------------------------------------------------
// JSON syntax highlighter (inline spans)
// ---------------------------------------------------------------------------

function syntaxHighlight(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Regex to match JSON tokens
  const tokenRegex = /("(?:\\.|[^"\\])*")\s*:/g
  const valueRegex = /:\s*("(?:\\.|[^"\\])*"|true|false|null|\d+(?:\.\d+)?)/g
  const lines = json.split('\n')

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const parts: React.ReactNode[] = []
    let lastIdx = 0

    // Find keys and values
    const allMatches: Array<{ start: number; end: number; type: 'key' | 'string' | 'number' | 'boolean' | 'null'; text: string }> = []

    // Keys
    let m: RegExpExecArray | null
    const keyRe = new RegExp(tokenRegex.source, 'g')
    while ((m = keyRe.exec(line)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[1].length, type: 'key', text: m[1] })
    }

    // Values
    const valRe = new RegExp(valueRegex.source, 'g')
    while ((m = valRe.exec(line)) !== null) {
      const val = m[1]
      const valStart = m.index + m[0].indexOf(val)
      let valType: 'string' | 'number' | 'boolean' | 'null' = 'string'
      if (val === 'true' || val === 'false') valType = 'boolean'
      else if (val === 'null') valType = 'null'
      else if (/^\d/.test(val)) valType = 'number'
      // Only add if not overlapping with a key
      if (!allMatches.some((am) => valStart >= am.start && valStart < am.end)) {
        allMatches.push({ start: valStart, end: valStart + val.length, type: valType, text: val })
      }
    }

    allMatches.sort((a, b) => a.start - b.start)

    for (const match of allMatches) {
      // Add text before this match
      if (match.start > lastIdx) {
        parts.push(line.slice(lastIdx, match.start))
      }

      const colorMap: Record<string, string> = {
        key: V.blue,
        string: V.green,
        number: V.orange,
        boolean: V.purple,
        null: V.red,
      }

      parts.push(
        <span key={`${li}-${match.start}`} style={{ color: colorMap[match.type] || V.text }}>
          {match.text}
        </span>,
      )
      lastIdx = match.end
    }

    // Remaining text
    if (lastIdx < line.length) {
      parts.push(line.slice(lastIdx))
    }

    nodes.push(
      <div key={`line-${li}`} style={{ minHeight: '1.3em' }}>
        {parts.length > 0 ? parts : ' '}
      </div>,
    )
  }

  return nodes
}

// ---------------------------------------------------------------------------
// Toast sub-component
// ---------------------------------------------------------------------------

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 2500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        borderRadius: 8,
        backgroundColor: V.green,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SchemaBuilderView component
// ---------------------------------------------------------------------------

export function SchemaBuilderView() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)

  const [selectedType, setSelectedType] = useState<string>('LocalBusiness')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [values, setValues] = useState<Record<string, any>>({})
  const [toast, setToast] = useState<string | null>(null)

  const schemaTypes = useMemo(() => getSchemaTypes(t), [t])
  const def = schemaTypes[selectedType]

  // Reset values when type changes
  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type)
    setValues({})
  }, [])

  // Update a single field value
  const updateField = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  // Update an array field item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateArrayItem = useCallback((arrayName: string, index: number, fieldName: string, value: any) => {
    setValues((prev) => {
      const arr = [...(prev[arrayName] || [])]
      if (!arr[index]) arr[index] = {}
      arr[index] = { ...arr[index], [fieldName]: value }
      return { ...prev, [arrayName]: arr }
    })
  }, [])

  const addArrayItem = useCallback((arrayName: string) => {
    setValues((prev) => ({
      ...prev,
      [arrayName]: [...(prev[arrayName] || []), {}],
    }))
  }, [])

  const removeArrayItem = useCallback((arrayName: string, index: number) => {
    setValues((prev) => ({
      ...prev,
      [arrayName]: (prev[arrayName] || []).filter((_: unknown, i: number) => i !== index),
    }))
  }, [])

  // Build JSON-LD
  const jsonLd = useMemo(() => buildJsonLd(selectedType, values), [selectedType, values])
  const jsonString = useMemo(() => JSON.stringify(jsonLd, null, 2), [jsonLd])
  const scriptTag = useMemo(
    () => `<script type="application/ld+json">\n${jsonString}\n</script>`,
    [jsonString],
  )

  // Copy helpers
  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setToast(`${label} ${t.schemaBuilder.copied}`)
      } catch {
        setToast(t.schemaBuilder.copyError)
      }
    },
    [t],
  )

  // Highlighted preview
  const highlighted = useMemo(() => syntaxHighlight(jsonString), [jsonString])

  // Render a single field
  const renderField = (field: SchemaField, parentArray?: string, arrayIndex?: number) => {
    const fieldKey = parentArray ? `${parentArray}.${arrayIndex}.${field.name}` : field.name

    if (field.type === 'array') {
      const items = (values[field.name] || []) as Array<Record<string, unknown>>
      return (
        <div key={fieldKey} style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, fontSize: 12, marginBottom: 8 }}>
            {field.label}
            {field.required && <span style={{ color: V.red, marginLeft: 4 }}>*</span>}
          </label>
          {items.map((item, idx) => (
            <div
              key={`${fieldKey}-${idx}`}
              style={{
                border: `1px solid ${V.border}`,
                borderRadius: 8,
                padding: 14,
                marginBottom: 10,
                backgroundColor: V.bg,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: V.textSecondary }}>
                  #{idx + 1}
                </span>
                <button
                  onClick={() => removeArrayItem(field.name, idx)}
                  style={{
                    ...btnBase,
                    padding: '2px 8px',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    color: V.red,
                    border: `1px solid rgba(239,68,68,0.2)`,
                    fontSize: 10,
                  }}
                >
                  {t.common.delete}
                </button>
              </div>
              {(field.subFields || []).map((subField) => (
                <div key={`${fieldKey}-${idx}-${subField.name}`} style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>
                    {subField.label}
                    {subField.required && <span style={{ color: V.red, marginLeft: 4 }}>*</span>}
                  </label>
                  {subField.type === 'textarea' ? (
                    <textarea
                      value={(item[subField.name] as string) || ''}
                      onChange={(e) => updateArrayItem(field.name, idx, subField.name, e.target.value)}
                      placeholder={subField.placeholder}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={subField.type === 'number' ? 'number' : 'text'}
                      value={(item[subField.name] as string) || ''}
                      onChange={(e) => updateArrayItem(field.name, idx, subField.name, e.target.value)}
                      placeholder={subField.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={() => addArrayItem(field.name)}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: V.blue,
              border: `1px dashed ${V.border}`,
              width: '100%',
              textAlign: 'center',
            }}
          >
            {t.schemaBuilder.addButton}
          </button>
        </div>
      )
    }

    // Get current value
    const currentValue = parentArray
      ? ((values[parentArray] || [])[arrayIndex!] || {})[field.name] || ''
      : values[field.name] || ''

    const onChangeHandler = parentArray
      ? (val: string) => updateArrayItem(parentArray, arrayIndex!, field.name, val)
      : (val: string) => updateField(field.name, val)

    return (
      <div key={fieldKey} style={{ marginBottom: 14 }}>
        <label style={labelStyle}>
          {field.label}
          {field.required && <span style={{ color: V.red, marginLeft: 4 }}>*</span>}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            value={currentValue}
            onChange={(e) => onChangeHandler(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        ) : field.type === 'select' ? (
          <select
            value={currentValue}
            onChange={(e) => onChangeHandler(e.target.value)}
            style={inputStyle}
          >
            <option value="">{t.schemaBuilder.choose}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'datetime' ? (
          <input
            type="datetime-local"
            value={currentValue}
            onChange={(e) => onChangeHandler(e.target.value)}
            style={inputStyle}
          />
        ) : (
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            value={currentValue}
            onChange={(e) => onChangeHandler(e.target.value)}
            placeholder={field.placeholder}
            step={field.type === 'number' ? 'any' : undefined}
            style={inputStyle}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '20px 24px',
        maxWidth: 1200,
        margin: '0 auto',
        fontFamily: 'var(--font-body, system-ui)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: V.text }}>
          <span style={{ marginRight: 8 }}>&#123;&#125;</span>
          Schema.org Builder
        </h1>
        <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
          {t.schemaBuilder.visualGeneratorDesc}
        </p>
      </div>

      {/* Schema type selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
        }}
      >
        {Object.entries(schemaTypes).map(([key, typeDef]) => {
          const isSelected = selectedType === key
          return (
            <button
              key={key}
              onClick={() => handleTypeChange(key)}
              style={{
                ...btnBase,
                padding: '10px 16px',
                fontSize: 12,
                backgroundColor: isSelected ? typeDef.color : V.bgCard,
                color: isSelected ? '#fff' : V.text,
                border: isSelected ? `2px solid ${typeDef.color}` : `1px solid ${V.border}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{typeDef.icon}</span>
              {typeDef.label}
            </button>
          )
        })}
      </div>

      {/* Main content: Form + Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left: Form */}
        <div style={cardStyle}>
          <div style={{ ...cardHeaderStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{def.icon}</span>
            {def.label}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: `${def.color}20`,
                color: def.color,
              }}
            >
              {def.jsonType}
            </span>
          </div>
          <div style={cardBodyStyle}>
            {def.fields.map((field) => renderField(field))}
          </div>
        </div>

        {/* Right: Preview */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={cardStyle}>
            <div
              style={{
                ...cardHeaderStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{t.schemaBuilder.jsonLdPreview}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(34,197,94,0.1)',
                  color: V.green,
                }}
              >
                {t.schemaBuilder.liveUpdate}
              </span>
            </div>
            <div
              style={{
                ...cardBodyStyle,
                padding: '14px 18px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                backgroundColor: '#0d1117',
                color: '#e6edf3',
                maxHeight: 500,
                overflowY: 'auto',
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
              }}
            >
              {highlighted}
            </div>
          </div>

          {/* Copy buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 14,
            }}
          >
            <button
              onClick={() => copyToClipboard(jsonString, 'JSON-LD')}
              style={{
                ...btnBase,
                flex: 1,
                backgroundColor: V.blue,
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {t.schemaBuilder.copyJsonLd}
            </button>
            <button
              onClick={() => copyToClipboard(scriptTag, 'Script tag')}
              style={{
                ...btnBase,
                flex: 1,
                backgroundColor: V.green,
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {t.schemaBuilder.copyScriptTag}
            </button>
          </div>

          {/* Validation hint */}
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: 'rgba(59,130,246,0.06)',
              border: `1px solid rgba(59,130,246,0.15)`,
              fontSize: 11,
              color: V.textSecondary,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: V.blue }}>{t.schemaBuilder.tip}</strong> {t.schemaBuilder.validateOnRichResults}{' '}
            <span style={{ fontWeight: 600, color: V.text }}>
              search.google.com/test/rich-results
            </span>{' '}
            {t.schemaBuilder.beforeDeploying}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
