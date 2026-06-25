'use client'

import React, { useState } from 'react'

const C = {
  text: 'var(--theme-text, #1a1a1a)',
  sub: 'var(--theme-elevation-600, #6b7280)',
  card: 'var(--theme-elevation-50, #f9fafb)',
  bg: 'var(--theme-elevation-0, #fff)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  violet: '#7c3aed',
  red: '#ef4444',
  blue: '#3b82f6',
}

const S = {
  fr: {
    title: 'Brief de contenu IA',
    subtitle: 'Génère un plan rédactionnel optimisé pour un mot-clé (plan, entités, questions, longueur cible).',
    placeholder: 'Mot-clé cible (ex : plombier paris)',
    generate: 'Générer le brief',
    generating: 'Génération…',
    outline: 'Plan suggéré',
    entities: 'Entités / termes à couvrir',
    questions: 'Questions à traiter',
    links: 'Idées de liens internes',
    words: 'Longueur recommandée',
    wordsUnit: 'mots',
    notes: 'Conseils',
    noKey: 'Clé API Claude requise (ANTHROPIC_API_KEY).',
    disabled: 'Fonction IA désactivée (features.aiFeatures).',
  },
  en: {
    title: 'AI content brief',
    subtitle: 'Generate an optimized writing brief for a keyword (outline, entities, questions, target length).',
    placeholder: 'Target keyword (e.g. paris plumber)',
    generate: 'Generate brief',
    generating: 'Generating…',
    outline: 'Suggested outline',
    entities: 'Entities / terms to cover',
    questions: 'Questions to answer',
    links: 'Internal link ideas',
    words: 'Recommended length',
    wordsUnit: 'words',
    notes: 'Tips',
    noKey: 'Claude API key required (ANTHROPIC_API_KEY).',
    disabled: 'AI feature disabled (features.aiFeatures).',
  },
} as const

interface Brief {
  outline: Array<{ level: 'h2' | 'h3'; text: string }>
  entities: string[]
  questions: string[]
  internalLinkIdeas: string[]
  recommendedWordCount: number
  notes: string[]
}

export function ContentBriefPanel({ locale }: { locale: 'fr' | 'en' }) {
  const s = S[locale] ?? S.fr
  const [keyword, setKeyword] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!keyword.trim()) return
    setBusy(true)
    setError(null)
    setBrief(null)
    try {
      const res = await fetch('/api/seo-plugin/ai-content-brief', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      })
      if (res.status === 404) {
        setError(s.disabled)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.code === 'no_api_key' ? s.noKey : json.error || `Error ${res.status}`)
        return
      }
      setBrief(json.brief as Brief)
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
  const chip: React.CSSProperties = {
    display: 'inline-block',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.12)',
    color: C.blue,
    border: `1px solid ${C.border}`,
    margin: '0 6px 6px 0',
  }
  const h4: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: C.text, margin: '14px 0 6px', textTransform: 'uppercase' }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.title}</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 12 }}>{s.subtitle}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void generate()
          }}
          placeholder={s.placeholder}
          style={{
            flex: 1,
            minWidth: 220,
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            backgroundColor: C.bg,
            color: C.text,
          }}
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !keyword.trim()}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${C.violet}`,
            backgroundColor: C.violet,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: busy || !keyword.trim() ? 'not-allowed' : 'pointer',
            opacity: busy || !keyword.trim() ? 0.6 : 1,
          }}
        >
          {busy ? s.generating : `✨ ${s.generate}`}
        </button>
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}

      {brief && (
        <div style={{ marginTop: 8 }}>
          {brief.recommendedWordCount > 0 && (
            <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>
              {s.words}: <b style={{ color: C.text }}>~{brief.recommendedWordCount} {s.wordsUnit}</b>
            </div>
          )}

          {brief.outline.length > 0 && (
            <>
              <div style={h4}>{s.outline}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                {brief.outline.map((o, i) => (
                  <li key={i} style={{ marginLeft: o.level === 'h3' ? 18 : 0, color: o.level === 'h3' ? C.sub : C.text, fontWeight: o.level === 'h2' ? 700 : 400 }}>
                    {o.text}
                  </li>
                ))}
              </ul>
            </>
          )}

          {brief.entities.length > 0 && (
            <>
              <div style={h4}>{s.entities}</div>
              <div>{brief.entities.map((e, i) => <span key={i} style={chip}>{e}</span>)}</div>
            </>
          )}

          {brief.questions.length > 0 && (
            <>
              <div style={h4}>{s.questions}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                {brief.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </>
          )}

          {brief.internalLinkIdeas.length > 0 && (
            <>
              <div style={h4}>{s.links}</div>
              <div>{brief.internalLinkIdeas.map((l, i) => <span key={i} style={chip}>{l}</span>)}</div>
            </>
          )}

          {brief.notes.length > 0 && (
            <>
              <div style={h4}>{s.notes}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                {brief.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
