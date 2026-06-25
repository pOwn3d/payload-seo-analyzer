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
  blue: '#3b82f6',
}

const S = {
  fr: {
    title: 'Suivi de positions (rank tracking)',
    subtitle: 'Historique quotidien des positions Google (via Search Console) et mouvements dans le temps.',
    needGsc: 'Connectez Google Search Console ci-dessus pour activer le suivi de positions.',
    snapshot: 'Relever maintenant',
    snapshotting: 'Relevé en cours…',
    noData: 'Pas encore de données. Le relevé tourne automatiquement chaque jour ; cliquez « Relever maintenant » pour démarrer.',
    lastSnapshot: 'Dernier relevé',
    query: 'Requête',
    position: 'Position',
    change: 'Évolution',
    clicks: 'Clics',
    impressions: 'Impr.',
    stable: 'stable',
    newQ: 'nouveau',
    countLabel: 'requêtes suivies',
  },
  en: {
    title: 'Rank tracking',
    subtitle: 'Daily Google position history (via Search Console) and movement over time.',
    needGsc: 'Connect Google Search Console above to enable rank tracking.',
    snapshot: 'Snapshot now',
    snapshotting: 'Snapshotting…',
    noData: 'No data yet. The snapshot runs automatically every day; click "Snapshot now" to start.',
    lastSnapshot: 'Last snapshot',
    query: 'Query',
    position: 'Position',
    change: 'Change',
    clicks: 'Clicks',
    impressions: 'Impr.',
    stable: 'stable',
    newQ: 'new',
    countLabel: 'tracked queries',
  },
} as const

interface Mover {
  query: string
  page: string | null
  position: number
  previousPosition: number | null
  delta: number
  clicks: number
  impressions: number
  ctr: number
  snapshotDate: string
}

export function RankTrackingPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [movers, setMovers] = useState<Mover[] | null>(null)
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/rank-history', { credentials: 'include', cache: 'no-store' })
      // 404 = endpoint not registered (features.gscApi off) · 403/409 = not admin / not connected.
      if (res.status === 404 || res.status === 403 || res.status === 409) {
        setNotConnected(true)
        setMovers(null)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setMovers((json.movers as Mover[]) || [])
      setLastSnapshot(json.lastSnapshot || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const snapshotNow = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/rank-snapshot', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (res.status === 409) {
        setNotConnected(true)
        return
      }
      if (!res.ok) {
        setError(json.error || json.reason || `Error ${res.status}`)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  const card: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    backgroundColor: C.card,
    marginBottom: 20,
  }

  const btn: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.blue}`,
    backgroundColor: C.blue,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.6 : 1,
  }

  // delta > 0 = improved (moved up the SERP); < 0 = dropped.
  const renderDelta = (m: Mover) => {
    if (m.previousPosition === null) {
      return <span style={{ color: C.sub, fontSize: 11 }}>{s.newQ}</span>
    }
    if (Math.abs(m.delta) < 0.1) {
      return <span style={{ color: C.sub, fontSize: 11 }}>— {s.stable}</span>
    }
    const up = m.delta > 0
    return (
      <span style={{ color: up ? C.green : C.red, fontWeight: 700, fontSize: 12 }}>
        {up ? '▲' : '▼'} {Math.abs(m.delta).toFixed(1)}
      </span>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        {!notConnected && (
          <button type="button" onClick={snapshotNow} disabled={busy} style={btn}>
            {busy ? s.snapshotting : s.snapshot}
          </button>
        )}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}

      {notConnected && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.needGsc}</div>}

      {!notConnected && (
        <div style={{ marginTop: 12 }}>
          {lastSnapshot && (
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
              {s.lastSnapshot}: {new Date(lastSnapshot).toLocaleString(locale)}
              {movers ? ` · ${movers.length} ${s.countLabel}` : ''}
            </div>
          )}

          {loading && !movers && <div style={{ fontSize: 13, color: C.sub }}>…</div>}

          {movers && movers.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>{s.noData}</div>}

          {movers && movers.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.sub }}>
                    <th style={{ padding: '6px 8px' }}>{s.query}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.position}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.change}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.clicks}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.impressions}</th>
                  </tr>
                </thead>
                <tbody>
                  {movers.slice(0, 100).map((m, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                      <td style={{ padding: '6px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.query}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{m.position.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderDelta(m)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.clicks}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.impressions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
