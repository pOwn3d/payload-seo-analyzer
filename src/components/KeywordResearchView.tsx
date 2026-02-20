'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
// Types
// ---------------------------------------------------------------------------

type SuggestionType = 'unused' | 'related' | 'trending' | 'long-tail'
type FilterTab = 'all' | SuggestionType

interface Suggestion {
  keyword: string
  type: SuggestionType
  score: number
  frequency: number
  currentlyUsedBy: string[]
  suggestedFor: string[]
}

interface Stats {
  totalKeywordsAnalyzed: number
  uniqueTerms: number
  suggestionsCount: number
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}

// ---------------------------------------------------------------------------
// Type badge config
// ---------------------------------------------------------------------------

const typeConfig: Record<SuggestionType, { label: string; color: string; bg: string }> = {
  unused: { label: 'Non utilis\u00e9', color: V.blue, bg: 'rgba(59,130,246,0.12)' },
  related: { label: 'Associ\u00e9', color: V.orange, bg: 'rgba(249,115,22,0.12)' },
  trending: { label: 'Tendance', color: V.cyan, bg: 'rgba(6,182,212,0.12)' },
  'long-tail': { label: 'Longue tra\u00eene', color: V.green, bg: 'rgba(34,197,94,0.12)' },
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'unused', label: 'Non utilis\u00e9s' },
  { key: 'related', label: 'Associ\u00e9s' },
  { key: 'trending', label: 'Tendances' },
  { key: 'long-tail', label: 'Longue tra\u00eene' },
]

// ---------------------------------------------------------------------------
// ScoreBar sub-component
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? V.green : score >= 40 ? V.yellow : V.red
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 60,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(0,0,0,0.08)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${Math.min(100, score)}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24 }}>{score}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExpandableList sub-component
// ---------------------------------------------------------------------------

