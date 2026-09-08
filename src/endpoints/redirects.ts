/**
 * Redirects CRUD endpoint handler.
 * Provides GET (list), POST (bulk import), PATCH (update), DELETE (single/bulk)
 * for managing redirect entries via the Payload collection API.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler, Where } from 'payload'
import { parseJsonBody } from '../helpers/parseBody.js'
import {
  validateRedirectDestination,
  validateRedirectTarget,
  normalizeFromPath,
} from '../helpers/redirectSafety.js'

import { isSeoAdminRequest as isAdmin, isSeoPanelUser } from '../helpers/isAdmin.js'

/**
 * True when `candidate` is exactly the destination already stored on the document.
 *
 * Only consulted on the refusal path (an external destination while
 * `allowExternalRedirects` is off), so the normal update costs no extra read.
 */
async function isUnchangedDestination(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  collection: string,
  id: string,
  candidate: string,
): Promise<boolean> {
  const submitted = validateRedirectTarget(candidate)
  if (!submitted.valid || !submitted.normalized) return false
  try {
    const existing = await req.payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const stored = typeof existing?.to === 'string' ? validateRedirectTarget(existing.to) : null
    return Boolean(stored?.valid && stored.normalized === submitted.normalized)
  } catch {
    return false
  }
}

export function createRedirectsHandler(
  redirectsCollection: string,
  allowExternalRedirects = false,
): PayloadHandler {
  return async (req) => {
    if (!isSeoPanelUser(req)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const method = req.method?.toUpperCase()

    try {
      // GET — List all redirects with pagination and search (any authenticated user)
      if (method === 'GET') {
        const url = new URL(req.url || '', 'http://localhost')
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = parseInt(url.searchParams.get('limit') || '100', 10)
        const search = url.searchParams.get('search') || ''

        let where: Where | undefined
        if (search) {
          where = {
            or: [
              { from: { contains: search } },
              { to: { contains: search } },
            ],
          }
        }

        const result = await req.payload.find({
          collection: redirectsCollection,
          page,
          limit,
          sort: '-createdAt',
          where,
          overrideAccess: true,
        })

        return Response.json(result)
      }

      // DELETE — Single or bulk delete (admin only)
      if (method === 'DELETE') {
        if (!isAdmin(req)) {
          return Response.json({ error: 'Admin access required' }, { status: 403 })
        }
        const deleteBody = await parseJsonBody(req)
        const { id, ids } = deleteBody as { id?: string; ids?: string[] }

        if (ids && ids.length > 0) {
          // Bulk delete — sequential to avoid SQLite busy
          let deletedCount = 0
          for (const deleteId of ids) {
            try {
              await req.payload.delete({
                collection: redirectsCollection,
                id: deleteId,
                overrideAccess: true,
              })
              deletedCount++
            } catch {
              // Skip individual failures during bulk delete
            }
          }
          return Response.json({ success: true, deletedCount })
        }

        if (id) {
          await req.payload.delete({
            collection: redirectsCollection,
            id,
            overrideAccess: true,
          })
          return Response.json({ success: true })
        }

        return Response.json({ error: 'Missing id or ids' }, { status: 400 })
      }

      // PATCH — Update a single redirect (admin only — redirects control SEO traffic routing)
      if (method === 'PATCH') {
        if (!isAdmin(req)) {
          return Response.json({ error: 'Admin access required' }, { status: 403 })
        }
        const patchBody = await parseJsonBody(req)
        const id = typeof patchBody.id === 'string' ? patchBody.id.trim() : undefined
        const from = typeof patchBody.from === 'string' ? patchBody.from.trim() : undefined
        const to = typeof patchBody.to === 'string' ? patchBody.to.trim() : undefined
        const type = typeof patchBody.type === 'string' ? patchBody.type.trim() : undefined

        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }

        const updateData: Record<string, unknown> = {}
        if (from !== undefined) {
          const fromPath = normalizeFromPath(from)
          if (!fromPath) return Response.json({ error: 'Invalid source path' }, { status: 400 })
          updateData.from = fromPath
        }
        if (to !== undefined) {
          const toResult = validateRedirectDestination(to, allowExternalRedirects)
          if (!toResult.valid || !toResult.normalized) {
            // The Redirect Manager re-sends `to` verbatim when you only edit `from`
            // or the 301/302 type. A row stored back when external destinations were
            // allowed must stay editable, so an UNCHANGED destination is accepted —
            // and simply left alone, no write. Anything else is refused.
            if (!(await isUnchangedDestination(req, redirectsCollection, id, to))) {
              return Response.json({ error: toResult.reason || 'Invalid destination' }, { status: 400 })
            }
          } else {
            updateData.to = toResult.normalized
          }
        }
        if (type !== undefined) updateData.type = type

        const result = await req.payload.update({
          collection: redirectsCollection,
          id,
          data: updateData,
          overrideAccess: true,
        })

        return Response.json({ success: true, redirect: result })
      }

      // POST — Bulk import (admin only)
      if (method === 'POST') {
        if (!isAdmin(req)) {
          return Response.json({ error: 'Admin access required' }, { status: 403 })
        }
        const body = await parseJsonBody(req)

        const redirects = body.redirects as Array<{ from: string; to: string; type?: string }> | undefined

        if (!redirects || !Array.isArray(redirects)) {
          return Response.json({ error: 'Missing redirects array' }, { status: 400 })
        }

        let created = 0
        let skipped = 0
        let errors = 0
        // Bounded so a 5 000-row CSV cannot turn the response into a payload of
        // its own; the counters above stay exact whatever the cap.
        const MAX_REPORTED_FAILURES = 100
        const failed: Array<{ from: string; to: string; reason: string }> = []
        const reportFailure = (from: string, to: string, reason: string) => {
          errors++
          if (failed.length < MAX_REPORTED_FAILURES) failed.push({ from, to, reason })
        }

        // Pre-process: normalize paths, filter self-referencing
        const validRedirects: Array<{ from: string; to: string; type: string }> = []
        for (const r of redirects) {
          const fromPath = normalizeFromPath(r.from)
          const toResult = validateRedirectDestination(r.to, allowExternalRedirects)
          if (!fromPath || !toResult.valid || !toResult.normalized) {
            reportFailure(String(r.from ?? ''), String(r.to ?? ''), 'invalid source or target')
            continue
          }
          const toPath = toResult.normalized
          if (fromPath === toPath) {
            skipped++
            continue
          }
          validRedirects.push({ from: fromPath, to: toPath, type: r.type || '301' })
        }

        // Batch find: collect all "from" paths and check existing in bulk
        const BATCH_SIZE = 50
        for (let i = 0; i < validRedirects.length; i += BATCH_SIZE) {
          const batch = validRedirects.slice(i, i + BATCH_SIZE)
          const batchFromPaths = [...new Set(batch.map((r) => r.from))]

          // Single query to find all existing redirects with matching "from" paths
          let existingDocs: Array<Record<string, unknown>> = []
          try {
            const result = await req.payload.find({
              collection: redirectsCollection,
              where: { from: { in: batchFromPaths } },
              // A single `from` can already have several redirects, so
              // `batch.length * 2` could silently truncate the dedup set and
              // let this import create duplicates.
              pagination: false,
              depth: 0,
              overrideAccess: true,
            })
            existingDocs = result.docs as Array<Record<string, unknown>>
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            req.payload.logger.warn(`[seo] redirects import: dedup query failed — ${message}`)
            for (const r of batch) reportFailure(r.from, r.to, 'dedup query failed')
            continue
          }

          // Build a set of existing "from::to" pairs
          const existingPairs = new Set<string>()
          for (const doc of existingDocs) {
            const from = (doc.from as string) || ''
            const to = (doc.to as string) || ''
            existingPairs.add(`${from}::${to}`)
          }

          // Filter batch: skip existing, create new
          const toCreate = batch.filter((r) => {
            if (existingPairs.has(`${r.from}::${r.to}`)) {
              skipped++
              return false
            }
            return true
          })

          // Create SEQUENTIALLY. SQLite is single-writer: a `Promise.all` of 50
          // creates raises `SQLITE_BUSY` / "database is locked" on contended
          // hosts, and the client posts the whole CSV in one call. Same rule as
          // the CSV import in performance.ts.
          for (const r of toCreate) {
            try {
              await req.payload.create({
                collection: redirectsCollection,
                data: { from: r.from, to: r.to, type: r.type },
                overrideAccess: true,
              })
              created++
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              req.payload.logger.warn(
                `[seo] redirects import: create failed for ${r.from} → ${r.to} — ${message}`,
              )
              reportFailure(r.from, r.to, message)
            }
          }
        }

        return Response.json({
          success: true,
          created,
          skipped,
          errors,
          failed,
          failedTruncated: errors > failed.length,
        })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error'
      req.payload.logger.error(`[seo] redirects error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
