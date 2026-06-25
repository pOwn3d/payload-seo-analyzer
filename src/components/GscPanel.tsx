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
    title: 'Google Search Console',
    subtitle: 'Connexion OAuth pour importer automatiquement clics, impressions et positions réelles.',
    notConfigured:
      "Intégration non configurée. Activez features.gscApi et définissez GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET côté serveur, puis enregistrez l'URI de redirection dans Google Cloud.",
    redirectHint: 'URI de redirection à enregistrer :',
    connect: 'Connecter Google Search Console',
    disconnect: 'Déconnecter',
    connectedAs: 'Connecté',
    fetch: 'Récupérer les données (28 j)',
    fetching: 'Chargement…',
    byQuery: 'Par requête',
    byPage: 'Par page',
    query: 'Requête',
    page: 'Page',
    clicks: 'Clics',
    impressions: 'Impressions',
    ctr: 'CTR',
    position: 'Position',
    noData: 'Aucune donnée sur la période.',
    refreshStatus: 'Rafraîchir le statut',
    connectHint: 'Une fenêtre Google va s\'ouvrir. Après autorisation, revenez ici et rafraîchissez le statut.',
  },
  en: {
    title: 'Google Search Console',
    subtitle: 'OAuth connection to automatically import real clicks, impressions and positions.',
    notConfigured:
      'Integration not configured. Enable features.gscApi and set GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET on the server, then register the redirect URI in Google Cloud.',
    redirectHint: 'Redirect URI to register:',
    connect: 'Connect Google Search Console',
    disconnect: 'Disconnect',
    connectedAs: 'Connected',
    fetch: 'Fetch data (28 d)',
    fetching: 'Loading…',
    byQuery: 'By query',
    byPage: 'By page',
    query: 'Query',
    page: 'Page',
    clicks: 'Clicks',
    impressions: 'Impressions',
    ctr: 'CTR',
    position: 'Position',
    noData: 'No data for the period.',
    refreshStatus: 'Refresh status',
    connectHint: 'A Google window will open. After authorizing, come back here and refresh the status.',
  },
} as const

interface GscStatus {
  configured: boolean
  connected: boolean
  connectedEmail: string | null
  connectedAt: string | null
  propertyUrl: string | null
  redirectUri: string | null
}
interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function GscPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [status, setStatus] = useState<GscStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GscRow[] | null>(null)
  const [dimension, setDimension] = useState<'query' | 'page'>('query')
  const [dataLoading, setDataLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/gsc/status', { credentials: 'include' })
      if (res.status === 404) {
        // Endpoint not registered — features.gscApi is off. Show the "not configured" guidance.
        setStatus({ configured: false, connected: false, connectedEmail: null, connectedAt: null, propertyUrl: null, redirectUri: null })
        return
      }
      const json = await res.json()
      if (!res.ok) setError(json.error || `Error ${res.status}`)
      else setStatus(json as GscStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/gsc/auth', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setError(json.error || `Error ${res.status}`)
      else if (json.authUrl) window.open(json.authUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/seo-plugin/gsc/disconnect', { method: 'POST', credentials: 'include' })
      setRows(null)
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  const fetchData = async (dim: 'query' | 'page') => {
    setDimension(dim)
    setDataLoading(true)
    setError(null)
    setRows(null)
    try {
      const res = await fetch(`/api/seo-plugin/gsc/data?dimension=${dim}&rowLimit=50`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setError(json.error || `Error ${res.status}`)
      else setRows((json.rows as GscRow[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDataLoading(false)
    }
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${primary ? C.blue : C.border}`,
    backgroundColor: primary ? C.blue : C.bg,
    color: primary ? '#fff' : C.text,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    opacity: busy ? 0.6 : 1,
  })

  const card: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    backgroundColor: C.card,
    marginBottom: 20,
  }

  if (!status) {
    return (
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>…</div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 999,
            color: '#fff',
            backgroundColor: status.connected ? C.green : C.sub,
          }}
        >
          {status.connected ? '● ' + s.connectedAs : '○'}
        </span>
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}

      {!status.configured && (
        <div style={{ marginTop: 12, fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
          {s.notConfigured}
          {status.redirectUri && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontWeight: 700 }}>{s.redirectHint}</span>{' '}
              <code style={{ fontSize: 12 }}>{status.redirectUri}</code>
            </div>
          )}
        </div>
      )}

      {status.configured && !status.connected && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={connect} disabled={busy} style={btn(true)}>
            {s.connect}
          </button>
          <button type="button" onClick={() => void loadStatus()} disabled={busy} style={{ ...btn(false), marginLeft: 8 }}>
            {s.refreshStatus}
          </button>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>{s.connectHint}</div>
        </div>
      )}

      {status.configured && status.connected && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
            {s.connectedAs}
            {status.connectedEmail ? ` · ${status.connectedEmail}` : ''}
            {status.propertyUrl ? ` · ${status.propertyUrl}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" onClick={() => void fetchData('query')} disabled={dataLoading} style={btn(dimension === 'query')}>
              {s.byQuery}
            </button>
            <button type="button" onClick={() => void fetchData('page')} disabled={dataLoading} style={btn(dimension === 'page')}>
              {s.byPage}
            </button>
            <button type="button" onClick={disconnect} disabled={busy} style={btn(false)}>
              {s.disconnect}
            </button>
          </div>

          {dataLoading && <div style={{ fontSize: 13, color: C.sub }}>{s.fetching}</div>}

          {rows && rows.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>{s.noData}</div>}

          {rows && rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.sub }}>
                    <th style={{ padding: '6px 8px' }}>{dimension === 'query' ? s.query : s.page}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.clicks}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.impressions}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.ctr}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{s.position}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                      <td style={{ padding: '6px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.keys?.[0] || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{r.clicks}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.impressions}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{(r.ctr * 100).toFixed(1)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.position.toFixed(1)}</td>
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
