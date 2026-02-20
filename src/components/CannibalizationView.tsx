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
interface PageEntry {
  id: number | string
  title: string
  slug: string
  collection: string
  score: number
}

interface Conflict {
  keyword: string
  pages: PageEntry[]
}

interface Stats {
  totalConflicts: number
  totalAffectedPages: number
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

function getScoreColor(score: number): string {
  if (score >= 80) return V.green
  if (score >= 50) return V.yellow
  return V.red
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'rgba(34,197,94,0.12)'
  if (score >= 50) return 'rgba(245,158,11,0.12)'
  return 'rgba(239,68,68,0.12)'
}

// ---------------------------------------------------------------------------
// KeywordGroup sub-component
// ---------------------------------------------------------------------------
function KeywordGroup({ conflict }: { conflict: Conflict }) {
  const [open, setOpen] = useState(true)

  const severity = conflict.pages.length >= 3 ? 'high' : 'medium'
  const badgeColor = severity === 'high' ? V.red : V.orange
  const badgeLabel = severity === 'high' ? 'Risque élevé' : 'Attention'
  const badgeBg =
    severity === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)'

  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${V.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Keyword header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          backgroundColor: badgeBg,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: V.text,
            }}
          >
            &quot;{conflict.keyword}&quot;
          </span>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              backgroundColor: badgeColor,
              color: '#fff',
              border: `1px solid ${V.border}`,
            }}
          >
            {badgeLabel}
          </span>
          <span
            style={{
              fontSize: 11,
              color: V.textSecondary,
              fontWeight: 600,
            }}
          >
            {conflict.pages.length} pages
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            color: V.textSecondary,
          }}
        >
          {'\u25B6'}
        </span>
      </div>

      {/* Pages table */}
      {open && (
        <div>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 60px 50px',
              padding: '6px 14px',
              backgroundColor: V.bgCard,
              borderBottom: `1px solid ${V.border}`,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: V.textSecondary,
              letterSpacing: 0.5,
              gap: 8,
            }}
          >
            <span>Page</span>
            <span>Collection</span>
            <span>Slug</span>
            <span style={{ textAlign: 'center' }}>Score</span>
            <span />
          </div>

          {/* Table rows */}
          {conflict.pages.map((page) => (
            <div
              key={`${page.collection}-${page.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 80px 60px 50px',
                padding: '8px 14px',
                borderBottom: `1px solid ${V.border}`,
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: V.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {page.title}
              </div>
              <div style={{ fontSize: 11, color: V.textSecondary }}>
                <span
                  style={{
                    padding: '0 4px',
                    borderRadius: 3,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor:
                      page.collection === 'pages'
                        ? 'rgba(37,99,235,0.15)'
                        : 'rgba(217,119,6,0.2)',
                  }}
                >
                  {page.collection === 'pages' ? 'Page' : 'Article'}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: V.textSecondary,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`/${page.slug}`}
              >
                /{page.slug}
              </div>
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 12,
                    color: getScoreColor(page.score),
                    backgroundColor: getScoreBg(page.score),
                    minWidth: 36,
                  }}
                >
                  {page.score}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <a
                  href={`/admin/collections/${page.collection}/${page.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 10,
                    fontWeight: 700,
                    color: V.cyan,
                    textDecoration: 'none',
                  }}
                  title="Editer"
                >
                  {'\u2192'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main CannibalizationView component
// ---------------------------------------------------------------------------
export function CannibalizationView() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/cannibalization', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConflicts(data.conflicts || [])
      setStats(data.stats || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter conflicts by search
  const filteredConflicts = useMemo(() => {
    if (!search.trim()) return conflicts
    const q = search.toLowerCase()
    return conflicts.filter(
      (c) =>
        c.keyword.toLowerCase().includes(q) ||
        c.pages.some(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q),
        ),
    )
  }, [conflicts, search])

  // CSV export
  const handleExportCsv = useCallback(() => {
    const headers = ['Mot-clé', 'Titre', 'Slug', 'Collection', 'Score']
    const rows: string[][] = []
    for (const conflict of filteredConflicts) {
      for (const page of conflict.pages) {
        rows.push([
          conflict.keyword,
          page.title,
          page.slug,
          page.collection,
          String(page.score),
        ])
      }
    }

    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seo-cannibalization-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredConflicts])

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
        Analyse de la cannibalisation...
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
        <div
          style={{
            color: V.red,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          Erreur de chargement
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={fetchData}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          Réessayer
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
            Cannibalisation de mots-clés
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            Détection des mots-clés utilisés par plusieurs pages
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
                  backgroundColor: stats.totalConflicts > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                  color: stats.totalConflicts > 0 ? V.red : V.green,
                  border: `1px solid ${V.border}`,
                }}
              >
                {stats.totalConflicts} conflit{stats.totalConflicts > 1 ? 's' : ''}
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  color: V.orange,
                  border: `1px solid ${V.border}`,
                }}
              >
                {stats.totalAffectedPages} page{stats.totalAffectedPages > 1 ? 's' : ''} concernée{stats.totalAffectedPages > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <button
            onClick={fetchData}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; Rafraîchir
          </button>
          <button
            onClick={handleExportCsv}
            disabled={filteredConflicts.length === 0}
            style={{
              ...btnBase,
              backgroundColor: filteredConflicts.length > 0 ? V.cyan : V.bgCard,
              color: filteredConflicts.length > 0 ? '#000' : V.textSecondary,
              opacity: filteredConflicts.length > 0 ? 1 : 0.5,
              cursor: filteredConflicts.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Rechercher un mot-clé, titre ou slug..."
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

      {/* No conflicts */}
      {filteredConflicts.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            backgroundColor: V.bgCard,
          }}
        >
          <div
            style={{
              fontSize: 28,
              marginBottom: 8,
            }}
          >
            {conflicts.length === 0 ? '\u2705' : '\uD83D\uDD0D'}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: V.text,
              marginBottom: 4,
            }}
          >
            {conflicts.length === 0
              ? 'Aucune cannibalisation détectée'
              : 'Aucun résultat'}
          </div>
          <div style={{ fontSize: 12, color: V.textSecondary }}>
            {conflicts.length === 0
              ? 'Chaque mot-clé est utilisé par une seule page. Bonne pratique !'
              : 'Aucun conflit ne correspond à votre recherche.'}
          </div>
        </div>
      )}

      {/* Conflict groups */}
      {filteredConflicts.map((conflict) => (
        <KeywordGroup key={conflict.keyword} conflict={conflict} />
      ))}
    </div>
  )
}
