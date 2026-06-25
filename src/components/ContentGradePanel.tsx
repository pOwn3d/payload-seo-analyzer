'use client'

import React, { useCallback, useEffect, useState } from 'react'

const C = {
  text: 'var(--theme-text, #1a1a1a)',
  sub: 'var(--theme-elevation-600, #6b7280)',
  card: 'var(--theme-elevation-50, #f9fafb)',
  bg: 'var(--theme-elevation-0, #fff)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
}

interface PageOption {
  id: string | number
  collection: string
  title: string
  slug: string
}
interface CoverageGap {
  query: string
  impressions: number
  position: number
  missingTerms?: string[]
  nearTop?: boolean
}
interface CtrGap {
  query: string
  ctr: number
  expectedCtr: number
  position: number
}
interface ContentGradeResponse {
  gscConnected: boolean
  message?: string
  grade?: string
  score?: number
  subScores?: { coverage?: number; ctr?: number; position?: number }
  weightedPosition?: number
  coverageGaps?: CoverageGap[]
  ctrGaps?: CtrGap[]
  recommendations?: string[]
}

const S = {
  fr: {
    title: 'Content Grade (couverture GSC)',
    subtitle: 'Note de couverture par page à partir des requêtes Google Search Console réelles — sans API SERP payante.',
    selectPage: 'Choisir une page…',
    loadingPages: 'Chargement des pages…',
    grading: 'Analyse de la couverture…',
    needGsc: 'Connectez Google Search Console pour activer le Content Grade.',
    noPages: 'Aucune page à analyser.',
    coverageGaps: 'Requêtes mal couvertes (à enrichir)',
    missing: 'termes manquants',
    nearTop: 'proche du top',
    ctrGaps: 'Requêtes à fort potentiel CTR',
    recommendations: 'Recommandations',
    coverage: 'Couverture',
    ctr: 'CTR',
    position: 'Position',
    refresh: 'Rafraîchir',
  },
  en: {
    title: 'Content Grade (GSC coverage)',
    subtitle: 'Per-page coverage grade from real Google Search Console queries — no paid SERP API.',
    selectPage: 'Pick a page…',
    loadingPages: 'Loading pages…',
    grading: 'Analyzing coverage…',
    needGsc: 'Connect Google Search Console to enable Content Grade.',
    noPages: 'No page to analyze.',
    coverageGaps: 'Poorly covered queries (enrich these)',
    missing: 'missing terms',
    nearTop: 'near top',
    ctrGaps: 'High-CTR-potential queries',
    recommendations: 'Recommendations',
    coverage: 'Coverage',
    ctr: 'CTR',
    position: 'Position',
    refresh: 'Refresh',
  },
} as const

function gradeColor(grade?: string): string {
  if (!grade) return C.sub
  if (grade === 'A' || grade === 'B') return C.green
  if (grade === 'C') return C.amber
  return C.red
}

export function ContentGradePanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [pages, setPages] = useState<PageOption[]>([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const [selected, setSelected] = useState<string>('')
  const [data, setData] = useState<ContentGradeResponse | null>(null)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPages = useCallback(async () => {
    setPagesLoading(true)
    try {
      const res = await fetch('/api/seo-plugin/audit', { credentials: 'include', cache: 'no-store' })
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = Array.isArray(json.results) ? json.results : []
      setPages(
        results
          .filter((r) => r && r.id != null && r.collection && !String(r.collection).startsWith('global:'))
          .map((r) => ({ id: r.id, collection: r.collection, title: r.title || r.slug || String(r.id), slug: r.slug || '' })),
      )
    } catch {
      /* non-blocking — the page list is a convenience */
    } finally {
      setPagesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  const grade = useCallback(async (value: string) => {
    if (!value) return
    const [collection, id] = value.split('::')
    setGrading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(
        `/api/seo-plugin/content-grade?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`,
        { credentials: 'include', cache: 'no-store' },
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setData(json as ContentGradeResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setGrading(false)
    }
  }, [])

  const onSelect = (value: string) => {
    setSelected(value)
    void grade(value)
  }

  const card: React.CSSProperties = { padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: C.card, marginBottom: 20 }
  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 13,
    minWidth: 260,
    maxWidth: '100%',
  }

  return (
    <div style={card}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 12 }}>{s.subtitle}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selected} onChange={(e) => onSelect(e.target.value)} style={selectStyle} disabled={pagesLoading}>
          <option value="">{pagesLoading ? s.loadingPages : pages.length === 0 ? s.noPages : s.selectPage}</option>
          {pages.map((p) => (
            <option key={`${p.collection}::${p.id}`} value={`${p.collection}::${p.id}`}>
              {p.title} — {p.collection}
            </option>
          ))}
        </select>
        {selected && !grading && (
          <button
            type="button"
            onClick={() => void grade(selected)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.sub}`, backgroundColor: C.bg, color: C.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {s.refresh}
          </button>
        )}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}
      {grading && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.grading}</div>}

      {!grading && data && data.gscConnected === false && (
        <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{data.message || s.needGsc}</div>
      )}

      {!grading && data && data.gscConnected !== false && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: gradeColor(data.grade),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {data.grade ?? '—'}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {typeof data.score === 'number' && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{Math.round(data.score)}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>Score /100</div>
                </div>
              )}
              {data.subScores?.coverage != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{Math.round(data.subScores.coverage)}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{s.coverage}</div>
                </div>
              )}
              {data.weightedPosition != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.amber }}>{data.weightedPosition.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{s.position}</div>
                </div>
              )}
            </div>
          </div>

          {data.coverageGaps && data.coverageGaps.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.coverageGaps}</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.sub }}>
                {data.coverageGaps.slice(0, 10).map((g, i) => (
                  <li key={`${g.query || i}`} style={{ marginBottom: 2 }}>
                    <span style={{ color: C.text }}>{g.query}</span>
                    {g.nearTop && <span style={{ color: C.amber, fontWeight: 700 }}> · {s.nearTop}</span>}
                    {g.missingTerms && g.missingTerms.length > 0 && (
                      <span style={{ color: C.red }}> · {s.missing}: {g.missingTerms.slice(0, 5).join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.recommendations && data.recommendations.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.recommendations}</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.sub }}>
                {data.recommendations.slice(0, 8).map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
