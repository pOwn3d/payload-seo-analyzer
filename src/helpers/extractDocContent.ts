/**
 * Unified document content extraction.
 * Extracts text, headings, links, and images from a Payload document.
 * Replaces duplicated extraction logic across audit, trackSeoScore,
 * keywordResearch, duplicateContent, aiRewrite, etc.
 */

import {
  extractTextFromLexical,
  extractLinksFromLexical,
  extractHeadingsFromLexical,
  extractImagesFromLexical,
} from '../helpers.js'

export interface ExtractedContent {
  text: string
  headings: Array<{ tag: string; text: string }>
  links: Array<{ url: string; text: string }>
  images: Array<{ src: string; alt: string }>
}

/**
 * Extract all content from a Payload document (pages, posts, globals).
 * Handles: hero, layout/blocks (content, services, testimonials, callToAction,
 * banner, code, form, etc.), richText lexical, and plain text fields
 * (title, meta.description, etc.).
 *
 * @param doc - A Payload document (any collection)
 * @param maxDepth - Maximum Lexical tree traversal depth (default: 10)
 */
export function extractDocContent(
  doc: Record<string, unknown>,
  maxDepth = 10,
): ExtractedContent {
  const textParts: string[] = []
  const headings: ExtractedContent['headings'] = []
  const links: ExtractedContent['links'] = []
  const images: ExtractedContent['images'] = []

  // --- Title & Meta ---
  if (typeof doc.title === 'string') textParts.push(doc.title)

  const meta = doc.meta as Record<string, unknown> | undefined
  if (meta) {
    if (typeof meta.title === 'string') textParts.push(meta.title)
    if (typeof meta.description === 'string') textParts.push(meta.description)
  }

  // --- Hero ---
  const hero = doc.hero as Record<string, unknown> | undefined
  if (hero?.richText) {
    textParts.push(extractTextFromLexical(hero.richText, maxDepth))
    links.push(...extractLinksFromLexical(hero.richText, maxDepth))
    headings.push(...extractHeadingsFromLexical(hero.richText, maxDepth))
  }

  // --- Layout blocks ---
  const layout = doc.layout as unknown[] | undefined
  if (layout && Array.isArray(layout)) {
    for (const block of layout) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>

      // Direct richText on block
      if (b.richText) {
        textParts.push(extractTextFromLexical(b.richText, maxDepth))
        links.push(...extractLinksFromLexical(b.richText, maxDepth))
        headings.push(...extractHeadingsFromLexical(b.richText, maxDepth))
      }

      // Columns with richText
      if (Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.richText) {
              textParts.push(extractTextFromLexical(colObj.richText, maxDepth))
              links.push(...extractLinksFromLexical(colObj.richText, maxDepth))
              headings.push(...extractHeadingsFromLexical(colObj.richText, maxDepth))
            }
          }
        }
      }

      // Services block
      if (b.blockType === 'services' && Array.isArray(b.services)) {
        for (const svc of b.services) {
          if (svc && typeof svc === 'object') {
            const s = svc as Record<string, unknown>
            if (typeof s.title === 'string') textParts.push(s.title)
            if (typeof s.description === 'string') textParts.push(s.description)
          }
        }
      }

      // Testimonials block
      if (b.blockType === 'testimonials' && Array.isArray(b.testimonials)) {
        for (const t of b.testimonials) {
          if (t && typeof t === 'object') {
            const testimonial = t as Record<string, unknown>
            if (typeof testimonial.quote === 'string') textParts.push(testimonial.quote)
          }
        }
      }

      // Banner block
      if (b.blockType === 'banner' && typeof b.content === 'string') {
        textParts.push(b.content)
      }

      // CTA block text
      if ((b.blockType === 'cta' || b.blockType === 'callToAction') && b.richText) {
        // Already handled above via b.richText
      }
    }
  }

  // --- Post content (Lexical richText) ---
  if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
    textParts.push(extractTextFromLexical(doc.content, maxDepth))
    links.push(...extractLinksFromLexical(doc.content, maxDepth))
    headings.push(...extractHeadingsFromLexical(doc.content, maxDepth))
  }

  // --- Extract images from all Lexical fields ---
  if (hero?.richText) {
    const heroImgs = extractImagesFromLexical(hero.richText, maxDepth)
    for (const alt of heroImgs.altTexts) {
      images.push({ src: '', alt })
    }
  }
  if (layout && Array.isArray(layout)) {
    for (const block of layout) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      if (b.richText) {
        const blockImgs = extractImagesFromLexical(b.richText, maxDepth)
        for (const alt of blockImgs.altTexts) {
          images.push({ src: '', alt })
        }
      }
    }
  }
  if (doc.content && typeof doc.content === 'object' && !Array.isArray(doc.content)) {
    const contentImgs = extractImagesFromLexical(doc.content, maxDepth)
    for (const alt of contentImgs.altTexts) {
      images.push({ src: '', alt })
    }
  }

  return {
    text: textParts.filter(Boolean).join(' ').trim(),
    headings,
    links,
    images,
  }
}
