import { describe, it, expect } from 'vitest'
import {
  computeCrawlDepth,
  computeUnderLinked,
  type EdgeLike,
  type NodeMetric,
} from '../endpoints/linkGraph'

// ---------------------------------------------------------------------------
// Synthetic graph
//
//   home ──> pillar ──> popular
//    │  └──> popular     └──> deep
//    │
//   pillar ──> deep
//
//   orphan-rich (3 outbound, 0 inbound)   — valuable but crawl-isolated
//   orphan-dead (0 outbound, 0 inbound)   — dead-end orphan
//
// inDegree/outDegree are set explicitly on nodes (that is what the scoring uses);
// edges are only consumed by the BFS crawl-depth computation.
// ---------------------------------------------------------------------------

function makeGraph(): { nodes: NodeMetric[]; edges: EdgeLike[] } {
  const nodes: NodeMetric[] = [
    { id: 'home', slug: 'home', inDegree: 1, outDegree: 4, isOrphan: false, title: 'Home', collection: 'pages', docId: 1 },
    { id: 'pillar', slug: 'pillar', inDegree: 1, outDegree: 5, isOrphan: false, title: 'Pillar', collection: 'pages', docId: 2 },
    { id: 'popular', slug: 'popular', inDegree: 5, outDegree: 1, isOrphan: false, title: 'Popular', collection: 'pages', docId: 3 },
    { id: 'deep', slug: 'deep', inDegree: 1, outDegree: 0, isOrphan: false, title: 'Deep', collection: 'pages', docId: 4 },
    { id: 'orphan-rich', slug: 'orphan-rich', inDegree: 0, outDegree: 3, isOrphan: true, title: 'Orphan Rich', collection: 'posts', docId: 5 },
    { id: 'orphan-dead', slug: 'orphan-dead', inDegree: 0, outDegree: 0, isOrphan: true, title: 'Orphan Dead', collection: 'posts', docId: 6 },
  ]
  const edges: EdgeLike[] = [
    { source: 'home', target: 'pillar' },
    { source: 'home', target: 'popular' },
    { source: 'pillar', target: 'popular' },
    { source: 'pillar', target: 'deep' },
  ]
  return { nodes, edges }
}

describe('computeCrawlDepth', () => {
  it('assigns BFS distance from home and leaves unreachable nodes absent', () => {
    const { nodes, edges } = makeGraph()
    const depth = computeCrawlDepth(
      nodes.map((n) => n.id),
      edges,
      ['home'],
    )

    expect(depth.get('home')).toBe(0)
    expect(depth.get('pillar')).toBe(1)
    expect(depth.get('popular')).toBe(1)
    expect(depth.get('deep')).toBe(2)
    // Orphans have no inbound edge -> never reached from home.
    expect(depth.has('orphan-rich')).toBe(false)
    expect(depth.has('orphan-dead')).toBe(false)
  })

  it('returns an empty map when there is no home root', () => {
    const { nodes, edges } = makeGraph()
    const depth = computeCrawlDepth(
      nodes.map((n) => n.id),
      edges,
      [],
    )
    expect(depth.size).toBe(0)
  })

  it('takes the shortest distance when several paths reach a node', () => {
    const nodeIds = ['home', 'a', 'b', 'c']
    const edges: EdgeLike[] = [
      { source: 'home', target: 'a' },
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'home', target: 'c' }, // short-circuit: c is reachable in 1 hop
    ]
    const depth = computeCrawlDepth(nodeIds, edges, ['home'])
    expect(depth.get('c')).toBe(1)
  })

  it('ignores edges pointing to unknown nodes without crashing', () => {
    const depth = computeCrawlDepth(
      ['home', 'a'],
      [
        { source: 'home', target: 'a' },
        { source: 'a', target: 'ghost' }, // ghost is not a known node
      ],
      ['home'],
    )
    expect(depth.get('a')).toBe(1)
    expect(depth.has('ghost')).toBe(false)
  })
})

