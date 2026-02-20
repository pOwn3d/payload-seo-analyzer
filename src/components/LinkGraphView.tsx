'use client'

/**
 * LinkGraphView — Interactive SVG-based internal link graph visualization.
 * Uses a force-directed layout (spring simulation) computed on mount.
 * No external dependencies (no D3.js, no vis.js).
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { getTranslations } from '../i18n.js'

// ---------------------------------------------------------------------------
// Design tokens — uses Payload CSS variables for theme compatibility
// ---------------------------------------------------------------------------

const V = {
  text: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  bg: 'var(--theme-elevation-0, #fff)',
  bgCard: 'var(--theme-elevation-50, #f9fafb)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  blue: '#3b82f6',
  cyan: '#06b6d4',
}

// ---------------------------------------------------------------------------
// Collection color map
// ---------------------------------------------------------------------------

const COLLECTION_COLORS: Record<string, string> = {
  pages: V.blue,
  posts: V.green,
  products: V.orange,
}

function getCollectionColor(collection: string): string {
  return COLLECTION_COLORS[collection] || '#9ca3af'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string
  docId: number | string
  title: string
  collection: string
  slug: string
  inDegree: number
  outDegree: number
  isOrphan: boolean
  isHub: boolean
}

interface GraphEdge {
  source: string
  target: string
  anchorText?: string
}

interface GraphStats {
  totalNodes: number
  totalEdges: number
  orphanCount: number
  hubCount: number
  avgDegree: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: GraphStats
}

// Internal positioned node for simulation
interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

// ---------------------------------------------------------------------------
// Force simulation parameters
// ---------------------------------------------------------------------------

const SIM_ITERATIONS = 120
const REPULSION_STRENGTH = 5000
const ATTRACTION_STRENGTH = 0.008
const CENTER_GRAVITY = 0.01
const DAMPING = 0.92
const MIN_DISTANCE = 40

// Node sizing
const NODE_MIN_RADIUS = 5
const NODE_MAX_RADIUS = 20

// ---------------------------------------------------------------------------
// Force simulation — runs once on mount, positions nodes, then stops
// ---------------------------------------------------------------------------

function runForceSimulation(
  rawNodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): SimNode[] {
  const cx = width / 2
  const cy = height / 2

  // Initialize node positions in a circle
  const nodes: SimNode[] = rawNodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / rawNodes.length
    const radius = Math.min(width, height) * 0.35
    return {
      ...n,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    }
  })

  if (nodes.length === 0) return nodes

  // Build adjacency index for quick lookup
  const nodeIndex = new Map<string, number>()
  for (let i = 0; i < nodes.length; i++) {
    nodeIndex.set(nodes[i].id, i)
  }

  // Run simulation iterations
  for (let iter = 0; iter < SIM_ITERATIONS; iter++) {
    // Reduce temperature over time
    const alpha = 1 - iter / SIM_ITERATIONS

    // 1. Repulsion between all nodes (Coulomb's law)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x
        let dy = nodes[j].y - nodes[i].y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MIN_DISTANCE) dist = MIN_DISTANCE

        const force = (REPULSION_STRENGTH * alpha) / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        nodes[i].vx -= fx
        nodes[i].vy -= fy
        nodes[j].vx += fx
        nodes[j].vy += fy
      }
    }

    // 2. Attraction along edges (Hooke's law)
    for (const edge of edges) {
      const si = nodeIndex.get(edge.source)
      const ti = nodeIndex.get(edge.target)
      if (si === undefined || ti === undefined) continue

      const dx = nodes[ti].x - nodes[si].x
      const dy = nodes[ti].y - nodes[si].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1

      const force = ATTRACTION_STRENGTH * dist * alpha
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      nodes[si].vx += fx
      nodes[si].vy += fy
      nodes[ti].vx -= fx
      nodes[ti].vy -= fy
    }

    // 3. Center gravity
    for (const node of nodes) {
      node.vx += (cx - node.x) * CENTER_GRAVITY * alpha
      node.vy += (cy - node.y) * CENTER_GRAVITY * alpha
    }

    // 4. Apply velocities with damping
    for (const node of nodes) {
      node.vx *= DAMPING
      node.vy *= DAMPING
      node.x += node.vx
      node.y += node.vy

      // Keep within bounds (with padding)
      const padding = 30
      node.x = Math.max(padding, Math.min(width - padding, node.x))
      node.y = Math.max(padding, Math.min(height - padding, node.y))
    }
  }

  return nodes
}

// ---------------------------------------------------------------------------
// Compute node radius based on degree
// ---------------------------------------------------------------------------

function getNodeRadius(node: GraphNode, maxDegree: number): number {
  if (maxDegree === 0) return NODE_MIN_RADIUS
  const totalDegree = node.inDegree + node.outDegree
  const ratio = totalDegree / maxDegree
  return NODE_MIN_RADIUS + (NODE_MAX_RADIUS - NODE_MIN_RADIUS) * ratio
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LinkGraphView() {
  const T = getTranslations('fr')

  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(false)
  const [filterCollection, setFilterCollection] = useState<string>('all')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltipNode, setTooltipNode] = useState<SimNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Pan & zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Simulation results
  const [simNodes, setSimNodes] = useState<SimNode[]>([])

  // ---------------------------------------------------------------------------
  // Fetch graph data
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/link-graph', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: GraphData = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : T.common.error)
    } finally {
      setLoading(false)
    }
  }, [T.common.error])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Run simulation when data changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      setSimNodes([])
      return
    }

    const width = 1200
    const height = 800
    const positioned = runForceSimulation(data.nodes, data.edges, width, height)
    setSimNodes(positioned)
  }, [data])

  // ---------------------------------------------------------------------------
  // Derived data: filtered nodes, edges, collections
  // ---------------------------------------------------------------------------

  const collections = useMemo(() => {
    if (!data) return []
    const set = new Set(data.nodes.map((n) => n.collection))
    return Array.from(set).sort()
  }, [data])

  const filteredNodeIds = useMemo(() => {
    if (filterCollection === 'all') return new Set(simNodes.map((n) => n.id))
    return new Set(simNodes.filter((n) => n.collection === filterCollection).map((n) => n.id))
  }, [simNodes, filterCollection])

  const visibleNodes = useMemo(() => {
    return simNodes.filter((n) => filteredNodeIds.has(n.id))
  }, [simNodes, filteredNodeIds])

  const visibleEdges = useMemo(() => {
    if (!data) return []
    return data.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    )
  }, [data, filteredNodeIds])

  const maxDegree = useMemo(() => {
    return simNodes.reduce((max, n) => Math.max(max, n.inDegree + n.outDegree), 0)
  }, [simNodes])

  // Node index for edge rendering
  const nodeMap = useMemo(() => {
    const map = new Map<string, SimNode>()
    for (const n of simNodes) {
      map.set(n.id, n)
    }
    return map
  }, [simNodes])

  // Connected edges for hover highlight
  const connectedEdges = useMemo(() => {
    if (!hoveredNode || !data) return new Set<number>()
    const set = new Set<number>()
    data.edges.forEach((e, i) => {
      if (e.source === hoveredNode || e.target === hoveredNode) {
        set.add(i)
      }
    })
    return set
  }, [hoveredNode, data])

  const connectedNodes = useMemo(() => {
    if (!hoveredNode || !data) return new Set<string>()
    const set = new Set<string>()
    set.add(hoveredNode)
    for (const e of data.edges) {
      if (e.source === hoveredNode) set.add(e.target)
      if (e.target === hoveredNode) set.add(e.source)
    }
    return set
  }, [hoveredNode, data])

  // ---------------------------------------------------------------------------
  // Zoom & pan handlers
  // ---------------------------------------------------------------------------

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.1, Math.min(5, transform.scale * delta))

      // Zoom toward mouse position
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const newX = mx - ((mx - transform.x) / transform.scale) * newScale
        const newY = my - ((my - transform.y) / transform.scale) * newScale
        setTransform({ x: newX, y: newY, scale: newScale })
      } else {
        setTransform((prev) => ({ ...prev, scale: newScale }))
      }
    },
    [transform],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan with left click on SVG background
      if (e.button !== 0) return
      if ((e.target as Element).tagName !== 'svg' && (e.target as Element).tagName !== 'rect') return
      setIsPanning(true)
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    },
    [transform],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }))
    },
    [isPanning, panStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Control actions
  // ---------------------------------------------------------------------------

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(5, prev.scale * 1.2) }))
  }, [])

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale * 0.8) }))
  }, [])

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  // ---------------------------------------------------------------------------
  // Node interaction
  // ---------------------------------------------------------------------------

  const handleNodeHover = useCallback(
    (node: SimNode, e: React.MouseEvent) => {
      setHoveredNode(node.id)
      setTooltipNode(node)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 })
      }
    },
    [],
  )

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null)
    setTooltipNode(null)
  }, [])

  const handleNodeClick = useCallback((node: SimNode) => {
    // Open the edit page using the Payload document ID
    window.open(`/admin/collections/${node.collection}/${node.docId}`, '_blank')
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // SVG canvas dimensions
  const SVG_WIDTH = 1200
  const SVG_HEIGHT = 800

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: V.textSecondary }}>
        <div style={{ fontSize: 14 }}>{T.common.loading}</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: V.red, marginBottom: 12 }}>{T.common.error}: {error}</div>
        <button
          onClick={fetchData}
          style={{
            padding: '8px 16px',
            background: V.blue,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {T.common.refresh}
        </button>
      </div>
    )
  }

  // No data
  if (!data || data.nodes.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: V.textSecondary }}>
        {T.common.noResults}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: V.text }}>
          {T.linkGraph.title}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: V.textSecondary }}>
          {T.linkGraph.subtitle}
        </p>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: T.linkGraph.nodes, value: data.stats.totalNodes, color: V.blue },
          { label: T.linkGraph.edges, value: data.stats.totalEdges, color: V.cyan },
          { label: T.linkGraph.orphanNodes, value: data.stats.orphanCount, color: V.red },
          { label: T.linkGraph.hubNodes, value: data.stats.hubCount, color: V.orange },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: V.bgCard,
              border: `1px solid ${V.border}`,
              borderRadius: 8,
              padding: '10px 18px',
              minWidth: 120,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 12, color: V.textSecondary }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Controls bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Zoom controls */}
        <button
          onClick={zoomIn}
          title={T.linkGraph.zoomIn}
          style={controlBtnStyle}
        >
          +
        </button>
        <button
          onClick={zoomOut}
          title={T.linkGraph.zoomOut}
          style={controlBtnStyle}
        >
          -
        </button>
        <button
          onClick={resetView}
          title={T.linkGraph.resetView}
          style={controlBtnStyle}
        >
          {T.linkGraph.resetView}
        </button>

        <div style={{ width: 1, height: 24, background: V.border, margin: '0 4px' }} />

        {/* Labels toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            color: V.text,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          {showLabels ? T.linkGraph.hideLabels : T.linkGraph.showLabels}
        </label>

        <div style={{ width: 1, height: 24, background: V.border, margin: '0 4px' }} />

        {/* Collection filter */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: V.text,
          }}
        >
          {T.linkGraph.filterByCollection}:
          <select
            value={filterCollection}
            onChange={(e) => setFilterCollection(e.target.value)}
            style={{
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 4,
              border: `1px solid ${V.border}`,
              background: V.bg,
              color: V.text,
            }}
          >
            <option value="all">{T.linkGraph.all}</option>
            {collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {collections.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: getCollectionColor(c),
                }}
              />
              <span style={{ color: V.textSecondary }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          border: `1px solid ${V.border}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: V.bg,
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          style={{ cursor: isPanning ? 'grabbing' : 'grab', display: 'block' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background rect for pan detection */}
          <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} fill="transparent" />

          {/* Transform group (pan + zoom) */}
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {visibleEdges.map((edge, i) => {
              const sourceNode = nodeMap.get(edge.source)
              const targetNode = nodeMap.get(edge.target)
              if (!sourceNode || !targetNode) return null

              const isHighlighted =
                hoveredNode !== null && connectedEdges.has(data!.edges.indexOf(edge))
              const isDimmed = hoveredNode !== null && !isHighlighted

              return (
                <line
                  key={`e-${i}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isHighlighted ? V.cyan : '#d1d5db'}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  strokeOpacity={isDimmed ? 0.1 : isHighlighted ? 0.9 : 0.3}
                />
              )
            })}

            {/* Nodes */}
            {visibleNodes.map((node) => {
              const radius = getNodeRadius(node, maxDegree)
              const color = getCollectionColor(node.collection)
              const isHovered = hoveredNode === node.id
              const isConnected = connectedNodes.has(node.id)
              const isDimmed = hoveredNode !== null && !isConnected

              return (
                <g key={`n-${node.id}`}>
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered ? radius + 3 : radius}
                    fill={node.isOrphan ? V.red : color}
                    fillOpacity={isDimmed ? 0.15 : isHovered ? 1 : 0.75}
                    stroke={isHovered ? '#fff' : node.isHub ? V.orange : 'transparent'}
                    strokeWidth={isHovered ? 2.5 : node.isHub ? 1.5 : 0}
                    style={{ cursor: 'pointer', transition: 'r 0.15s, fill-opacity 0.15s' }}
                    onMouseEnter={(e) => handleNodeHover(node, e)}
                    onMouseLeave={handleNodeLeave}
                    onClick={() => handleNodeClick(node)}
                  />

                  {/* Label */}
                  {showLabels && !isDimmed && (
                    <text
                      x={node.x}
                      y={node.y + radius + 12}
                      textAnchor="middle"
                      fontSize={9}
                      fill={V.textSecondary}
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {node.title.length > 20 ? node.title.slice(0, 18) + '...' : node.title}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltipNode && (
          <div
            style={{
              position: 'absolute',
              left: tooltipPos.x,
              top: tooltipPos.y,
              background: 'rgba(0, 0, 0, 0.88)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.5,
              pointerEvents: 'none',
              zIndex: 10,
              maxWidth: 280,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltipNode.title}</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>
              /{tooltipNode.slug || 'home'} ({tooltipNode.collection})
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 12 }}>
              <span>{T.linkGraph.incomingLinks}: {tooltipNode.inDegree}</span>
              <span>{T.linkGraph.outgoingLinks}: {tooltipNode.outDegree}</span>
            </div>
            {tooltipNode.isOrphan && (
              <div style={{ marginTop: 2, color: V.red, fontWeight: 600, fontSize: 11 }}>
                {T.linkGraph.orphanNodes}
              </div>
            )}
            {tooltipNode.isHub && (
              <div style={{ marginTop: 2, color: V.orange, fontWeight: 600, fontSize: 11 }}>
                Hub
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 10, opacity: 0.5 }}>
              {T.linkGraph.clickToOpen}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared button style for controls
// ---------------------------------------------------------------------------

const controlBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 13,
  background: V.bgCard,
  color: V.text,
  border: `1px solid ${V.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1.4,
}
