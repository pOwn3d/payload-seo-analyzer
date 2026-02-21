'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

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

// typeConfig and filterTabs are now created inside the component to support i18n

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

function ExpandableList({ items, label, seeLessLabel }: { items: string[]; label: string; seeLessLabel: string }) {
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
            ? seeLessLabel
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
  const locale = useSeoLocale()
  const t = getDashboardT(locale)

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // i18n-aware type badge config
  const typeConfig: Record<SuggestionType, { label: string; color: string; bg: string }> = useMemo(() => ({
    unused: { label: t.keywordResearch.unused, color: V.blue, bg: 'rgba(59,130,246,0.12)' },
    related: { label: t.keywordResearch.associated, color: V.orange, bg: 'rgba(249,115,22,0.12)' },
    trending: { label: t.keywordResearch.trending, color: V.cyan, bg: 'rgba(6,182,212,0.12)' },
    'long-tail': { label: t.keywordResearch.longTail, color: V.green, bg: 'rgba(34,197,94,0.12)' },
  }), [t])

  // i18n-aware filter tabs
  const filterTabs: { key: FilterTab; label: string }[] = useMemo(() => [
    { key: 'all', label: t.keywordResearch.all },
    { key: 'unused', label: t.keywordResearch.unusedPlural },
    { key: 'related', label: t.keywordResearch.associatedPlural },
    { key: 'trending', label: t.keywordResearch.trendingPlural },
    { key: 'long-tail', label: t.keywordResearch.longTail },
  ], [t])

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
      setError(e instanceof Error ? e.message : t.common.loadingError)
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
      t.keywordResearch.keyword,
      t.keywordResearch.type,
      t.keywordResearch.score,
      t.keywordResearch.frequency,
      t.keywordResearch.usedBy,
      t.keywordResearch.suggestedFor,
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
        {t.keywordResearch.loading}
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
          {t.common.loadingError}
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={fetchData}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          {t.common.retry}
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
            {t.keywordResearch.title}
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {t.keywordResearch.subtitle}
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
                {stats.totalKeywordsAnalyzed} {t.keywordResearch.activeKeywords}
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
                {stats.uniqueTerms} {t.keywordResearch.uniqueTerms}
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
                {stats.suggestionsCount} {t.keywordResearch.suggestions}
              </span>
            </div>
          )}
          <button
            onClick={fetchData}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; {t.common.refresh}
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
            {t.common.exportCsv}
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
          placeholder={t.keywordResearch.searchPlaceholder}
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
              ? t.keywordResearch.noSuggestions
              : t.common.noResults}
          </div>
          <div style={{ fontSize: 12, color: V.textSecondary }}>
            {suggestions.length === 0
              ? t.keywordResearch.noSuggestionsDesc
              : t.keywordResearch.noMatchingSuggestions}
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
            <span>{t.keywordResearch.keyword}</span>
            <span>{t.keywordResearch.type}</span>
            <span>{t.keywordResearch.score}</span>
            <span style={{ textAlign: 'center' }}>{t.keywordResearch.freq}</span>
            <span>{t.keywordResearch.usedBy}</span>
            <span>{t.keywordResearch.suggestedFor}</span>
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
                  <ExpandableList items={suggestion.currentlyUsedBy} label="page(s)" seeLessLabel={t.keywordResearch.seeLess} />
                </div>

                {/* Suggested for */}
                <div>
                  <ExpandableList items={suggestion.suggestedFor} label="page(s)" seeLessLabel={t.keywordResearch.seeLess} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
