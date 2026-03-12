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

export function createRedirectsHandler(redirectsCollection: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const method = req.method?.toUpperCase()

    try {
      // GET — List all redirects with pagination and search
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

      // DELETE — Single or bulk delete
      if (method === 'DELETE') {
        let deleteBody: Record<string, unknown> = {}
        try {
          deleteBody = (await req.json?.()) ?? {}
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
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
        let patchBody: Record<string, unknown> = {}
        try {
          patchBody = (await req.json?.()) ?? {}
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
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

      // POST — Bulk import
      if (method === 'POST') {
        let body: Record<string, unknown> = {}
        try {
          body = (await req.json?.()) ?? {}
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const redirects = body.redirects as Array<{ from: string; to: string; type?: string }> | undefined

        if (!redirects || !Array.isArray(redirects)) {
          return Response.json({ error: 'Missing redirects array' }, { status: 400 })
        }

        let created = 0
        let skipped = 0
        let errors = 0

        // Sequential to avoid SQLite busy
        for (const r of redirects) {
          try {
            const fromPath = r.from.startsWith('/') ? r.from : `/${r.from}`
            const toPath = r.to.startsWith('/') ? r.to : `/${r.to}`

            // Skip self-referencing redirects
            if (fromPath === toPath) {
              skipped++
              continue
            }

            // Check for existing duplicate
            const existing = await req.payload.find({
              collection: redirectsCollection,
              where: {
                and: [
                  { from: { equals: fromPath } },
                  { to: { equals: toPath } },
                ],
              },
              limit: 1,
              overrideAccess: true,
            })

            if (existing.docs.length > 0) {
              skipped++
              continue
            }

            await req.payload.create({
              collection: redirectsCollection,
              data: {
                from: fromPath,
                to: toPath,
                type: r.type || '301',
              },
              overrideAccess: true,
            })
            created++
          } catch {
            errors++
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
