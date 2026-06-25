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
import { extractAllInternalLinks, normalizeToSlug, resolveToDocSlug } from '../helpers/linkExtractor.js'
import { fetchAllDocs } from '../helpers/fetchAllDocs.js'

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
  // Crawl distance from the home page (BFS over internal edges). null = unreachable
  // from home (crawl-isolated). Optional/additive: existing consumers can ignore it.
  depth?: number | null
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
// Crawl budget / internal linking — pure, Payload-independent helpers
// ---------------------------------------------------------------------------
//
// SEO-2026 rationale: internal linking drives crawl coverage. On large sites a
// stronger internal mesh can recover ~30 points of crawl coverage. High-value
// pages must receive proportionally more internal links, and pages that sit deep
// in (or are isolated from) the crawl graph waste crawl budget. These helpers
// surface "under-linked but valuable" pages and the crawl depth from home.

/** Minimal node shape these helpers need. GraphNode is structurally compatible. */
export interface NodeMetric {
  id: string
  slug: string
  inDegree: number
  outDegree: number
  isOrphan: boolean
  title?: string
  collection?: string
  docId?: number | string
}

/** Minimal edge shape (source/target are node ids in the same space as nodes). */
export interface EdgeLike {
  source: string
  target: string
}

export interface UnderLinkedItem {
  id: string
  slug: string
  title: string
  collection: string
  docId: number | string
  inDegree: number
  outDegree: number
  /** Normalized 0..1 proxy for page value (relative outbound link richness). */
  importance: number
  /** 0..100, higher = more under-linked (valuable but few inbound internal links). */
  underLinkedScore: number
  /** How many inbound internal links could be added to reach the target. */
  suggestedInboundLinks: number
  isOrphan: boolean
  /** Crawl distance from home, or null if unreachable from home. */
  depthFromHome: number | null
}

export interface CrawlBudgetSummary {
  /** Inbound-link target used as the "healthy" baseline. */
  targetInDegree: number
  /** Pages with zero internal inbound links (excluding home). */
  orphanCount: number
  /** Pages flagged as under-linked (valuable but below the inbound target). */
  underLinkedCount: number
  /** Total inbound internal links that could be added across under-linked pages. */
  suggestedLinkCount: number
  /** Deepest crawl distance reached from home, or null if no home/edges. */
  maxDepth: number | null
  /** Average crawl distance over reachable pages, or null. */
  avgDepth: number | null
  /** Pages not reachable from home by following internal links. */
  unreachableCount: number
}

export interface UnderLinkedResult {
  items: UnderLinkedItem[]
  summary: CrawlBudgetSummary
  /** Crawl depth from home per node id (BFS). Absent key = unreachable. */
  depthById: Map<string, number>
}

export interface UnderLinkedOptions {
  /** Max number of under-linked pages to return (default 20). */
  topN?: number
  /** Override the inbound-link target; defaults to max(2, ceil(avg inDegree)). */
  targetInDegree?: number
  /** Node ids considered as crawl roots; defaults to detected home slugs. */
  homeIds?: string[]
}

const HOME_SLUGS = new Set(['home', '', 'accueil'])
// Orphans are the worst crawl-budget case: guarantee they always surface even
// when they have no outbound links (otherwise importance, hence score, is 0).
const ORPHAN_SCORE_FLOOR = 0.25

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function defaultHomeIds(nodes: NodeMetric[]): string[] {
  return nodes.filter((n) => HOME_SLUGS.has(n.slug) || n.id === 'home').map((n) => n.id)
}

/**
 * Breadth-first crawl distance from one or more home roots, following internal
 * edges (source -> target). Linear in nodes + edges (index-based queue, no shift).
 * Nodes unreachable from any home are simply absent from the returned map.
 */
