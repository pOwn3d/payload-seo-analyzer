'use client'

import React, { useCallback, useEffect, useState } from 'react'

const C = {
  text: 'var(--theme-text, #1a1a1a)',
  sub: 'var(--theme-elevation-600, #6b7280)',
  card: 'var(--theme-elevation-50, #f9fafb)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
}

const S = {
  fr: {
    title: 'Santé du module SEO',
    subtitle: 'Configuration et état des intégrations / jobs (lecture seule).',
    ok: 'Tout est configuré ✓',
    ai: 'IA (Claude)',
    gsc: 'Search Console',
    psi: 'PageSpeed',
    alerts: 'Alertes',
    rank: 'Dernier relevé positions',
    none: 'jamais',
    warnings: 'À corriger',
  },
  en: {
    title: 'SEO module health',
    subtitle: 'Integration & background-job status (read-only).',
    ok: 'All configured ✓',
    ai: 'AI (Claude)',
    gsc: 'Search Console',
    psi: 'PageSpeed',
    alerts: 'Alerts',
    rank: 'Last rank snapshot',
    none: 'never',
    warnings: 'To fix',
  },
} as const

interface Health {
  ok: boolean
  config: { aiKey: boolean; pageSpeedKey: boolean; gscConfigured: boolean; alertWebhook: boolean; alertEmail: boolean }
  runtime: { gscConnected: boolean; lastRankSnapshot: string | null }
  warnings: string[]
}

export function HealthPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [h, setH] = useState<Health | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/seo-plugin/health', { credentials: 'include', cache: 'no-store' })
      if (res.ok) setH((await res.json()) as Health)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!h) return null

  const card: React.CSSProperties = { padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: C.card, marginBottom: 20 }
  const dot = (on: boolean): React.CSSProperties => ({
    display: 'inline-block', width: 8, height: 8, borderRadius: 999, marginRight: 6, backgroundColor: on ? C.green : C.sub,
  })
  const chip = (label: string, on: boolean) => (
    <span style={{ fontSize: 12, color: C.text, marginRight: 14, whiteSpace: 'nowrap' }}>
      <span style={dot(on)} />{label}
    </span>
  )

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: h.ok ? C.green : C.amber }}>
          {h.ok ? s.ok : `${h.warnings.length} ⚠`}
        </span>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', rowGap: 6 }}>
        {chip(s.ai, h.config.aiKey)}
        {chip(s.gsc, h.config.gscConfigured && h.runtime.gscConnected)}
        {chip(s.psi, h.config.pageSpeedKey)}
        {chip(s.alerts, h.config.alertWebhook || h.config.alertEmail)}
        <span style={{ fontSize: 12, color: C.sub, whiteSpace: 'nowrap' }}>
          {s.rank}: {h.runtime.lastRankSnapshot ? new Date(h.runtime.lastRankSnapshot).toLocaleDateString(locale) : s.none}
        </span>
      </div>

      {h.warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', marginBottom: 4 }}>{s.warnings}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            {h.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