describe('computeUnderLinked', () => {
  it('flags valuable low-inbound pages and orphans, excluding well-linked & home pages', () => {
    const { nodes, edges } = makeGraph()
    const result = computeUnderLinked(nodes, edges, { homeIds: ['home'], targetInDegree: 2 })

    const ids = result.items.map((i) => i.id)
    // pillar (rich, 1 inbound), orphan-rich and orphan-dead are surfaced.
    expect(ids).toContain('pillar')
    expect(ids).toContain('orphan-rich')
    expect(ids).toContain('orphan-dead')
    // popular is well-linked (inDegree 5 >= target) -> excluded.
    expect(ids).not.toContain('popular')
    // home is the crawl root -> never under-linked.
    expect(ids).not.toContain('home')
    // deep is linked (inDegree 1) but has no outbound value and is not an orphan.
    expect(ids).not.toContain('deep')
  })

  it('ranks the rich orphan above the dead-end orphan and the pillar', () => {
    const { nodes, edges } = makeGraph()
    const { items } = computeUnderLinked(nodes, edges, { homeIds: ['home'], targetInDegree: 2 })

    // maxOut = 5 (pillar). importance = outDegree / maxOut.
    // orphan-rich: importance 0.6, shortage 1   -> score 60
    // pillar:      importance 1.0, shortage 0.5 -> score 50
    // orphan-dead: importance 0,   floored      -> score 25
    expect(items.map((i) => i.id)).toEqual(['orphan-rich', 'pillar', 'orphan-dead'])
    expect(items[0].underLinkedScore).toBe(60)
    expect(items[1].underLinkedScore).toBe(50)
    expect(items[2].underLinkedScore).toBe(25)
  })

  it('summarizes orphans, suggestions and crawl depth', () => {
    const { nodes, edges } = makeGraph()
    const { summary } = computeUnderLinked(nodes, edges, { homeIds: ['home'], targetInDegree: 2 })

    expect(summary.targetInDegree).toBe(2)
    expect(summary.orphanCount).toBe(2)
    expect(summary.underLinkedCount).toBe(3)
    // suggested inbound links to reach target=2: pillar(1) + orphan-rich(2) + orphan-dead(2) = 5
    expect(summary.suggestedLinkCount).toBe(5)
    // reachable depths: home 0, pillar 1, popular 1, deep 2
    expect(summary.maxDepth).toBe(2)
    expect(summary.avgDepth).toBe(1)
    // the two orphans are unreachable from home
    expect(summary.unreachableCount).toBe(2)
  })

  it('attaches crawl depth (or null when unreachable) to each item', () => {
    const { nodes, edges } = makeGraph()
    const { items } = computeUnderLinked(nodes, edges, { homeIds: ['home'], targetInDegree: 2 })
    const byId = new Map(items.map((i) => [i.id, i]))

    expect(byId.get('pillar')!.depthFromHome).toBe(1)
    expect(byId.get('orphan-rich')!.depthFromHome).toBeNull()
    expect(byId.get('orphan-rich')!.suggestedInboundLinks).toBe(2)
  })

  it('respects the topN cap', () => {
    const { nodes, edges } = makeGraph()
    const { items, summary } = computeUnderLinked(nodes, edges, {
      homeIds: ['home'],
      targetInDegree: 2,
      topN: 1,
    })
    // Only the highest-scoring page is returned, but the count reflects all of them.
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('orphan-rich')
    expect(summary.underLinkedCount).toBe(3)
  })

  it('derives a sane default target and auto-detects home from slugs', () => {
    const { nodes, edges } = makeGraph()
    // No homeIds / targetInDegree passed: home detected via slug, target from avg inDegree.
    const { summary, items } = computeUnderLinked(nodes, edges)

    // avg inDegree = (1+1+5+1+0+0)/6 = 1.33 -> ceil 2 -> max(2, 2) = 2
    expect(summary.targetInDegree).toBe(2)
    // home auto-detected and excluded from under-linked candidates.
    expect(items.map((i) => i.id)).not.toContain('home')
  })

  it('handles an empty graph without throwing', () => {
    const result = computeUnderLinked([], [])
    expect(result.items).toEqual([])
    expect(result.summary.orphanCount).toBe(0)
    expect(result.summary.underLinkedCount).toBe(0)
    expect(result.summary.maxDepth).toBeNull()
    expect(result.summary.avgDepth).toBeNull()
    expect(result.summary.unreachableCount).toBe(0)
  })
})
