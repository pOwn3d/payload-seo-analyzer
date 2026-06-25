'use client'

import React, { useState } from 'react'

// Local design tokens (Payload CSS variables) — kept self-contained.
const C = {
  text: 'var(--theme-text, #1a1a1a)',
  sub: 'var(--theme-elevation-600, #6b7280)',
  card: 'var(--theme-elevation-50, #f9fafb)',
  bg: 'var(--theme-elevation-0, #fff)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
}

const S = {
  fr: {
    title: 'Core Web Vitals',
    subtitle: 'LCP / INP / CLS réels via PageSpeed Insights — informationnel, hors du score SEO (tie-breaker).',
    urlPlaceholder: 'https://votre-site.fr/page-a-tester',
    test: 'Tester',
    testing: 'Analyse en cours…',
    mobile: 'Mobile',
    desktop: 'Desktop',
    sourceField: 'Données terrain (utilisateurs réels, CrUX)',
    sourceLab: 'Données labo (Lighthouse)',
    noInp: 'INP nécessite des données terrain réelles (indisponible en labo).',
    inpHint: 'INP = la métrique CWV la plus souvent en échec en 2026 — à prioriser.',
    noKey: 'Astuce : définissez PAGESPEED_API_KEY côté serveur pour augmenter le quota.',
    good: 'Bon',
    ni: 'À améliorer',
    poor: 'Mauvais',
    na: '—',
  },
  en: {
    title: 'Core Web Vitals',
    subtitle: 'Real LCP / INP / CLS via PageSpeed Insights — informational, outside the SEO score (tie-breaker).',
    urlPlaceholder: 'https://your-site.com/page-to-test',
    test: 'Test',
    testing: 'Analyzing…',
    mobile: 'Mobile',
    desktop: 'Desktop',
    sourceField: 'Field data (real users, CrUX)',
    sourceLab: 'Lab data (Lighthouse)',
    noInp: 'INP needs real-user field data (not available in lab).',
    inpHint: 'INP is the most commonly failed Core Web Vital in 2026 — prioritize it.',
    noKey: 'Tip: set PAGESPEED_API_KEY on the server to raise the quota.',
    good: 'Good',
    ni: 'Needs improvement',
    poor: 'Poor',
    na: '—',
  },
} as const

type Rating = 'good' | 'needs-improvement' | 'poor' | 'unknown'

interface Metric {
  value: number | null
  unit: string
  rating?: Rating
  note?: string
  source?: string
}
interface CwvResponse {
  url: string
  strategy: string
  source: 'field' | 'lab'
  hasFieldData: boolean
  keyConfigured: boolean
  metrics: { lcp: Metric; inp: Metric; cls: Metric; tbt: Metric }
}

function ratingColor(r?: Rating): string {
  if (r === 'good') return C.green
  if (r === 'needs-improvement') return C.yellow
  if (r === 'poor') return C.red
  return C.sub
}

function formatValue(m: Metric, key: string): string {
  if (m.value === null || Number.isNaN(m.value)) return '—'
  if (key === 'cls') return m.value.toFixed(2)
  if (m.unit === 'ms') return m.value >= 1000 ? `${(m.value / 1000).toFixed(2)} s` : `${Math.round(m.value)} ms`
  return String(Math.round(m.value))
}

export function CoreWebVitalsPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [url, setUrl] = useState<string>(typeof window !== 'undefined' ? window.location.origin : '')
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CwvResponse | null>(null)

  const run = async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(
        `/api/seo-plugin/core-web-vitals?url=${encodeURIComponent(url)}&strategy=${strategy}`,
        { credentials: 'include' },
      )
      const json = await res.json()
      if (!res.ok) setError(json.error || `Error ${res.status}`)
      else setData(json as CwvResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const labelByKey: Record<string, string> = { lcp: 'LCP', inp: 'INP', cls: 'CLS' }

  const metricCard = (key: 'lcp' | 'inp' | 'cls', m: Metric) => (
    <div
      key={key}
      style={{
        flex: 1,
        minWidth: 120,
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        backgroundColor: C.bg,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {labelByKey[key]}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: ratingColor(m.rating), lineHeight: 1.2, marginTop: 4 }}>
        {formatValue(m, key)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: ratingColor(m.rating) }}>
        {m.rating === 'good' ? s.good : m.rating === 'needs-improvement' ? s.ni : m.rating === 'poor' ? s.poor : s.na}
      </div>
      {m.note && <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{s.noInp}</div>}
      {key === 'inp' && <div style={{ fontSize: 10, color: C.blue, marginTop: 4, fontWeight: 700 }}>{s.inpHint}</div>}
    </div>
  )

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 200,
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 13,
  }
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${active ? C.blue : C.border}`,
    backgroundColor: active ? C.blue : C.bg,
    color: active ? '#fff' : C.text,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        backgroundColor: C.card,
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 12 }}>{s.subtitle}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={s.urlPlaceholder}
          style={inputStyle}
        />
        <button type="button" onClick={() => setStrategy('mobile')} style={btnStyle(strategy === 'mobile')}>
          {s.mobile}
        </button>
        <button type="button" onClick={() => setStrategy('desktop')} style={btnStyle(strategy === 'desktop')}>
          {s.desktop}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={loading || !url}
          style={{ ...btnStyle(true), opacity: loading || !url ? 0.6 : 1 }}
        >
          {loading ? s.testing : s.test}
        </button>
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>{error}</div>}

      {data && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {metricCard('lcp', data.metrics.lcp)}
            {metricCard('inp', data.metrics.inp)}
            {metricCard('cls', data.metrics.cls)}
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
            {data.source === 'field' ? s.sourceField : s.sourceLab}
            {!data.keyConfigured && ` · ${s.noKey}`}
          </div>
        </div>
      )}
    </div>
  )
}
