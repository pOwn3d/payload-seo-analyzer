/**
 * Link Graph endpoint handler.
 * Returns the internal link graph data (nodes + edges) for visualization.
 * Reuses the same Lexical link extraction logic as sitemap-audit.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'
import { extractAllInternalLinks, normalizeToSlug } from '../helpers/linkExtractor.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string // slug (used as graph node ID)
  docId: number | string // Payload document ID (for admin links)
  title: string
  collection: string
  slug: string
  inDegree: number
  outDegree: number
  isOrphan: boolean
  isHub: boolean
}

interface GraphEdge {
  source: string // source slug
  target: string // target slug
  anchorText?: string
}

interface GraphStats {
  totalNodes: number
  totalEdges: number
  orphanCount: number
  hubCount: number
  avgDegree: number
}

// ---------------------------------------------------------------------------
// Hub threshold
// ---------------------------------------------------------------------------

const HUB_THRESHOLD = 10

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export function createLinkGraphHandler(targetCollections: string[]): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'

      const CACHE_KEY = 'link-graph'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
      }

      // 1. Fetch all documents from target collections
      const slugMap = new Map<
        string,
        { id: number | string; title: string; slug: string; collection: string }
      >()

      // Map of slug -> outgoing internal links
      const outgoingMap = new Map<string, Array<{ slug: string; text: string }>>()

      for (const collectionSlug of targetCollections) {
        try {
          const result = await req.payload.find({
            collection: collectionSlug,
            limit: 500,
            depth: 1,
            overrideAccess: true,
          })

          for (const doc of result.docs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = doc as any
            const slug = (d.slug as string) || ''
            const title = (d.title as string) || ''

            slugMap.set(slug, {
              id: d.id,
              title,
              slug,
              collection: collectionSlug,
            })

            // Extract internal links
            const internalLinks = extractAllInternalLinks(d)

            // Deduplicate by target slug (keep first anchor text per target)
            const seen = new Set<string>()
            const dedupedLinks: Array<{ slug: string; text: string }> = []
            for (const link of internalLinks) {
              if (!seen.has(link.slug)) {
                seen.add(link.slug)
                dedupedLinks.push({ slug: link.slug, text: link.text })
              }
            }

            outgoingMap.set(slug, dedupedLinks)
          }
        } catch {
          // Collection might not exist — skip silently
        }
      }

      // 2. Build incoming links map
      const incomingMap = new Map<string, string[]>()
      for (const [sourceSlug, links] of outgoingMap.entries()) {
        for (const link of links) {
          if (!incomingMap.has(link.slug)) {
            incomingMap.set(link.slug, [])
          }
          incomingMap.get(link.slug)!.push(sourceSlug)
        }
      }

      // 3. Build nodes and edges
      const homeSlugs = new Set(['home', '', 'accueil'])
      const allSlugs = new Set(slugMap.keys())
      const nodes: GraphNode[] = []
      const edges: GraphEdge[] = []

      for (const [slug, docInfo] of slugMap.entries()) {
        const outgoing = outgoingMap.get(slug) || []
        // Only count outgoing links to existing pages
        const validOutgoing = outgoing.filter((l) => allSlugs.has(l.slug))

        const incoming = incomingMap.get(slug) || []
        // Only count incoming from existing pages
        const validIncoming = incoming.filter((s) => allSlugs.has(s))

        const inDegree = validIncoming.length
        const outDegree = validOutgoing.length

        nodes.push({
          id: slug || 'home',
          docId: docInfo.id,
          title: docInfo.title,
          collection: docInfo.collection,
          slug,
          inDegree,
          outDegree,
          isOrphan: !homeSlugs.has(slug) && inDegree === 0,
          isHub: outDegree > HUB_THRESHOLD,
        })

        // Build edges (only to existing pages, avoid self-links)
        for (const link of validOutgoing) {
          if (link.slug !== slug) {
            edges.push({
              source: slug || 'home',
              target: link.slug || 'home',
              anchorText: link.text || undefined,
            })
          }
        }
      }

      // 4. Compute stats
      const orphanCount = nodes.filter((n) => n.isOrphan).length
      const hubCount = nodes.filter((n) => n.isHub).length
      const totalDegree = nodes.reduce((sum, n) => sum + n.inDegree + n.outDegree, 0)
      const avgDegree =
        nodes.length > 0 ? Math.round((totalDegree / nodes.length) * 10) / 10 : 0

      const stats: GraphStats = {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        orphanCount,
        hubCount,
        avgDegree,
      }

      const responseData = { nodes, edges, stats }
      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('[seo-plugin/link-graph] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
