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

/** Check if the user has admin role */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  return false
}

export function createRedirectsHandler(redirectsCollection: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
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
        if (!isAdmin(req.user)) {
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

      // PATCH — Update a single redirect
      if (method === 'PATCH') {
        const patchBody = await parseJsonBody(req)
        const id = typeof patchBody.id === 'string' ? patchBody.id.trim() : undefined
        const from = typeof patchBody.from === 'string' ? patchBody.from.trim() : undefined
        const to = typeof patchBody.to === 'string' ? patchBody.to.trim() : undefined
        const type = typeof patchBody.type === 'string' ? patchBody.type.trim() : undefined

        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }

        const updateData: Record<string, unknown> = {}
        if (from !== undefined) updateData.from = from.startsWith('/') ? from : `/${from}`
        if (to !== undefined) updateData.to = to.startsWith('/') ? to : `/${to}`
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
        if (!isAdmin(req.user)) {
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

        // Pre-process: normalize paths, filter self-referencing
        const validRedirects: Array<{ from: string; to: string; type: string }> = []
        for (const r of redirects) {
          const fromPath = r.from.startsWith('/') ? r.from : `/${r.from}`
          const toPath = r.to.startsWith('/') ? r.to : `/${r.to}`
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
              limit: batch.length * 2,
              depth: 0,
              overrideAccess: true,
            })
            existingDocs = result.docs as Array<Record<string, unknown>>
          } catch {
            errors += batch.length
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

          // Create in parallel (batched)
          const createResults = await Promise.all(
            toCreate.map(async (r) => {
              try {
                await req.payload.create({
                  collection: redirectsCollection,
                  data: { from: r.from, to: r.to, type: r.type },
                  overrideAccess: true,
                })
                return true
              } catch {
                return false
              }
            }),
          )

          for (const success of createResults) {
            if (success) created++
            else errors++
          }
        }

        return Response.json({ success: true, created, skipped, errors })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error'
      req.payload.logger.error(`[seo] redirects error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
