/**
 * Specialized XML sitemaps (SEO 2026): News, Image and Video.
 * Public endpoints, no auth — like /sitemap.xml.
 *
 *   GET /sitemap-news.xml   → Google News sitemap (articles published in the last 48h)
 *   GET /sitemap-images.xml → image sitemap (images per page)
 *   GET /sitemap-video.xml  → video sitemap (video objects per page)
 *
 * Image/Video sitemaps need populated media (depth: 1), so docs are loaded in BOUNDED BATCHES
 * with an event-loop yield between each — same memory-safe pattern as the dashboard audit, so
 * a large site never spikes memory generating a sitemap.
 */
import type { Payload, PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resolveSiteUrl(seoConfig?: SeoConfig): string {
  return (seoConfig?.siteUrl || process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || '').replace(/\/$/, '')
}

function docPath(slug: string): string {
  return slug === 'home' || slug === '' ? '' : `/${slug}`
}

function xmlResponse(xml: string, status = 200): Response {
  return new Response(xml, {
    status,
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}

/** Absolute URL from a populated media object (url or filename). */
function mediaUrl(media: Record<string, unknown>, siteUrl: string): string | undefined {
  if (typeof media.url === 'string' && media.url) {
    return media.url.startsWith('http') ? media.url : `${siteUrl}${media.url}`
  }
  if (typeof media.filename === 'string' && media.filename) {
    return `${siteUrl}/media/${media.filename}`
  }
  return undefined
}

/** Recursively collect populated upload URLs of a given mime prefix ('image/' | 'video/'). */
function collectMediaUrls(node: unknown, mimePrefix: string, siteUrl: string, out: Set<string>, depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 8) return
  if (Array.isArray(node)) {
    for (const item of node) collectMediaUrls(item, mimePrefix, siteUrl, out, depth + 1)
    return
  }
  const obj = node as Record<string, unknown>
  const mime = typeof obj.mimeType === 'string' ? obj.mimeType : ''
  if (mime.startsWith(mimePrefix)) {
    const url = mediaUrl(obj, siteUrl)
    if (url) out.add(url)
  }
  for (const key of Object.keys(obj)) {
    // Skip a few large/irrelevant keys to bound the walk.
    if (key === 'sizes' || key === '_status') continue
    collectMediaUrls(obj[key], mimePrefix, siteUrl, out, depth + 1)
  }
}

async function eachPublishedDoc(
  payload: Payload,
  collections: string[],
  depth: number,
  onDoc: (doc: Record<string, unknown>, collection: string) => void,
): Promise<void> {
  const BATCH = Math.min(100, Math.max(1, parseInt(process.env.SEO_SITEMAP_BATCH_SIZE || '50', 10) || 50))
  const MAX = Math.max(1, parseInt(process.env.SEO_SITEMAP_MAX_DOCS || '5000', 10) || 5000)
  let count = 0
  for (const collection of collections) {
    try {
      let page = 1
      let hasMore = true
      while (hasMore) {
        const res = await payload.find({ collection, limit: BATCH, page, depth, overrideAccess: true })
        for (const doc of res.docs as Record<string, unknown>[]) {
          if (doc._status === 'draft') continue
          if (count >= MAX) return
          onDoc(doc, collection)
          count++
        }
        hasMore = res.hasNextPage
        page++
        await new Promise((resolve) => setImmediate(resolve))
      }
    } catch {
      // collection may not exist — skip
    }
  }
}

// ---------------------------------------------------------------------------
// GET /sitemap-news.xml — articles from the last 48h (depth 0, lightweight)
// ---------------------------------------------------------------------------
export function createNewsSitemapHandler(targetCollections: string[], seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      const siteUrl = resolveSiteUrl(seoConfig)
      const language = seoConfig?.locale === 'en' ? 'en' : 'fr'
      // Publication name: configured siteName, else the host.
      let publication = seoConfig?.siteName || ''
      if (!publication && siteUrl) {
        try {
          publication = new URL(siteUrl).hostname
        } catch {
          /* ignore */
        }
      }

      const cutoff = Date.now() - 48 * 3_600_000
      const entries: string[] = []

      await eachPublishedDoc(req.payload, targetCollections, 0, (doc) => {
        const dateStr =
          (typeof doc.publishedAt === 'string' && doc.publishedAt) ||
          (typeof doc.date === 'string' && doc.date) ||
          (typeof doc.createdAt === 'string' && doc.createdAt) ||
          ''
        if (!dateStr) return
        const t = new Date(dateStr).getTime()
        if (isNaN(t) || t < cutoff) return
        const title = (doc.title as string) || (doc.meta as Record<string, unknown>)?.title as string || ''
        if (!title) return
        const loc = `${siteUrl}${docPath((doc.slug as string) || '')}`
        entries.push(
          `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml(publication)}</news:name>\n        <news:language>${language}</news:language>\n      </news:publication>\n      <news:publication_date>${new Date(dateStr).toISOString()}</news:publication_date>\n      <news:title>${escapeXml(title)}</news:title>\n    </news:news>\n  </url>`,
        )
      })

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${entries.join('\n')}\n</urlset>`
      return xmlResponse(xml)
    } catch (error) {
      req.payload.logger.error(`[seo] sitemap-news error: ${error instanceof Error ? error.message : 'unknown'}`)
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 500)
    }
  }
}

// ---------------------------------------------------------------------------
// GET /sitemap-images.xml — images per page (batched depth 1)
// ---------------------------------------------------------------------------
export function createImageSitemapHandler(targetCollections: string[], seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      const siteUrl = resolveSiteUrl(seoConfig)
      const entries: string[] = []

      await eachPublishedDoc(req.payload, targetCollections, 1, (doc) => {
        const urls = new Set<string>()
        collectMediaUrls(doc, 'image/', siteUrl, urls)
        if (urls.size === 0) return
        const loc = `${siteUrl}${docPath((doc.slug as string) || '')}`
        const imgs = Array.from(urls)
          .slice(0, 1000) // sitemap image cap per URL
          .map((u) => `    <image:image><image:loc>${escapeXml(u)}</image:loc></image:image>`)
          .join('\n')
        entries.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${imgs}\n  </url>`)
      })

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>`
      return xmlResponse(xml)
    } catch (error) {
      req.payload.logger.error(`[seo] sitemap-images error: ${error instanceof Error ? error.message : 'unknown'}`)
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 500)
    }
  }
}

// ---------------------------------------------------------------------------
// GET /sitemap-video.xml — video objects per page (batched depth 1)
// ---------------------------------------------------------------------------
export function createVideoSitemapHandler(targetCollections: string[], seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      const siteUrl = resolveSiteUrl(seoConfig)
      const entries: string[] = []

      await eachPublishedDoc(req.payload, targetCollections, 1, (doc) => {
        const meta = (doc.meta || {}) as Record<string, unknown>
        const videoUrls = new Set<string>()
        collectMediaUrls(doc, 'video/', siteUrl, videoUrls)
        // Also accept explicit string video fields.
        for (const k of ['videoUrl', 'contentUrl', 'playerUrl']) {
          if (typeof doc[k] === 'string' && doc[k]) videoUrls.add(doc[k] as string)
        }
        if (videoUrls.size === 0) return

        const title = (doc.title as string) || (meta.title as string) || ''
        const description = (meta.description as string) || title
        // Thumbnail: first image we can find.
        const thumbs = new Set<string>()
        collectMediaUrls(meta.image, 'image/', siteUrl, thumbs)
        if (thumbs.size === 0) collectMediaUrls(doc, 'image/', siteUrl, thumbs)
        const thumbnail = Array.from(thumbs)[0] || ''
        const loc = `${siteUrl}${docPath((doc.slug as string) || '')}`

        const videos = Array.from(videoUrls)
          .slice(0, 100)
          .map(
            (u) =>
              `    <video:video>\n${thumbnail ? `      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>\n` : ''}      <video:title>${escapeXml(title || 'Video')}</video:title>\n      <video:description>${escapeXml(description || title || 'Video')}</video:description>\n      <video:content_loc>${escapeXml(u)}</video:content_loc>\n    </video:video>`,
          )
          .join('\n')
        entries.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${videos}\n  </url>`)
      })

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${entries.join('\n')}\n</urlset>`
      return xmlResponse(xml)
    } catch (error) {
      req.payload.logger.error(`[seo] sitemap-video error: ${error instanceof Error ? error.message : 'unknown'}`)
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 500)
    }
  }
}
