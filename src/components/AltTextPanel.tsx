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
  violet: '#7c3aed',
}

const S = {
  fr: {
    title: 'Alt-text IA des images',
    subtitle: "Génère l'attribut alt des images qui n'en ont pas (Claude vision), pour l'accessibilité et le SEO.",
    none: 'Toutes les images ont un alt. 🎉',
    forbidden: 'Réservé aux administrateurs.',
    disabled: 'Fonction IA désactivée (features.aiFeatures).',
    missing: 'image(s) sans alt',
    generate: 'Générer',
    generating: '…',
    apply: 'Appliquer',
    applied: 'Appliqué ✓',
    noKey: 'Clé API Claude requise (ANTHROPIC_API_KEY).',
    loading: 'Chargement…',
    refresh: 'Rafraîchir',
  },
  en: {
    title: 'AI image alt-text',
    subtitle: 'Generate alt text for images that lack one (Claude vision), for accessibility and SEO.',
    none: 'All images have alt text. 🎉',
    forbidden: 'Admins only.',
    disabled: 'AI feature disabled (features.aiFeatures).',
    missing: 'image(s) without alt',
    generate: 'Generate',
    generating: '…',
    apply: 'Apply',
    applied: 'Applied ✓',
    noKey: 'Claude API key required (ANTHROPIC_API_KEY).',
    loading: 'Loading…',
    refresh: 'Refresh',
  },
} as const

interface Item {
  id: string
  filename: string
  url: string
  mimeType: string
  alt: string
}
interface RowState {
  busy?: boolean
  alt?: string
  applied?: boolean
  error?: string
}

export function AltTextPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [items, setItems] = useState<Item[] | null>(null)
  const [collection, setCollection] = useState('media')
  const [missingCount, setMissingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<Record<string, RowState>>({})
  const [status, setStatus] = useState<'ok' | 'forbidden' | 'disabled'>('ok')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seo-plugin/alt-text-audit', { credentials: 'include', cache: 'no-store' })
      if (res.status === 404) {
        setStatus('disabled')
        return
      }
      if (res.status === 403) {
        setStatus('forbidden')
        return
      }
      const json = await res.json()
      setStatus('ok')
      setItems((json.items as Item[]) || [])
      setMissingCount(json.missingCount || 0)
      setCollection(json.collection || 'media')
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setRow = (id: string, patch: RowState) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const generate = async (item: Item) => {
    setRow(item.id, { busy: true, error: undefined })
    try {
      const res = await fetch('/api/seo-plugin/ai-alt-text', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, id: item.id, apply: false }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRow(item.id, { busy: false, error: json.code === 'no_api_key' ? s.noKey : json.error || `Error ${res.status}` })
        return
      }
      setRow(item.id, { busy: false, alt: json.alt })
    } catch (e) {
      setRow(item.id, { busy: false, error: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const apply = async (item: Item) => {
    const alt = state[item.id]?.alt
    if (!alt) return
    setRow(item.id, { busy: true, error: undefined })
    try {
      const res = await fetch('/api/seo-plugin/ai-alt-text', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, id: item.id, apply: true, altText: alt }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRow(item.id, { busy: false, error: json.error || `Error ${res.status}` })
        return
      }
      setRow(item.id, { busy: false, applied: true })
    } catch (e) {
      setRow(item.id, { busy: false, error: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const card: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    backgroundColor: C.card,
    marginBottom: 20,
  }
  const btn = (bg: string): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${bg}`,
    backgroundColor: bg,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  })

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{s.subtitle}</div>
        </div>
        {status === 'ok' && (
          <button type="button" onClick={() => void load()} style={btn(C.sub)}>
            {s.refresh}
          </button>
        )}
      </div>

      {status === 'forbidden' && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.forbidden}</div>}
      {status === 'disabled' && <div style={{ marginTop: 12, fontSize: 13, color: C.sub }}>{s.disabled}</div>}

      {status === 'ok' && (
        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ fontSize: 13, color: C.sub }}>{s.loading}</div>}
          {!loading && items && items.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>{s.none}</div>}
          {!loading && items && items.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
                {missingCount} {s.missing}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((item) => {
                  const rs = state[item.id] || {}
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: 8,
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        backgroundColor: C.bg,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${C.border}` }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.filename}
                        </div>
                        {rs.alt !== undefined ? (
                          <input
                            value={rs.alt}
                            onChange={(e) => setRow(item.id, { alt: e.target.value })}
                            disabled={rs.applied}
                            maxLength={125}
                            style={{
                              width: '100%',
                              marginTop: 4,
                              padding: '4px 8px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: `1px solid ${C.border}`,
                              backgroundColor: C.bg,
                              color: C.text,
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, fontStyle: 'italic' }}>—</div>
                        )}
                        {rs.error && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{rs.error}</div>}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {rs.applied ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{s.applied}</span>
                        ) : rs.alt !== undefined ? (
                          <button type="button" onClick={() => void apply(item)} disabled={rs.busy} style={btn(C.green)}>
                            {rs.busy ? s.generating : s.apply}
                          </button>
                        ) : (
                          <button type="button" onClick={() => void generate(item)} disabled={rs.busy} style={btn(C.violet)}>
                            {rs.busy ? s.generating : s.generate}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
