/**
 * Shared link extraction utilities.
 * Used by index.ts (buildContext), sitemap-audit.ts, and linkGraph.ts
 * to extract internal links from Payload documents.
 *
 * Single source of truth — no more duplicate functions.
 */

import { extractLinksFromLexical } from '../helpers.js'

// ---------------------------------------------------------------------------
// Payload link field extractor
// Handles both structured links ({type, url, reference}) and resolves
// reference links when populated (depth >= 1).
// ---------------------------------------------------------------------------

export function extractPayloadLink(
  link: unknown,
): { url: string; text: string } | null {
  if (!link || typeof link !== 'object') return null
  const l = link as Record<string, unknown>

  const label = (typeof l.label === 'string' ? l.label : '') as string

  if (l.type === 'custom' && typeof l.url === 'string' && l.url) {
    return { url: l.url, text: label }
  }

  if (l.type === 'reference' && l.reference) {
    const ref = l.reference as Record<string, unknown>
    // Populated reference: { value: { slug: '...' } } or { value: { slug }, relationTo }
    if (ref.value && typeof ref.value === 'object') {
      const val = ref.value as Record<string, unknown>
      if (typeof val.slug === 'string') {
        return { url: `/${val.slug}`, text: label }
      }
    }
    // Direct slug on reference (some formats)
    if (typeof ref.slug === 'string') {
      return { url: `/${ref.slug}`, text: label }
    }
  }

  // Fallback: direct url field
  if (typeof l.url === 'string' && l.url) {
    return { url: l.url, text: label }
  }

  return null
}

// ---------------------------------------------------------------------------
// Normalize a link URL to a comparable slug
// Strips accents (NFD) so French slugs like "réalisations" match "realisations".
// ---------------------------------------------------------------------------

export function normalizeToSlug(url: string): string | null {
  // Skip anchors, empty links, and external URLs
  if (
    !url ||
    url === '#' ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    return null
  }

  // Remove anchor fragments
  let cleaned = url.split('#')[0]

  // Remove query strings
  cleaned = cleaned.split('?')[0]

  // Remove leading slashes
  cleaned = cleaned.replace(/^\/+/, '')

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '')

  // Empty string after cleaning = homepage
  if (!cleaned) return 'home'

  // Strip accents (e→e, a→a, etc.) to match Payload slugs
  return cleaned.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ---------------------------------------------------------------------------
// Extract all internal links from a Payload document
// Handles hero, layout blocks, post content (Lexical richText),
// and various block types (services, CTA, latestPosts, portfolio, banner).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractAllInternalLinks(doc: any): Array<{ url: string; slug: string; text: string }> {
  const allLinks: Array<{ url: string; text: string }> = []

  // 1. Hero richText
  if (doc.hero?.richText) {
    allLinks.push(...extractLinksFromLexical(doc.hero.richText))
  }

  // 2. Hero CTA links (linkGroup)
  if (doc.hero?.links && Array.isArray(doc.hero.links)) {
    for (const item of doc.hero.links) {
      if (item && typeof item === 'object') {
        const linkItem = item as Record<string, unknown>
        const linkData = extractPayloadLink(linkItem.link)
        if (linkData) allLinks.push(linkData)
      }
    }
  }

  // 3. Layout blocks
  const blocks = Array.isArray(doc.layout) ? doc.layout : []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>

    // Content blocks with columns
    if (b.columns && Array.isArray(b.columns)) {
      for (const col of b.columns) {
        if (col && typeof col === 'object') {
          const colObj = col as Record<string, unknown>
          if (colObj.richText) {
            allLinks.push(...extractLinksFromLexical(colObj.richText))
          }
          // Column link (enableLink + link field)
          if (colObj.enableLink && colObj.link) {
            const linkData = extractPayloadLink(colObj.link)
            if (linkData) allLinks.push(linkData)
          }
        }
      }
    }

    // Blocks with direct richText
    if (b.richText) {
      allLinks.push(...extractLinksFromLexical(b.richText))
    }

    // Services block links
    if (b.blockType === 'services' && Array.isArray(b.services)) {
      for (const svc of b.services) {
        if (svc && typeof svc === 'object') {
          const s = svc as Record<string, unknown>
          if (typeof s.link === 'string' && s.link) {
            allLinks.push({ url: s.link, text: (s.title as string) || '' })
          }
        }
      }
    }

    // CTA block links (linkGroup: links[].link)
    if (
      (b.blockType === 'cta' || b.blockType === 'callToAction') &&
      Array.isArray(b.links)
    ) {
      for (const item of b.links) {
        if (item && typeof item === 'object') {
          const linkItem = item as Record<string, unknown>
          const linkData = extractPayloadLink(linkItem.link)
          if (linkData) allLinks.push(linkData)
        }
      }
    }

    // LatestPosts block CTA link
    if (b.blockType === 'latestPosts' && typeof b.ctaLink === 'string' && b.ctaLink) {
      allLinks.push({ url: b.ctaLink, text: (b.ctaLabel as string) || '' })
    }

    // Portfolio block project links
    if (b.blockType === 'portfolio' && Array.isArray(b.projects)) {
      for (const proj of b.projects) {
        if (proj && typeof proj === 'object') {
          const p = proj as Record<string, unknown>
          if (typeof p.link === 'string' && p.link) {
            allLinks.push({ url: p.link, text: (p.title as string) || '' })
          }
        }
      }
    }

    // Banner block link
    if (b.blockType === 'banner' && b.link) {
      const linkData = extractPayloadLink(b.link)
      if (linkData) allLinks.push(linkData)
    }
  }

  // 4. Post content (Lexical richText)
  if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
    allLinks.push(...extractLinksFromLexical(doc.content))
  }

  // Filter to internal links only and normalize to slugs
  const internalLinks: Array<{ url: string; slug: string; text: string }> = []
  for (const link of allLinks) {
    const url = link.url.trim()
    // Internal links: start with / or don't start with http
    if (
      url.startsWith('/') ||
      (!url.startsWith('http') &&
        !url.startsWith('mailto:') &&
        !url.startsWith('tel:') &&
        url !== '#' &&
        url !== '')
    ) {
      const normalized = normalizeToSlug(url)
      if (normalized !== null) {
        internalLinks.push({ url, slug: normalized, text: link.text || '' })
      }
    }
  }

  return internalLinks
}
