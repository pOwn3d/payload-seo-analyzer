/**
 * AI image alt-text (SEO 2026 + accessibility) — Claude vision.
 *
 *   GET  /alt-text-audit → list media missing alt text (admin)
 *   POST /ai-alt-text    → generate alt for one image (Claude vision), optionally apply (admin)
 *                          - { id, apply:false }                 → generate, return suggestion
 *                          - { id, apply:true, altText:"..." }   → write the provided text (no LLM call)
 *
 * Gated behind `features.aiFeatures`. The API key is read only from ANTHROPIC_API_KEY (server
 * side). Model defaults to `claude-opus-4-8` (vision-capable), overridable via SEO_AI_MODEL.
 *
 * Security: the image is fetched server-side and must be on the configured site origin (or
 * SEO_MEDIA_ORIGIN) — SSRF-safe, consistent with the Core Web Vitals endpoint.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { resolveGscSiteUrl } from '../helpers/gscClient.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { fetchWithRetry } from '../helpers/fetchWithRetry.js'

// Sonnet 4.6 is vision-capable; set SEO_AI_MODEL=claude-opus-4-8 for max quality.
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const ALT_MAX = 125
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

const SUPPORTED_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
}

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

/** Resolve an absolute, SSRF-checked image URL from a media doc. Returns null if not allowed. */
function resolveImageUrl(media: Record<string, unknown>, siteUrl: string | undefined): string | null {
  const raw = (typeof media.url === 'string' && media.url) || (typeof media.filename === 'string' ? `/media/${media.filename}` : '')
  if (!raw) return null

  let absolute: string
  if (/^https?:\/\//i.test(raw)) {
    absolute = raw
  } else if (siteUrl) {
    absolute = `${siteUrl.replace(/\/$/, '')}${raw.startsWith('/') ? '' : '/'}${raw}`
  } else {
    return null
  }

  // SSRF: only the site origin (or an explicit media origin) may be fetched.
  try {
    const target = new URL(absolute)
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null
    const allowed = new Set<string>()
    if (siteUrl) allowed.add(new URL(siteUrl).origin)
    if (process.env.SEO_MEDIA_ORIGIN) allowed.add(new URL(process.env.SEO_MEDIA_ORIGIN).origin)
    // If we have an allowlist, enforce it; otherwise (no siteUrl) refuse absolute external URLs.
    if (allowed.size > 0 && !allowed.has(target.origin)) return null
    if (allowed.size === 0) return null
    return target.toString()
  } catch {
    return null
  }
}

