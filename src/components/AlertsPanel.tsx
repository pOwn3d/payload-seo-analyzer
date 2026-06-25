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

const S = {
  fr: {
    title: 'Monitoring & alertes',
    subtitle: 'Digest périodique : régressions de score, nouveaux 404, chutes de position (webhook / email).',
    notConfigured:
      "Aucun canal configuré. Définissez SEO_ALERT_WEBHOOK_URL et/ou SEO_ALERT_EMAIL côté serveur, puis activez features.alerts.",
    webhook: 'Webhook',
    email: 'Email',
    configured: 'configuré',
    missing: 'absent',
    preview: 'Aperçu',
    sendNow: 'Envoyer maintenant',
    sending: 'Envoi…',
    loading: 'Chargement…',
    noIssues: 'Aucun problème détecté sur la période. 🎉',
    scoreReg: 'Régressions de score',
    notFound: 'Nouveaux 404',
    rankDrops: 'Chutes de position',
    sent: 'Digest envoyé',
    nothingToSend: 'Rien à envoyer (aucun problème).',
    issues: 'problème(s)',
  },
  en: {
    title: 'Monitoring & alerts',
    subtitle: 'Periodic digest: score regressions, new 404s, ranking drops (webhook / email).',
    notConfigured:
      'No channel configured. Set SEO_ALERT_WEBHOOK_URL and/or SEO_ALERT_EMAIL on the server, then enable features.alerts.',
    webhook: 'Webhook',
    email: 'Email',
    configured: 'configured',
    missing: 'missing',
    preview: 'Preview',
    sendNow: 'Send now',
    sending: 'Sending…',
    loading: 'Loading…',
    noIssues: 'No issues for the period. 🎉',
    scoreReg: 'Score regressions',
    notFound: 'New 404s',
    rankDrops: 'Ranking drops',
    sent: 'Digest sent',
    nothingToSend: 'Nothing to send (no issues).',
    issues: 'issue(s)',
  },
} as const

interface Digest {
  since: string
  totalIssues: number
  scoreRegressions: Array<{ documentId: string; collection: string; from: number; to: number; drop: number }>
  newNotFound: Array<{ url: string; count: number; lastSeen: string }>
  rankDrops: Array<{ query: string; from: number; to: number; drop: number }>
}
interface Config {
  webhookConfigured: boolean
  emailConfigured: boolean
  scoreDrop: number
  positionDrop: number
  windowHours: number
}

export function AlertsPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [digest, setDigest] = useState<Digest | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/alerts-digest', { credentials: 'include', cache: 'no-store' })
      if (res.status === 404 || res.status === 403) {
        // Feature not enabled (features.alerts) or insufficient rights — show the hint, not an error.
        setConfig({ webhookConfigured: false, emailConfigured: false, scoreDrop: 0, positionDrop: 0, windowHours: 0 })
        setDigest(null)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setDigest(json.digest as Digest)
      setConfig(json.config as Config)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sendNow = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/seo-plugin/alerts-run', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setNotice(json.delivery?.sent ? s.sent : s.nothingToSend)
      if (json.digest) setDigest(json.digest as Digest)
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
  const chip = (ok: boolean, label: string): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    color: '#fff',
    backgroundColor: ok ? C.green : C.sub,
    marginRight: 6,
  })

  const hasChannel = config && (config.webhookConfigured || config.emailConfigured)

  const list = (title: string, rows: string[]) =>
    rows.length ? (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {title} <span style={{ color: C.amber }}>({rows.length})</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
          {rows.slice(0, 8).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        {hasChannel && (
          <button type="button" onClick={sendNow} disabled={busy} style={btn}>
            {busy ? s.sending : s.sendNow}
          </button>
        )}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}
      {notice && <div style={{ color: C.green, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{notice}</div>}

      {config && (
        <div style={{ marginTop: 12 }}>
          <span style={chip(config.webhookConfigured, s.webhook)}>
            {s.webhook}: {config.webhookConfigured ? s.configured : s.missing}
          </span>
          <span style={chip(config.emailConfigured, s.email)}>
            {s.email}: {config.emailConfigured ? s.configured : s.missing}
          </span>
        </div>
      )}

      {!loading && !hasChannel && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.notConfigured}</div>}

      {loading && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.loading}</div>}

      {digest && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>
            {digest.totalIssues} {s.issues}
          </div>
          {digest.totalIssues === 0 && <div style={{ marginTop: 8, fontSize: 13, color: C.sub }}>{s.noIssues}</div>}
          {list(
            s.scoreReg,
            digest.scoreRegressions.map((r) => `${r.collection}/${r.documentId} — ${r.from} → ${r.to} (−${r.drop})`),
          )}
          {list(s.notFound, digest.newNotFound.map((n) => `${n.url} — ${n.count}×`))}
          {list(s.rankDrops, digest.rankDrops.map((d) => `“${d.query}” — #${d.from} → #${d.to} (▼${d.drop})`))}
        </div>
      )}
    </div>
  )
}
