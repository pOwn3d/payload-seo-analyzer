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
  violet: '#7c3aed',
}

const S = {
  fr: {
    title: 'Opportunités CTR (faible clic / bonne position)',
    subtitle: 'Pages bien positionnées mais peu cliquées (méta peu attractive). Données Google Search Console → réécriture méta ciblée.',
    needGsc: 'Connectez Google Search Console ci-dessus pour activer les opportunités CTR.',
    none: 'Aucune opportunité détectée sur la période. 🎉',
    loading: 'Analyse des données GSC…',
    page: 'Page',
    pos: 'Pos.',
    ctr: 'CTR',
    expected: 'attendu',
    potential: 'Clics/mois potentiels',
    optimize: 'Optimiser',
    optimizing: '…',
    apply: 'Appliquer',
    applied: 'Appliqué ✓',
    noKey: 'Clé API Claude requise (ANTHROPIC_API_KEY).',
    open: 'Ouvrir',
    refresh: 'Rafraîchir',
  },
  en: {
    title: 'CTR opportunities (low clicks / good rank)',
    subtitle: 'Pages that rank well but get few clicks (weak meta). Google Search Console data → targeted meta rewrite.',
    needGsc: 'Connect Google Search Console above to enable CTR opportunities.',
    none: 'No opportunities for the period. 🎉',
    loading: 'Analyzing GSC data…',
    page: 'Page',
    pos: 'Pos.',
    ctr: 'CTR',
    expected: 'expected',
    potential: 'Potential clicks/mo',
    optimize: 'Optimize',
    optimizing: '…',
    apply: 'Apply',
    applied: 'Applied ✓',
    noKey: 'Claude API key required (ANTHROPIC_API_KEY).',
    open: 'Open',
    refresh: 'Refresh',
  },
} as const

interface Opportunity {
  url: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  expectedCtr: number
  potentialClicks: number
  doc: { collection: string; id: string } | null
}
interface RowState {
  busy?: boolean
  suggestion?: { metaTitle: string; metaDescription: string; focusKeyword: string; current: { focusKeyword: string } }
  applied?: boolean
  error?: string
}

export function CtrOpportunitiesPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [opps, setOpps] = useState<Opportunity[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<Record<string, RowState>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/ctr-opportunities', { credentials: 'include', cache: 'no-store' })
      // 404 = endpoint not registered (features.gscApi off) · 403/409/400 = not admin / not connected / misconfig.
      if (res.status === 404 || res.status === 403 || res.status === 409 || res.status === 400) {
        setNotConnected(true)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setNotConnected(false)
      setOpps((json.opportunities as Opportunity[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setRow = (url: string, patch: RowState) => setState((p) => ({ ...p, [url]: { ...p[url], ...patch } }))

  const optimize = async (o: Opportunity) => {
    if (!o.doc) return
    setRow(o.url, { busy: true, error: undefined })
    try {
      const res = await fetch('/api/seo-plugin/ai-optimize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: o.doc.collection, id: o.doc.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRow(o.url, { busy: false, error: json.code === 'no_api_key' ? s.noKey : json.error || `Error ${res.status}` })
        return
      }
      setRow(o.url, { busy: false, suggestion: { ...json.suggestions, current: json.current } })
    } catch (e) {
      setRow(o.url, { busy: false, error: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const apply = async (o: Opportunity) => {
    const rs = state[o.url]
    if (!o.doc || !rs?.suggestion) return
    setRow(o.url, { busy: true, error: undefined })
    const patch: Record<string, unknown> = {}
    if (rs.suggestion.metaTitle || rs.suggestion.metaDescription) {
      patch.meta = { title: rs.suggestion.metaTitle, description: rs.suggestion.metaDescription }
    }
    if (rs.suggestion.focusKeyword && rs.suggestion.focusKeyword !== rs.suggestion.current?.focusKeyword) {
      patch.focusKeyword = rs.suggestion.focusKeyword
    }
    try {
      await fetch(`/api/${o.doc.collection}/${o.doc.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setRow(o.url, { busy: false, applied: true })
    } catch (e) {
      setRow(o.url, { busy: false, error: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const card: React.CSSProperties = { padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: C.card, marginBottom: 20 }
  const btn = (bg: string): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 6, border: `1px solid ${bg}`, backgroundColor: bg, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  })

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        {!notConnected && <button type="button" onClick={() => void load()} style={btn(C.sub)}>{s.refresh}</button>}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}
      {notConnected && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.needGsc}</div>}
      {loading && !notConnected && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.loading}</div>}
      {!loading && !notConnected && opps && opps.length === 0 && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.none}</div>}

      {!notConnected && opps && opps.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: C.sub }}>
                <th style={{ padding: '6px 8px' }}>{s.page}</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.pos}</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.ctr}</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.potential}</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {opps.slice(0, 50).map((o) => {
                const rs = state[o.url] || {}
                const path = (() => { try { return new URL(o.url).pathname } catch { return o.url } })()
                return (
                  <React.Fragment key={o.url}>
                    <tr style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                      <td style={{ padding: '6px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{o.position.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <span style={{ color: C.red }}>{(o.ctr * 100).toFixed(1)}%</span>
                        <span style={{ color: C.sub }}> / {(o.expectedCtr * 100).toFixed(0)}% {s.expected}</span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: C.amber }}>+{o.potentialClicks}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {rs.applied ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{s.applied}</span>
                        ) : o.doc ? (
                          rs.suggestion ? (
                            <button type="button" onClick={() => void apply(o)} disabled={rs.busy} style={btn(C.green)}>{rs.busy ? s.optimizing : s.apply}</button>
                          ) : (
                            <button type="button" onClick={() => void optimize(o)} disabled={rs.busy} style={btn(C.violet)}>{rs.busy ? s.optimizing : `✨ ${s.optimize}`}</button>
                          )
                        ) : (
                          <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.sub }}>{s.open} ↗</a>
                        )}
                      </td>
                    </tr>
                    {rs.suggestion && !rs.applied && (
                      <tr style={{ color: C.text }}>
                        <td colSpan={5} style={{ padding: '0 8px 8px 8px' }}>
                          <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{rs.suggestion.metaTitle}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{rs.suggestion.metaDescription}</div>
                        </td>
                      </tr>
                    )}
                    {rs.error && (
                      <tr><td colSpan={5} style={{ padding: '0 8px 6px 8px', fontSize: 11, color: C.red }}>{rs.error}</td></tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
