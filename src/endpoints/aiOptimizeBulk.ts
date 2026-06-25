/**
 * Bulk AI SEO optimization (meta only) — "fix X pages at once".
 *
 *   POST /ai-optimize-bulk → { ids: string[], collection?, apply?: boolean, limit? }
 *
 * `ids` are composite keys `"collection::id"` (matching the dashboard selection) or plain ids
 * combined with `collection`. For each page it runs the same scan→propose→validate pipeline as
 * /ai-optimize and returns a **before → after report**:
 *   - apply: false (default) → DRY-RUN, nothing is written (preview / CSV export)
 *   - apply: true            → writes the optimized meta to the DB (payload.update)
 *
 * Meta only by design (title, description, focus keyword when empty/incoherent) — never body
 * content. Sequential + bounded (SQLite single-writer; avoids hammering the LLM). Admin only.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'
import { optimizeDocMeta } from './aiOptimize.js'
import { truncateWords } from '../helpers/metaGeneration.js'

const TITLE_MAX = 70
const DESC_MAX = 160
const KEYWORD_MAX = 60

import { isSeoAdmin as isAdmin } from '../helpers/isAdmin.js'

interface BulkRow {
  collection: string
  id: string
  title: string
  before: { metaTitle: string; metaDescription: string; focusKeyword: string }
  after: { metaTitle: string; metaDescription: string; focusKeyword: string }
  changed: boolean
  applied: boolean
  method?: 'ai' | 'heuristic'
  error?: string
}

export function createAiOptimizeBulkHandler(
  targetCollections?: string[],
  seoConfig?: SeoConfig,
  localeMapping?: Record<string, 'fr' | 'en'>,
): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const body = await parseJsonBody(req)
      const rawIds = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : []
      const defaultCollection = typeof body.collection === 'string' ? body.collection : undefined
      const apply = body.apply === true
      const MAX = 100
      const limit = Math.min(MAX, Math.max(1, parseInt(String(body.limit ?? 50), 10) || 50))

      // Direct-write mode — apply REVIEWED corrections from a previous dry-run, without
      // re-calling the model (cheaper + faster). Values are re-clamped to the SEO rules.
      const corrections = Array.isArray(body.corrections)
        ? (body.corrections as Array<Record<string, unknown>>)
        : null
      if (apply && corrections && corrections.length > 0) {
        let applied = 0
        let i = 0
        const rows: Array<{ collection: string; id: string; applied: boolean; error?: string }> = []
        for (const c of corrections.slice(0, MAX)) {
          i++
          const collection = typeof c.collection === 'string' ? c.collection : defaultCollection
          const id = c.id != null ? String(c.id) : undefined
          if (!collection || !id || collection.startsWith('global:')) continue
          if (targetCollections && !targetCollections.includes(collection)) continue
          const metaTitle = typeof c.metaTitle === 'string' ? truncateWords(c.metaTitle.trim(), TITLE_MAX) : ''
          const metaDescription = typeof c.metaDescription === 'string' ? truncateWords(c.metaDescription.trim(), DESC_MAX) : ''
          const focusKeyword = typeof c.focusKeyword === 'string' ? c.focusKeyword.trim().slice(0, KEYWORD_MAX) : ''
          const patch: Record<string, unknown> = {}
          if (metaTitle || metaDescription) patch.meta = { title: metaTitle, description: metaDescription }
          if (focusKeyword) patch.focusKeyword = focusKeyword
          try {
            if (Object.keys(patch).length > 0) {
              await req.payload.update({ collection, id, data: patch, overrideAccess: true })
              applied++
              rows.push({ collection, id, applied: true })
            }
          } catch (e) {
            rows.push({ collection, id, applied: false, error: e instanceof Error ? e.message : 'error' })
          }
          if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve))
        }
        return Response.json(
          { processed: rows.length, applied, mode: 'corrections', results: rows },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }

      if (rawIds.length === 0) {
        return Response.json({ error: 'Provide a non-empty "ids" array' }, { status: 400 })
      }

      // Parse composite "collection::id" keys (skip globals — meta is per-collection doc).
      const targets: Array<{ collection: string; id: string }> = []
      for (const raw of rawIds) {
        let collection: string | undefined
        let id: string | undefined
        if (raw.includes('::')) {
          const [c, i] = raw.split('::')
          collection = c
          id = i
        } else {
          collection = defaultCollection
          id = raw
        }
        if (!collection || !id) continue
        if (collection.startsWith('global:')) continue
        if (targetCollections && !targetCollections.includes(collection)) continue
        targets.push({ collection, id })
      }

      const capped = targets.length > limit
      const slice = targets.slice(0, limit)

      const { config: mergedConfig } = await loadMergedConfig(req.payload, seoConfig, {
        reqLocale: req.locale as string | undefined,
        localeMapping,
      })
      const apiKey = process.env.ANTHROPIC_API_KEY
      const model = process.env.SEO_AI_MODEL

      const results: BulkRow[] = []
      let applied = 0
      let i = 0

      for (const target of slice) {
        i++
        try {
          const r = await optimizeDocMeta(req.payload, {
            collection: target.collection,
            id: target.id,
            mergedConfig,
            apiKey,
            model,
          })
          if (!r.ok || !r.current || !r.suggestions) {
            results.push({
              collection: target.collection,
              id: target.id,
              title: '',
              before: { metaTitle: '', metaDescription: '', focusKeyword: '' },
              after: { metaTitle: '', metaDescription: '', focusKeyword: '' },
              changed: false,
              applied: false,
              error: r.error || 'optimize_failed',
            })
            continue
          }

          const before = r.current
          const after = {
            metaTitle: r.suggestions.metaTitle,
            metaDescription: r.suggestions.metaDescription,
            focusKeyword: r.suggestions.focusKeyword,
          }
          const changed =
            after.metaTitle !== before.metaTitle ||
            after.metaDescription !== before.metaDescription ||
            after.focusKeyword !== before.focusKeyword

          let didApply = false
          if (apply && changed) {
            const patch: Record<string, unknown> = {}
            if (after.metaTitle || after.metaDescription) {
              patch.meta = { title: after.metaTitle, description: after.metaDescription }
            }
            if (after.focusKeyword && after.focusKeyword !== before.focusKeyword) {
              patch.focusKeyword = after.focusKeyword
            }
            if (Object.keys(patch).length > 0) {
              await req.payload.update({ collection: target.collection, id: target.id, data: patch, overrideAccess: true })
              didApply = true
              applied++
            }
          }

          results.push({
            collection: target.collection,
            id: target.id,
            title: r.title || '',
            before,
            after,
            changed,
            applied: didApply,
            method: r.method,
          })
        } catch (e) {
          results.push({
            collection: target.collection,
            id: target.id,
            title: '',
            before: { metaTitle: '', metaDescription: '', focusKeyword: '' },
            after: { metaTitle: '', metaDescription: '', focusKeyword: '' },
            changed: false,
            applied: false,
            error: e instanceof Error ? e.message : 'error',
          })
        }
        // Yield to the event loop periodically to keep the server responsive.
        if (i % 3 === 0) await new Promise((resolve) => setImmediate(resolve))
      }

      return Response.json(
        {
          processed: results.length,
          changedCount: results.filter((r) => r.changed).length,
          applied,
          capped,
          results,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-optimize-bulk error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
