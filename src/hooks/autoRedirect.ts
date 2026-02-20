/**
 * Auto-redirect hook.
 * Creates a 301 redirect entry when a document's slug changes.
 * Runs as a beforeChange hook — non-blocking on failure.
 */

import type { CollectionBeforeChangeHook } from 'payload'

export function createAutoRedirectHook(redirectsCollection: string): CollectionBeforeChangeHook {
  return async ({ data, originalDoc, req, operation }) => {
    // Only on update (not create)
    if (operation !== 'update' || !originalDoc) return data

    const oldSlug = originalDoc.slug as string | undefined
    const newSlug = data.slug as string | undefined

    // If slug changed, create a 301 redirect
    if (oldSlug && newSlug && oldSlug !== newSlug) {
      try {
        // Check if an identical redirect already exists (avoid duplicates)
        const fromPath = oldSlug.startsWith('/') ? oldSlug : `/${oldSlug}`
        const toPath = newSlug.startsWith('/') ? newSlug : `/${newSlug}`

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

        if (existing.docs.length === 0) {
          // Detect potential redirect loops before creating
          try {
            // Check if the new destination (newSlug) itself redirects somewhere
            const destinationRedirects = await req.payload.find({
              collection: redirectsCollection,
              where: { from: { equals: toPath } },
              limit: 1,
              overrideAccess: true,
            })
            if (destinationRedirects.docs.length > 0) {
              console.warn(`[seo-plugin] Auto-redirect: potential chain detected — ${toPath} already redirects somewhere`)
            }

            // Check if something already redirects TO the old slug (would create a chain)
            const incomingRedirects = await req.payload.find({
              collection: redirectsCollection,
              where: { to: { equals: fromPath } },
              limit: 1,
              overrideAccess: true,
            })
            if (incomingRedirects.docs.length > 0) {
              console.warn(`[seo-plugin] Auto-redirect: potential chain detected — something already redirects to ${fromPath}`)
            }
          } catch {
            // Non-blocking loop detection — proceed with creation
          }

          await req.payload.create({
            collection: redirectsCollection,
            data: {
              from: fromPath,
              to: toPath,
              type: '301',
            },
            overrideAccess: true,
          })
          console.log(`[seo-plugin] Auto-redirect: ${fromPath} → ${toPath}`)
        } else {
          console.log(`[seo-plugin] Auto-redirect skipped (already exists): ${fromPath} → ${toPath}`)
        }
      } catch (err) {
        // Non-blocking — log but don't prevent save
        console.error('[seo-plugin] Auto-redirect failed:', err)
      }
    }

    return data
  }
}