async function generateAltText(
  apiKey: string,
  model: string,
  base64: string,
  mediaType: string,
  language: string,
  context: { filename: string; title?: string },
): Promise<string | null> {
  const systemPrompt = `You write concise, descriptive image ALT text for accessibility and SEO.
Rules:
- Describe what is actually visible in the image.
- Maximum ${ALT_MAX} characters.
- Write in ${language === 'en' ? 'English' : 'French'}.
- Do NOT start with "image of", "photo of", "picture of" or similar.
- No quotes around the result. Return ONLY the alt text, nothing else.`

  const userText = `Filename: ${context.filename}${context.title ? `\nPage/context: ${context.title}` : ''}\nWrite the alt text for this image:`

  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> }
  if (data.stop_reason === 'refusal') return null
  const text = (data.content?.find((b) => b.type === 'text')?.text || '').trim().replace(/^["']|["']$/g, '')
  if (!text) return null
  return text.length > ALT_MAX ? text.slice(0, ALT_MAX).trim() : text
}

// ---------------------------------------------------------------------------
// GET /alt-text-audit — media missing alt text
// ---------------------------------------------------------------------------
export function createAltTextAuditHandler(uploadsCollection: string): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const url = new URL(req.url as string)
      const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))

      try {
        const missing = await req.payload.find({
          collection: uploadsCollection,
          where: { or: [{ alt: { exists: false } }, { alt: { equals: '' } }] },
          limit,
          depth: 0,
          overrideAccess: true,
        })
        const items = missing.docs.map((d) => ({
          id: d.id,
          filename: (d.filename as string) || '',
          url: (d.url as string) || '',
          mimeType: (d.mimeType as string) || '',
          alt: (d.alt as string) || '',
        }))
        return Response.json(
          { collection: uploadsCollection, missingCount: missing.totalDocs, items },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      } catch {
        // The uploads collection may not have an `alt` field — nothing to audit.
        return Response.json(
          { collection: uploadsCollection, missingCount: 0, items: [], note: 'no_alt_field' },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] alt-text-audit error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// POST /ai-alt-text — generate (Claude vision) and/or apply
// ---------------------------------------------------------------------------
export function createAiAltTextHandler(uploadsCollection: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const body = await parseJsonBody(req)
      const collection = typeof body.collection === 'string' ? body.collection : uploadsCollection
      const id = body.id != null ? String(body.id) : undefined
      const apply = body.apply === true
      const providedAlt = typeof body.altText === 'string' ? body.altText.trim() : undefined

      if (!id) return Response.json({ error: 'Missing required field: id' }, { status: 400 })

      // Fast path — apply a reviewed alt text without calling the model again.
      if (apply && providedAlt) {
        const alt = providedAlt.slice(0, ALT_MAX)
        await req.payload.update({ collection, id, data: { alt }, overrideAccess: true })
        return Response.json({ alt, applied: true, method: 'manual' })
      }

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return Response.json(
          { error: 'AI not configured. Set ANTHROPIC_API_KEY to generate alt text.', code: 'no_api_key' },
          { status: 400 },
        )
      }

      let media: Record<string, unknown>
      try {
        media = (await req.payload.findByID({ collection, id, depth: 0, overrideAccess: true })) as Record<string, unknown>
      } catch {
        return Response.json({ error: `Media not found: ${collection}/${id}` }, { status: 404 })
      }

      const mime = (media.mimeType as string) || ''
      const mediaType = SUPPORTED_MIME[mime.toLowerCase()]
      if (!mediaType) {
        return Response.json(
          { error: `Unsupported image type for vision: ${mime || 'unknown'} (use JPEG, PNG, GIF or WebP).` },
          { status: 422 },
        )
      }

      const siteUrl = resolveGscSiteUrl(seoConfig)
      const imageUrl = resolveImageUrl(media, siteUrl)
      if (!imageUrl) {
        return Response.json(
          { error: 'Could not resolve a safe image URL (must be on the site origin or SEO_MEDIA_ORIGIN).' },
          { status: 422 },
        )
      }

      // Fetch the image bytes server-side (SSRF-checked above) and base64-encode for the API.
      let base64: string
      try {
        const imgResp = await fetch(imageUrl)
        if (!imgResp.ok) throw new Error(`fetch ${imgResp.status}`)
        const buf = Buffer.from(await imgResp.arrayBuffer())
        if (buf.byteLength > MAX_IMAGE_BYTES) {
          return Response.json({ error: 'Image too large for vision (max 5 MB).' }, { status: 413 })
        }
        base64 = buf.toString('base64')
      } catch (e) {
        return Response.json({ error: `Could not fetch image: ${e instanceof Error ? e.message : 'error'}` }, { status: 502 })
      }

      const model = process.env.SEO_AI_MODEL || DEFAULT_MODEL
      const language = seoConfig?.locale === 'en' ? 'en' : 'fr'

      let alt: string | null
      try {
        alt = await generateAltText(apiKey, model, base64, mediaType, language, {
          filename: (media.filename as string) || '',
          title: typeof body.context === 'string' ? body.context : undefined,
        })
      } catch (e) {
        req.payload.logger.error(`[seo] ai-alt-text Claude error: ${e instanceof Error ? e.message : 'unknown'}`)
        return Response.json({ error: 'Alt-text generation failed.' }, { status: 502 })
      }

      if (!alt) {
        return Response.json({ error: 'The model did not return alt text (possibly declined).' }, { status: 502 })
      }

      let applied = false
      if (apply) {
        await req.payload.update({ collection, id, data: { alt }, overrideAccess: true })
        applied = true
      }

      return Response.json({ alt, applied, method: 'ai', model })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-alt-text error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
