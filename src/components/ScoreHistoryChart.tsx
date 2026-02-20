'use client'

import React, { useEffect, useState, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  score: number
  level: string
  focusKeyword: string
  wordCount: number
  checksSummary: { pass: number; warning: number; fail: number }
  snapshotDate: string
}

interface HistoryResponse {
  history: HistoryEntry[]
  trend: 'improving' | 'declining' | 'stable'
  scoreDelta: number
}

interface ScoreHistoryChartProps {
  documentId: string
  collection: string
}

// ---------------------------------------------------------------------------
// Color palette (neubrutalist — same as SeoAnalyzer)
// ---------------------------------------------------------------------------
const C = {
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  black: '#000',
  white: '#fff',
  text: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  border: 'var(--theme-border-color, #000)',
  surface: 'var(--theme-elevation-0, #fff)',
  surface50: 'var(--theme-elevation-50, #f9fafb)',
  borderLight: 'var(--theme-elevation-200, #e5e7eb)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 91) return C.green
  if (score >= 71) return C.yellow
  if (score >= 41) return C.orange
  return C.red
}

function getTrendIcon(trend: 'improving' | 'declining' | 'stable'): string {
  switch (trend) {
    case 'improving':
      return '\u2197' // arrow upper-right
    case 'declining':
      return '\u2198' // arrow lower-right
    case 'stable':
      return '\u2192' // arrow right
  }
}

function getTrendColor(trend: 'improving' | 'declining' | 'stable'): string {
  switch (trend) {
    case 'improving':
      return C.green
    case 'declining':
      return C.red
    case 'stable':
      return C.yellow
  }
}

function getTrendLabel(trend: 'improving' | 'declining' | 'stable'): string {
  switch (trend) {
    case 'improving':
      return 'En hausse'
    case 'declining':
      return 'En baisse'
    case 'stable':
      return 'Stable'
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// SVG Sparkline
// ---------------------------------------------------------------------------

function Sparkline({
  data,
  width,
  height,
}: {
  data: number[]
  width: number
  height: number
}) {
  const padding = { top: 4, bottom: 4, left: 2, right: 2 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Y-axis: always 0-100 for SEO scores
  const yMin = 0
  const yMax = 100

  const points = useMemo(() => {
    if (data.length === 0) return ''
    if (data.length === 1) {
      const x = padding.left + chartW / 2
      const y = padding.top + chartH - ((data[0] - yMin) / (yMax - yMin)) * chartH
      return `${x},${y}`
    }

    return data
      .map((val, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartW
        const y = padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH
        return `${x},${y}`
      })
      .join(' ')
  }, [data, chartW, chartH, padding.left, padding.top])

  // Gradient fill area (polyline + bottom closing path)
  const areaPoints = useMemo(() => {
    if (data.length < 2) return ''

    const linePoints = data.map((val, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW
      const y = padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH
      return `${x},${y}`
    })

    const bottomRight = `${padding.left + chartW},${padding.top + chartH}`
    const bottomLeft = `${padding.left},${padding.top + chartH}`

    return linePoints.join(' ') + ' ' + bottomRight + ' ' + bottomLeft
  }, [data, chartW, chartH, padding.left, padding.top])

  // Color based on latest score
  const latestScore = data.length > 0 ? data[data.length - 1] : 0
  const lineColor = getScoreColor(latestScore)

  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`

  if (data.length === 0) return null

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines at 25, 50, 75 */}
      {[25, 50, 75].map((val) => {
        const y = padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH
        return (
          <line
            key={val}
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke={C.borderLight}
            strokeWidth={0.5}
            strokeDasharray="2,2"
            opacity={0.5}
          />
        )
      })}

      {/* Gradient area fill */}
      {areaPoints && (
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      )}

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((val, i) => {
        const x =
          data.length === 1
            ? padding.left + chartW / 2
            : padding.left + (i / (data.length - 1)) * chartW
        const y = padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH
        const isLast = i === data.length - 1
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={isLast ? 3 : 1.5}
            fill={isLast ? lineColor : C.white}
            stroke={lineColor}
            strokeWidth={isLast ? 2 : 1}
          />
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({ documentId, collection }) => {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!documentId || !collection) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchHistory = async () => {
      try {
        setLoading(true)
        setError(false)

        const params = new URLSearchParams({
          documentId,
          collection,
          limit: '30',
        })

        const res = await fetch(`/api/seo-plugin/history?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const json: HistoryResponse = await res.json()
        if (!cancelled) {
          setData(json)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHistory()
    return () => {
      cancelled = true
    }
  }, [documentId, collection])

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          backgroundColor: C.surface50,
          fontSize: 11,
          color: C.textSecondary,
          textAlign: 'center',
        }}
      >
        Chargement de l'historique...
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          border: `1px solid ${C.red}`,
          backgroundColor: 'rgba(239,68,68,0.05)',
          fontSize: 11,
          color: C.red,
          textAlign: 'center',
        }}
      >
        Erreur lors du chargement de l'historique
      </div>
    )
  }

  // Empty state
  if (!data || data.history.length === 0) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          backgroundColor: C.surface50,
          fontSize: 11,
          color: C.textSecondary,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Pas encore d'historique.
        <br />
        <span style={{ fontSize: 10 }}>
          Les scores seront enregistres a chaque sauvegarde.
        </span>
      </div>
    )
  }

  const { history, trend, scoreDelta } = data
  const scores = history.map((h) => h.score)
  const latestScore = scores[scores.length - 1]
  const firstDate = history.length > 0 ? formatDate(history[0].snapshotDate) : ''
  const lastDate = history.length > 0 ? formatDate(history[history.length - 1].snapshotDate) : ''
  const trendColor = getTrendColor(trend)
  const trendIcon = getTrendIcon(trend)
  const trendLabel = getTrendLabel(trend)

  return (
    <div
      style={{
        borderRadius: 8,
        border: `2px solid ${C.border}`,
        backgroundColor: C.surface,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${C.borderLight}`,
          backgroundColor: C.surface50,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            color: C.text,
          }}
        >
          Evolution du score
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Trend badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: `${trendColor}18`,
              color: trendColor,
              border: `1px solid ${trendColor}40`,
            }}
          >
            <span style={{ fontSize: 12 }}>{trendIcon}</span>
            {trendLabel}
          </span>

          {/* Score delta badge */}
          {scoreDelta !== 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 800,
                backgroundColor:
                  scoreDelta > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: scoreDelta > 0 ? C.green : C.red,
              }}
            >
              {scoreDelta > 0 ? '+' : ''}
              {scoreDelta}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline chart */}
      <div style={{ padding: '8px 10px 4px' }}>
        <Sparkline data={scores} width={260} height={60} />
      </div>

      {/* X-axis date labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 12px 6px',
          fontSize: 9,
          color: C.textSecondary,
          fontWeight: 600,
        }}
      >
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>

      {/* Footer stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderTop: `1px solid ${C.borderLight}`,
          backgroundColor: C.surface50,
          fontSize: 10,
          color: C.textSecondary,
        }}
      >
        <span>
          <span style={{ fontWeight: 700, color: C.text }}>
            {history.length}
          </span>{' '}
          mesure{history.length > 1 ? 's' : ''}
        </span>
        <span>
          Dernier score :{' '}
          <span style={{ fontWeight: 800, color: getScoreColor(latestScore) }}>
            {latestScore}
          </span>
        </span>
      </div>
    </div>
  )
}

export default ScoreHistoryChart