export function computeCrawlDepth(
  nodeIds: string[],
  edges: EdgeLike[],
  homeIds: string[],
): Map<string, number> {
  const adjacency = new Map<string, string[]>()
  for (const id of nodeIds) adjacency.set(id, [])
  for (const e of edges) {
    const bucket = adjacency.get(e.source)
    if (bucket) bucket.push(e.target)
  }

  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const h of homeIds) {
    if (adjacency.has(h) && !depth.has(h)) {
      depth.set(h, 0)
      queue.push(h)
    }
  }

  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    const d = depth.get(cur)!
    for (const next of adjacency.get(cur) || []) {
      if (adjacency.has(next) && !depth.has(next)) {
        depth.set(next, d + 1)
        queue.push(next)
      }
    }
  }
  return depth
}

/**
 * Identify under-linked high-value pages and summarize crawl budget.
 *
 * Heuristic (no content-length signal is available on graph nodes, so we use
 * relative outbound link richness as the importance proxy):
 *   importance       = outDegree / maxOutDegree            (0..1)
 *   inboundShortage  = clamp01((target - inDegree) / target)  (1 when inDegree=0)
 *   score            = importance * inboundShortage         (orphans floored)
 * A page is "under-linked" when its inDegree is below the target AND it carries
 * some value (importance > 0) or is an orphan. Everything is O(V + E).
 */
