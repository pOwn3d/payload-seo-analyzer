/**
 * llms.txt endpoint (SEO 2026 — AI discoverability, OPT-IN).
 *
 * Generates a `/llms.txt` overview of the site for AI crawlers/assistants, in the
 * llmstxt.org format (H1 title, blockquote summary, link sections). This is a
 * *discoverability* file — adoption is growing but its ranking impact is unproven,
 * so it is:
 *   - DISABLED by default (opt-in via `SEO_LLMS_TXT=1`),
 *   - NEVER part of the on-page SEO score (it's a generator, not a rule).
 *
 * Public, read-only (like robots.txt / sitemap.xml).
 */

import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'

/** Recommended max size for llms.txt (~8 KB per llmstxt.org guidance). */
const MAX_BYTES = 8 * 1024

export interface LlmsTxtPage {
  title: string
  url: string
  description?: string
}

export interface LlmsTxtSection {
  heading: string
  pages: LlmsTxtPage[]
}

export interface LlmsTxtInput {
  siteName: string
  siteDescription?: string
  sections: LlmsTxtSection[]
}

/**
 * Build the llms.txt markdown body. Pure & deterministic (no Payload/IO) so it is
 * unit-testable. Empty sections are skipped; output is trimmed to `maxBytes`.
 */
export function buildLlmsTxt(input: LlmsTxtInput, maxBytes: number = MAX_BYTES): string {
  const lines: string[] = [`# ${input.siteName}`, '']
  if (input.siteDescription) {
    lines.push(`> ${input.siteDescription}`, '')
  }

  for (const section of input.sections) {
    if (!section.pages || section.pages.length === 0) continue
    const block: string[] = [`## ${section.heading}`, '']
    for (const p of section.pages) {
      if (!p.title || !p.url) continue
      block.push(`- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}`)
    }
    // Only append the section if it has at least one rendered link.
    if (block.length > 2) {
      lines.push(...block, '')
    }
  }

  let out = lines.join('\n').trim() + '\n'
  // Byte-cap (UTF-8 aware): trim whole lines off the end until within budget.
  if (Buffer.byteLength(out, 'utf8') > maxBytes) {
    const kept: string[] = []
    let bytes = 0
    for (const line of out.split('\n')) {
      const lineBytes = Buffer.byteLength(line + '\n', 'utf8')
      if (bytes + lineBytes > maxBytes) break
      kept.push(line)
      bytes += lineBytes
    }
    out = kept.join('\n').trimEnd() + '\n'
  }
  return out
}

/** Derive a human-ish site name from siteUrl when none is configured. */
function resolveSiteName(seoConfig?: SeoConfig, siteUrl?: string): string {
  const explicit = (seoConfig as { siteName?: string } | undefined)?.siteName
  if (explicit && typeof explicit === 'string') return explicit
  if (siteUrl) {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, '')
    } catch {
      /* fall through */
    }
  }
  return 'Website'
}

export function createLlmsTxtHandler(
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    // Opt-in only — disabled by default. Returns 404 so it's indistinguishable
    // from "feature not installed" when off.
    if (process.env.SEO_LLMS_TXT !== '1') {
      return new Response('Not found', { status: 404 })
    }

    try {
      const siteUrl = (
        seoConfig?.siteUrl ||
        process.env.NEXT_PUBLIC_SERVER_URL ||
        process.env.PAYLOAD_PUBLIC_SERVER_URL ||
        ''
      ).replace(/\/$/, '')
      const siteName = resolveSiteName(seoConfig, siteUrl)
      const siteDescription = (seoConfig as { siteDescription?: string } | undefined)?.siteDescription

      const fetched = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        depth: 0,
        maxDocs: 1000,
      })

      // Group indexable docs by collection → one section per collection.
      const bySection = new Map<string, LlmsTxtPage[]>()
      for (const { doc, sourceSlug } of fetched) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any
        // Skip drafts / explicitly non-indexed docs.
        if (d._status && d._status !== 'published') continue
        if (d.noindex === true || d?.meta?.noindex === true) continue
        const slug: string = (d.slug as string) || ''
        if (!slug) continue
        const path = sourceSlug === 'posts' ? `/posts/${slug}` : `/${slug}`
        const title: string = (d.title as string) || (d?.meta?.title as string) || slug
        const description: string | undefined =
          (typeof d?.meta?.description === 'string' && d.meta.description) || undefined
        const heading = sourceSlug.charAt(0).toUpperCase() + sourceSlug.slice(1)
        if (!bySection.has(heading)) bySection.set(heading, [])
        bySection.get(heading)!.push({ title, url: `${siteUrl}${path}`, description })
      }

      const sections: LlmsTxtSection[] = Array.from(bySection.entries()).map(([heading, pages]) => ({
        heading,
        pages,
      }))

      const body = buildLlmsTxt({ siteName, siteDescription, sections })
      return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] llms.txt generation error: ${message}`)
      return new Response('# Error generating llms.txt\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 500,
      })
    }
  }
}