function ExpandableList({ items, label }: { items: string[]; label: string }) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return <span style={{ fontSize: 10, color: V.textSecondary, fontStyle: 'italic' }}>--</span>
  }

  const displayed = expanded ? items : items.slice(0, 2)
  const hasMore = items.length > 2

  return (
    <div>
      {displayed.map((item, idx) => (
        <div
          key={idx}
          style={{
            fontSize: 10,
            color: V.text,
            lineHeight: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
          title={item}
        >
          {item}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 9,
            color: V.cyan,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {expanded
            ? 'Voir moins'
            : `+${items.length - 2} ${label}`}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main KeywordResearchView component
// ---------------------------------------------------------------------------

export function KeywordResearchView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Fetch keyword research data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/keyword-research', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setStats(data.stats || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((s) => s.type === activeTab)
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.keyword.toLowerCase().includes(q) ||
          s.currentlyUsedBy.some((t) => t.toLowerCase().includes(q)) ||
          s.suggestedFor.some((t) => t.toLowerCase().includes(q)),
      )
    }

    return filtered
  }, [suggestions, activeTab, search])

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: suggestions.length,
      unused: 0,
      related: 0,
      trending: 0,
      'long-tail': 0,
    }
    for (const s of suggestions) {
      counts[s.type]++
    }
    return counts
  }, [suggestions])

  // CSV export
  const handleExportCsv = useCallback(() => {
    const headers = [
      'Mot-cl\u00e9',
      'Type',
      'Score',
      'Fr\u00e9quence',
      'Utilis\u00e9 par',
      'Sugg\u00e9r\u00e9 pour',
    ]
    const rows = filteredSuggestions.map((s) => [
      s.keyword,
      typeConfig[s.type]?.label || s.type,
      String(s.score),
      String(s.frequency),
      s.currentlyUsedBy.join(' | '),
      s.suggestedFor.join(' | '),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    const bom = '\uFEFF' // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seo-keywords-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredSuggestions])

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          color: V.textSecondary,
          fontSize: 14,
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        Analyse des mots-cl&eacute;s en cours...
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        <div style={{ color: V.red, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Erreur de chargement
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={fetchData}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          R&eacute;essayer
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '20px 24px',
        maxWidth: 1200,
        margin: '0 auto',
        fontFamily: 'var(--font-body, system-ui)',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: V.text }}>
            Recherche de mots-cl&eacute;s
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            Suggestions bas&eacute;es sur l&apos;analyse du contenu existant
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Stats badges */}
          {stats && (
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  color: V.blue,
                  border: `1px solid ${V.border}`,
                }}
              >
                {stats.totalKeywordsAnalyzed} mots-cl&eacute;s actifs
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: 'rgba(6,182,212,0.12)',
                  color: V.cyan,
                  border: `1px solid ${V.border}`,
                }}
              >
                {stats.uniqueTerms} termes uniques
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  color: V.green,
                  border: `1px solid ${V.border}`,
                }}
              >
                {stats.suggestionsCount} suggestions
              </span>
            </div>
          )}
          <button
            onClick={fetchData}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; Rafra&icirc;chir
          </button>
          <button
            onClick={handleExportCsv}
            disabled={filteredSuggestions.length === 0}
            style={{
              ...btnBase,
              backgroundColor: filteredSuggestions.length > 0 ? V.cyan : V.bgCard,
              color: filteredSuggestions.length > 0 ? '#000' : V.textSecondary,
              opacity: filteredSuggestions.length > 0 ? 1 : 0.5,
              cursor: filteredSuggestions.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...btnBase,
              backgroundColor:
                activeTab === tab.key ? V.cyan : V.bgCard,
              color: activeTab === tab.key ? '#000' : V.text,
              fontWeight: activeTab === tab.key ? 800 : 600,
              fontSize: 10,
              padding: '5px 12px',
            }}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Rechercher un mot-cl\u00e9, titre de page..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: `1px solid ${V.border}`,
            fontSize: 12,
            minWidth: 300,
            color: V.text,
            backgroundColor: V.bg,
          }}
        />
      </div>

      {/* No suggestions */}
      {filteredSuggestions.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            backgroundColor: V.bgCard,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>
            {suggestions.length === 0 ? '\uD83D\uDD0D' : '\uD83D\uDCDD'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: V.text, marginBottom: 4 }}>
            {suggestions.length === 0
              ? 'Aucune suggestion disponible'
              : 'Aucun r\u00e9sultat'}
          </div>
          <div style={{ fontSize: 12, color: V.textSecondary }}>
            {suggestions.length === 0
              ? "Ajoutez du contenu \u00e0 vos pages pour que l'analyse puisse g\u00e9n\u00e9rer des suggestions."
              : "Aucune suggestion ne correspond \u00e0 votre recherche."}
          </div>
        </div>
      )}

      {/* Suggestions table */}
      {filteredSuggestions.length > 0 && (
        <div
          style={{
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 70px 60px 180px 180px',
              padding: '8px 14px',
              backgroundColor: V.bgCard,
              borderBottom: `2px solid ${V.border}`,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: V.textSecondary,
              letterSpacing: 0.5,
              gap: 8,
            }}
          >
            <span>Mot-cl&eacute;</span>
            <span>Type</span>
            <span>Score</span>
            <span style={{ textAlign: 'center' }}>Fr&eacute;q.</span>
            <span>Utilis&eacute; par</span>
            <span>Sugg&eacute;r&eacute; pour</span>
          </div>

          {/* Table rows */}
          {filteredSuggestions.map((suggestion, idx) => {
            const tc = typeConfig[suggestion.type]

            return (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 70px 60px 180px 180px',
                  padding: '10px 14px',
                  borderBottom: `1px solid ${V.border}`,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Keyword */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: V.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={suggestion.keyword}
                >
                  {suggestion.keyword}
                </div>

                {/* Type badge */}
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      backgroundColor: tc.bg,
                      color: tc.color,
                    }}
                  >
                    {tc.label}
                  </span>
                </div>

                {/* Score bar */}
                <div>
                  <ScoreBar score={suggestion.score} />
                </div>

                {/* Frequency */}
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: V.text,
                  }}
                >
                  {suggestion.frequency}
                </div>

                {/* Currently used by */}
                <div>
                  <ExpandableList items={suggestion.currentlyUsedBy} label="page(s)" />
                </div>

                {/* Suggested for */}
                <div>
                  <ExpandableList items={suggestion.suggestedFor} label="page(s)" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