export function computeUnderLinked(
  nodes: NodeMetric[],
  edges: EdgeLike[],
  opts: UnderLinkedOptions = {},
): UnderLinkedResult {
  const topN = opts.topN ?? 20
  const homeIds = opts.homeIds ?? defaultHomeIds(nodes)

  // Healthy inbound-link baseline: explicit override, else derived from the
  // average inbound degree, floored at 2 so tiny sites stay meaningful.
  const totalIn = nodes.reduce((s, n) => s + n.inDegree, 0)
  const avgIn = nodes.length > 0 ? totalIn / nodes.length : 0
  const target = Math.max(2, opts.targetInDegree ?? Math.ceil(avgIn))

  const maxOut = nodes.reduce((m, n) => Math.max(m, n.outDegree), 0)
  const homeSet = new Set(homeIds)
  const depth = computeCrawlDepth(
    nodes.map((n) => n.id),
    edges,
    homeIds,
  )

  const items: UnderLinkedItem[] = []
  for (const n of nodes) {
    // Home is the crawl root: it doesn't need inbound internal links to be crawled.
    const isUnderLinked =
      !homeSet.has(n.id) && n.inDegree < target && (n.outDegree > 0 || n.isOrphan)
    if (!isUnderLinked) continue

    const importance = maxOut > 0 ? n.outDegree / maxOut : 0
    const inboundShortage = clamp01((target - n.inDegree) / target)
    let score = importance * inboundShortage
    if (n.isOrphan) score = Math.max(score, ORPHAN_SCORE_FLOOR)

    items.push({
      id: n.id,
      slug: n.slug,
      title: n.title ?? '',
      collection: n.collection ?? '',
      docId: n.docId ?? n.id,
      inDegree: n.inDegree,
      outDegree: n.outDegree,
      importance: Math.round(importance * 100) / 100,
      underLinkedScore: Math.round(score * 100),
      suggestedInboundLinks: Math.max(0, target - n.inDegree),
      isOrphan: n.isOrphan,
      depthFromHome: depth.has(n.id) ? depth.get(n.id)! : null,
    })
  }

  // Highest score first; break ties by richer pages (more outbound links).
  items.sort(
    (a, b) => b.underLinkedScore - a.underLinkedScore || b.outDegree - a.outDegree,
  )

  const underLinkedCount = items.length
  const suggestedLinkCount = items.reduce((s, it) => s + it.suggestedInboundLinks, 0)
  const orphanCount = nodes.filter((n) => n.isOrphan).length

  const depths: number[] = []
  for (const n of nodes) {
    const d = depth.get(n.id)
    if (typeof d === 'number') depths.push(d)
  }
  const maxDepth = depths.length ? Math.max(...depths) : null
  const avgDepth = depths.length
    ? Math.round((depths.reduce((s, d) => s + d, 0) / depths.length) * 10) / 10
    : null
  const unreachableCount = nodes.filter((n) => !depth.has(n.id)).length

  return {
    items: items.slice(0, topN),
    summary: {
      targetInDegree: target,
      orphanCount,
      underLinkedCount,
      suggestedLinkCount,
      maxDepth,
      avgDepth,
      unreachableCount,
    },
    depthById: depth,
  }
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export function createLinkGraphHandler(targetCollections: string[], globals: string[] = []): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const noCache = url.searchParams.get('nocache') === '1'

      // Locale-scoped: content differs per locale, so cache must not collide across locales.
      const reqLocale = typeof req.locale === 'string' && req.locale ? req.locale : undefined
      const CACHE_KEY = reqLocale ? `link-graph:${reqLocale}` : 'link-graph'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cached = noCache ? null : seoCache.get<any>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
      }

      // 1. Fetch all documents from target collections and globals
      const slugMap = new Map<
        string,
        { id: number | string; title: string; slug: string; collection: string }
      >()

      // Map of slug -> outgoing internal links
      const outgoingMap = new Map<string, Array<{ slug: string; text: string }>>()

      const allFetched = await fetchAllDocs(req.payload, {
        collections: targetCollections,
        globals,
        depth: 1,
      })

      let processed = 0
      for (const { doc, sourceType, sourceSlug } of allFetched) {
        // Yield to the event loop periodically so Lexical extraction over many
        // docs doesn't block other requests for the whole build.
        if (processed > 0 && processed % 50 === 0) {
          await new Promise<void>((resolve) => setImmediate(resolve))
        }
        processed++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = doc as any

        const isGlobal = sourceType === 'global'
        const nodeId = isGlobal ? `global:${sourceSlug}` : ((d.slug as string) || '')
        const title = (d.title as string) || (isGlobal ? sourceSlug : '')
        const collectionLabel = isGlobal ? `global:${sourceSlug}` : sourceSlug

        slugMap.set(nodeId, {
          id: isGlobal ? sourceSlug : d.id,
          title,
          slug: nodeId,
          collection: collectionLabel,
        })

        // Extract internal links and deduplicate by target slug
        const internalLinks = extractAllInternalLinks(d)
        const seen = new Set<string>()
        const dedupedLinks: Array<{ slug: string; text: string }> = []
        for (const link of internalLinks) {
          if (!seen.has(link.slug)) {
            seen.add(link.slug)
            dedupedLinks.push({ slug: link.slug, text: link.text })
          }
        }
        outgoingMap.set(nodeId, dedupedLinks)
      }

      // 1b. Resolve collection-prefixed links (e.g. `posts/<slug>`) to their canonical
      // bare doc slug so posts linked via their public route (`/posts/<slug>`) count as
      // valid edges and their targets are not mis-flagged as orphans. Route prefixes =
      // target collection slugs + global route segments.
      const knownSlugs = new Set(slugMap.keys())
      const routePrefixes = new Set(
        [...targetCollections, ...globals].map((s) => s.toLowerCase().replace(/^\/+|\/+$/g, '')),
      )
      for (const links of outgoingMap.values()) {
        for (const link of links) {
          link.slug = resolveToDocSlug(link.slug, knownSlugs, routePrefixes)
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

      // 5. Crawl budget / internal linking analysis (additive, retro-compatible).
      // GraphNode is structurally a NodeMetric, so nodes/edges feed in directly.
      const homeIds = nodes.filter((n) => homeSlugs.has(n.slug)).map((n) => n.id)
      const crawl = computeUnderLinked(nodes, edges, { topN: 20, homeIds })

      // Annotate each node with its crawl depth from home (optional field) so the
      // graph view can colour/group by crawl distance without a second pass.
      for (const node of nodes) {
        const d = crawl.depthById.get(node.id)
        node.depth = typeof d === 'number' ? d : null
      }

      const responseData = {
        nodes,
        edges,
        stats,
        crawlBudget: crawl.summary,
        underLinked: crawl.items,
      }
      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] link-graph error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
