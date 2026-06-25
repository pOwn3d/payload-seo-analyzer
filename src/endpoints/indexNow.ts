/**
 * IndexNow (SEO 2026) — proactive indexing. Ping Bing/Yandex/Seznam (and Google via the shared
 * protocol) the moment content is published, instead of waiting for a crawl.
 *
 *   GET  /indexnow-key.txt → serves the IndexNow key file so search engines can verify ownership
 *   POST /indexnow-submit  → submit a batch of URLs now (admin) — initial seeding / re-submit
 *   + afterChange hook       → auto-submits a document's URL when it is published
 *
 * Opt-in (`features.indexNow`). The key comes from `SEO_INDEXNOW_KEY` (a 8-128 char hex-like
 * string you generate once). All submissions are fire-and-forget — they never block a save.
 */
import type { CollectionAfterChangeHook, PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { resolveGscSiteUrl } from '../helpers/gscClient.js'

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

/** Build a public URL for a doc from its slug. */
export function docToUrl(slug: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')
  if (!slug || slug === 'home') return base
  return `${base}/${slug}`
}

/** Submit URLs to the IndexNow API. Returns ok/status; never throws. */
export async function submitToIndexNow(
  siteUrl: string,
  key: string,
  keyLocation: string,
  urls: string[],
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  if (!key || urls.length === 0) return { ok: false, reason: 'no_key_or_urls' }
  let host: string
  try {
    host = new URL(siteUrl).host
  } catch {
    return { ok: false, reason: 'bad_site_url' }
  }
  try {
    const resp = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls.slice(0, 10000) }),
    })
    return { ok: resp.ok, status: resp.status }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'fetch_error' }
  }
}

function keyLocationFor(siteUrl: string, basePath: string): string {
  return `${siteUrl.replace(/\/$/, '')}/api${basePath}/indexnow-key.txt`
}

// ---------------------------------------------------------------------------
// GET /indexnow-key.txt — ownership verification file
// ---------------------------------------------------------------------------
export function createIndexNowKeyHandler(): PayloadHandler {
  return async () => {
    const key = process.env.SEO_INDEXNOW_KEY || ''
    if (!key) return new Response('IndexNow key not configured', { status: 404 })
    return new Response(key, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    })
  }
}

// ---------------------------------------------------------------------------
// POST /indexnow-submit — manual batch submit (admin)
// ---------------------------------------------------------------------------
export function createIndexNowSubmitHandler(
  basePath: string,
  targetCollections: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const key = process.env.SEO_INDEXNOW_KEY
      const siteUrl = resolveGscSiteUrl(seoConfig)
      if (!key) return Response.json({ error: 'SEO_INDEXNOW_KEY not configured.' }, { status: 400 })
      if (!siteUrl) return Response.json({ error: 'siteUrl not configured.' }, { status: 400 })

      // Collect published URLs across target collections (bounded).
      const urls: string[] = []
      for (const collection of targetCollections) {
        try {
          const res = await req.payload.find({ collection, limit: 1000, depth: 0, overrideAccess: true })
          for (const d of res.docs as Array<Record<string, unknown>>) {
            if (d._status === 'draft') continue
            urls.push(docToUrl((d.slug as string) || '', siteUrl))
          }
        } catch {
          /* skip */
        }
      }

      const result = await submitToIndexNow(siteUrl, key, keyLocationFor(siteUrl, basePath), urls)
      return Response.json(
        { submitted: urls.length, ...result },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] indexnow-submit error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// afterChange hook — auto-submit a document's URL on publish
// ---------------------------------------------------------------------------
export function createIndexNowHook(basePath: string, seoConfig?: SeoConfig): CollectionAfterChangeHook {
  return ({ doc, req }) => {
    try {
      const key = process.env.SEO_INDEXNOW_KEY
      const siteUrl = resolveGscSiteUrl(seoConfig)
      if (!key || !siteUrl) return doc
      // Only ping for published content.
      const status = (doc as { _status?: string })?._status
      if (status && status !== 'published') return doc
      const slug = ((doc as { slug?: string })?.slug as string) || ''
      const url = docToUrl(slug, siteUrl)
      // Fire-and-forget — never block the save on an external ping.
      void submitToIndexNow(siteUrl, key, keyLocationFor(siteUrl, basePath), [url]).then((r) => {
        if (!r.ok && r.reason !== 'no_key_or_urls') {
          req?.payload?.logger?.warn(`[seo] IndexNow submit failed (${r.status || r.reason})`)
        }
      })
    } catch {
      /* never break a save */
    }
    return doc
  }
}
