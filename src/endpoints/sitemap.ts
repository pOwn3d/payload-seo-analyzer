/**
 * XML Sitemap endpoint handler.
 * GET — Dynamically generates sitemap.xml from published documents
 * across all target collections, respecting seo-settings configuration.
 */

import type { PayloadHandler } from 'payload'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Check if a slug matches a pattern (supports trailing wildcard: blog/*) */
function matchesPattern(slug: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return slug === prefix || slug.startsWith(prefix + '/')
  }
  return slug === pattern
}

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

/**
 * GET handler — generates sitemap.xml dynamically.
 * Public endpoint, no authentication required.
 */
export function createSitemapHandler(targetCollections: string[]): PayloadHandler {
  return async (req) => {
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

      // Read sitemap config from seo-settings
      const settingsResult = await req.payload.find({
        collection: 'seo-settings',
        limit: 1,
        overrideAccess: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = settingsResult.docs[0] as Record<string, any> | undefined
      const sitemapConfig = config?.sitemap || {}

      const excludedSlugs: string[] = (sitemapConfig.excludedSlugs || []).map(
        (entry: { slug: string }) => entry.slug,
      )
      const defaultChangefreq: string = sitemapConfig.defaultChangefreq || 'weekly'
      const defaultPriority: number = sitemapConfig.defaultPriority ?? 0.5
      const priorityOverrides: Array<{
        slugPattern: string
        priority: number
        changefreq?: string
      }> = sitemapConfig.priorityOverrides || []

      // Fetch all published documents from target collections
      const allDocs = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        depth: 0,
        limit: 10000,
      })

      const urls: SitemapUrl[] = []

      for (const { doc, sourceSlug: collectionSlug } of allDocs) {
        // Skip drafts
        if (doc._status === 'draft') continue

        const slug: string = doc.slug || ''

        // Skip excluded slugs
        if (excludedSlugs.some((excluded) => matchesPattern(slug, excluded))) continue

        const isHome = slug === 'home' || slug === ''
        const path = isHome ? '' : `/${slug}`

        // Determine priority and changefreq
        let priority = defaultPriority
        let changefreq = defaultChangefreq

        // Home page always gets highest priority
        if (isHome) {
          priority = 1.0
          changefreq = 'weekly'
        } else if (collectionSlug === 'posts') {
          // Blog posts default to slightly higher priority than generic default
          priority = Math.max(priority, 0.7)
          changefreq = 'weekly'
        } else {
          // Pages default
          priority = Math.max(priority, 0.8)
          changefreq = 'monthly'
        }

        // Apply priority overrides from settings
        for (const override of priorityOverrides) {
          if (matchesPattern(slug, override.slugPattern)) {
            priority = override.priority
            if (override.changefreq) changefreq = override.changefreq
            break
          }
        }

        urls.push({
          loc: `${serverUrl}${path}`,
          lastmod: doc.updatedAt
            ? new Date(doc.updatedAt).toISOString().split('T')[0]
            : undefined,
          changefreq,
          priority: priority.toFixed(1),
        })
      }

      // Build XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      for (const url of urls) {
        xml += '  <url>\n'
        xml += `    <loc>${escapeXml(url.loc)}</loc>\n`
        if (url.lastmod) xml += `    <lastmod>${url.lastmod}</lastmod>\n`
        if (url.changefreq) xml += `    <changefreq>${url.changefreq}</changefreq>\n`
        if (url.priority) xml += `    <priority>${url.priority}</priority>\n`
        xml += '  </url>\n'
      }
      xml += '</urlset>'

      return new Response(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] sitemap.xml generation error: ${message}`)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        {
          headers: { 'Content-Type': 'application/xml' },
          status: 500,
        },
      )
    }
  }
}
