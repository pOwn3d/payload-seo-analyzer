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
}

type Severity = 'pass' | 'warning' | 'fail'

interface DocRef {
  id?: string | number
  slug?: string
  title?: string
  collection?: string
  canonical?: string
}
interface IssueBlock {
  severity: Severity
  count: number
  docs?: DocRef[]
}
interface DuplicatedBlock {
  severity: Severity
  docCount: number
  groups: Array<{ canonical: string; count: number; docs: DocRef[] }>
}
interface HygieneResponse {
  summary?: { totalDocs?: number; totalFlagged?: number; overallSeverity?: Severity }
  hygiene?: {
    totalDocs: number
    overallSeverity: Severity
    noindex: IssueBlock & { total?: number; pct?: number; massNoindex?: boolean }
    canonical: {
      duplicated: DuplicatedBlock
      missing: IssueBlock
      dangling: IssueBlock
    }
  }
}

const S = {
  fr: {
    title: 'Hygiène d’indexation',
    subtitle: 'Audit cross-page : noindex de masse, canonical cassé / dupliqué / manquant. Le seul « crash » SEO on-page vraiment actionnable.',
    unavailable: 'Audit d’indexation indisponible (réservé aux admins).',
    loading: 'Analyse de l’indexation…',
    clean: 'Indexation saine — aucun problème détecté. 🎉',
    refresh: 'Rafraîchir',
    docs: 'documents analysés',
    noindex: 'En noindex',
    massNoindex: 'noindex de masse',
    dupCanonical: 'Canonical dupliqués',
    missingCanonical: 'Canonical manquants',
    danglingCanonical: 'Canonical cassés',
    page: 'Page',
    pass: 'OK',
    warning: 'À surveiller',
    fail: 'Critique',
  },
  en: {
    title: 'Indexation hygiene',
    subtitle: 'Cross-page audit: mass noindex, broken / duplicated / missing canonicals. The one truly actionable on-page SEO “crash”.',
    unavailable: 'Indexation audit unavailable (admin only).',
    loading: 'Analyzing indexation…',
    clean: 'Healthy indexation — no issues found. 🎉',
    refresh: 'Refresh',
    docs: 'documents analyzed',
    noindex: 'Noindexed',
    massNoindex: 'mass noindex',
    dupCanonical: 'Duplicated canonicals',
    missingCanonical: 'Missing canonicals',
    danglingCanonical: 'Broken canonicals',
    page: 'Page',
    pass: 'OK',
    warning: 'Watch',
    fail: 'Critical',
  },
} as const

function sevColor(sev?: Severity): string {
  if (sev === 'fail') return C.red
  if (sev === 'warning') return C.amber
  return C.green
}

export function IndexationHygienePanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [data, setData] = useState<HygieneResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/indexation-audit', { credentials: 'include', cache: 'no-store' })
      if (res.status === 404 || res.status === 403) {
        setUnavailable(true)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`)
        return
      }
      setUnavailable(false)
      setData(json as HygieneResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const h = data?.hygiene
  const sevLabel = (sev?: Severity) => (sev === 'fail' ? s.fail : sev === 'warning' ? s.warning : s.pass)

  const card: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    backgroundColor: C.card,
    marginBottom: 20,
  }
  const btn = (bg: string): React.CSSProperties => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${bg}`,
    backgroundColor: bg,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  })

  const counter = (label: string, value: number, color: string) => (
    <div key={label} style={{ minWidth: 120 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
    </div>
  )

  const docList = (docs: DocRef[] | undefined, color: string) =>
    docs && docs.length > 0 ? (
      <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11, color: C.sub }}>
        {docs.slice(0, 8).map((d, i) => (
          <li key={`${d.slug || d.id || i}`} style={{ color }}>
            {d.title || d.slug || String(d.id)}
            {d.canonical ? <span style={{ color: C.sub }}> → {d.canonical}</span> : null}
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
            {s.title}
            {h && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: sevColor(h.overallSeverity), padding: '2px 8px', borderRadius: 999 }}>
                {sevLabel(h.overallSeverity)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        {!unavailable && (
          <button type="button" onClick={() => void load()} style={btn(C.sub)}>
            {s.refresh}
          </button>
        )}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}
      {unavailable && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.unavailable}</div>}
      {loading && !unavailable && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.loading}</div>}

      {!loading && !unavailable && h && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
            {counter(s.noindex, h.noindex?.count ?? 0, h.noindex?.massNoindex ? C.red : C.amber)}
            {counter(s.dupCanonical, h.canonical?.duplicated?.docCount ?? 0, sevColor(h.canonical?.duplicated?.severity))}
            {counter(s.missingCanonical, h.canonical?.missing?.count ?? 0, sevColor(h.canonical?.missing?.severity))}
            {counter(s.danglingCanonical, h.canonical?.dangling?.count ?? 0, sevColor(h.canonical?.dangling?.severity))}
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
            {h.totalDocs} {s.docs}
            {h.noindex?.massNoindex ? ` · ${s.massNoindex} (${Math.round((h.noindex.pct ?? 0) * 100)}%)` : ''}
          </div>

          {(h.canonical?.duplicated?.docCount ?? 0) === 0 &&
          (h.canonical?.missing?.count ?? 0) === 0 &&
          (h.canonical?.dangling?.count ?? 0) === 0 &&
          (h.noindex?.count ?? 0) === 0 ? (
            <div style={{ fontSize: 13, color: C.green }}>{s.clean}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(h.canonical?.dangling?.count ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(h.canonical.dangling.severity) }}>{s.danglingCanonical}</div>
                  {docList(h.canonical.dangling.docs, C.text)}
                </div>
              )}
              {(h.canonical?.duplicated?.docCount ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(h.canonical.duplicated.severity) }}>{s.dupCanonical}</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11, color: C.sub }}>
                    {(h.canonical.duplicated.groups || []).slice(0, 6).map((g, i) => (
                      <li key={`${g.canonical || i}`}>
                        <span style={{ color: C.text }}>{g.canonical}</span> — {g.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(h.canonical?.missing?.count ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(h.canonical.missing.severity) }}>{s.missingCanonical}</div>
                  {docList(h.canonical.missing.docs, C.text)}
                </div>
              )}
              {(h.noindex?.count ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: h.noindex.massNoindex ? C.red : C.amber }}>{s.noindex}</div>
                  {docList(h.noindex.docs, C.text)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
