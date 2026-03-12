/**
 * Redirect Chain Detection endpoint.
 * Reads all redirects from the seo-redirects collection, builds a graph,
 * and detects chains (A→B→C) and loops (A→B→A).
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware.
 */

import type { PayloadHandler } from 'payload'
import { seoCache } from '../cache.js'

interface RedirectChainResult {
  chain: string[]
  isLoop: boolean
  length: number
}

export function createRedirectChainsHandler(redirectsCollection: string): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url || '', 'http://localhost')
      const noCache = url.searchParams.get('nocache') === '1'
      const CACHE_KEY = 'redirect-chains'
      const cached = noCache ? null : seoCache.get<unknown>(CACHE_KEY)
      if (cached) {
        return Response.json({ ...(cached as Record<string, unknown>), cached: true })
      }

      // Fetch all redirects
      let allRedirects: Array<{ from: string; to: string }> = []
      try {
        const result = await req.payload.find({
          collection: redirectsCollection,
          limit: 1000,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        })

        for (const doc of result.docs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = doc as any
          if (d.from && d.to) {
            allRedirects.push({ from: d.from, to: d.to })
          }
        }
      } catch {
        // Collection might not exist
        return Response.json({ chains: [], stats: { total: 0, loops: 0, chains: 0 } })
      }

      // Build adjacency map: source → target
      const graph = new Map<string, string>()
      for (const r of allRedirects) {
        graph.set(r.from, r.to)
      }

      // Detect chains and loops
      const chains: RedirectChainResult[] = []
      const visited = new Set<string>()

      for (const startUrl of graph.keys()) {
        if (visited.has(startUrl)) continue

        // Walk the chain from this starting URL
        const chain: string[] = [startUrl]
        const chainSet = new Set<string>([startUrl])
        let current = startUrl
        let isLoop = false

        while (graph.has(current)) {
          const next = graph.get(current)!
          chain.push(next)

          // Loop detected: the target is already in the current chain
          if (chainSet.has(next)) {
            isLoop = true
            break
          }

          chainSet.add(next)
          current = next
        }

        // Mark all nodes in this chain as visited
        for (const url of chainSet) {
          visited.add(url)
        }

        // Only report chains with length > 2 (A→B→C or longer) or loops
        if (chain.length > 2 || isLoop) {
          chains.push({
            chain,
            isLoop,
            length: chain.length - 1, // Number of hops
          })
        }
      }

      // Sort: loops first, then by chain length (longest first)
      chains.sort((a, b) => {
        if (a.isLoop !== b.isLoop) return a.isLoop ? -1 : 1
        return b.length - a.length
      })

      const responseData = {
        chains,
        stats: {
          total: chains.length,
          loops: chains.filter((c) => c.isLoop).length,
          chains: chains.filter((c) => !c.isLoop).length,
          totalRedirects: allRedirects.length,
        },
      }

      seoCache.set(CACHE_KEY, responseData)
      return Response.json({ ...responseData, cached: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] redirect-chains error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
