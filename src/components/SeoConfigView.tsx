'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  TITLE_LENGTH_MIN,
  TITLE_LENGTH_MAX,
  META_DESC_LENGTH_MIN,
  META_DESC_LENGTH_MAX,
  MIN_WORDS_GENERIC,
  MIN_WORDS_POST,
  KEYWORD_DENSITY_MIN,
  KEYWORD_DENSITY_MAX,
  FLESCH_SCORE_PASS,
  SLUG_MAX_LENGTH,
} from '../constants.js'

// ---------------------------------------------------------------------------
// Design tokens — uses Payload CSS variables for theme compatibility
// ---------------------------------------------------------------------------
const V = {
  text: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  bg: 'var(--theme-elevation-0, #fff)',
  bgCard: 'var(--theme-elevation-50, #f9fafb)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  borderDark: 'var(--theme-border-color, #000)',
  green: '#22c55e',
  red: '#ef4444',
  cyan: '#00E5FF',
  yellow: '#FFD600',
  blue: '#3b82f6',
}

// ---------------------------------------------------------------------------
// Rule group definitions (16 engine groups + accessibility)
// ---------------------------------------------------------------------------
const RULE_GROUPS: Array<{ value: string; label: string }> = [
  { value: 'title', label: 'Titre' },
  { value: 'meta-description', label: 'Meta description' },
  { value: 'url', label: 'URL / Slug' },
  { value: 'headings', label: 'Titres H1-H6' },
  { value: 'content', label: 'Contenu' },
  { value: 'images', label: 'Images' },
  { value: 'linking', label: 'Liens' },
  { value: 'social', label: 'Reseaux sociaux' },
  { value: 'schema', label: 'Donnees structurees' },
  { value: 'readability', label: 'Lisibilite' },
  { value: 'quality', label: 'Qualite' },
  { value: 'secondary-keywords', label: 'Mots-cles secondaires' },
  { value: 'cornerstone', label: 'Contenu pilier' },
  { value: 'freshness', label: 'Fraicheur' },
  { value: 'technical', label: 'Technique' },
  { value: 'accessibility', label: 'Accessibilite' },
  { value: 'ecommerce', label: 'E-commerce' },
]

// ---------------------------------------------------------------------------
// Threshold definitions (field name, label, default value)
// ---------------------------------------------------------------------------
const THRESHOLD_FIELDS: Array<{ name: string; label: string; defaultValue: number }> = [
  { name: 'titleLengthMin', label: 'Titre — longueur min', defaultValue: TITLE_LENGTH_MIN },
  { name: 'titleLengthMax', label: 'Titre — longueur max', defaultValue: TITLE_LENGTH_MAX },
  { name: 'metaDescLengthMin', label: 'Meta desc — longueur min', defaultValue: META_DESC_LENGTH_MIN },
  { name: 'metaDescLengthMax', label: 'Meta desc — longueur max', defaultValue: META_DESC_LENGTH_MAX },
  { name: 'minWordsGeneric', label: 'Mots min (pages)', defaultValue: MIN_WORDS_GENERIC },
  { name: 'minWordsPost', label: 'Mots min (articles)', defaultValue: MIN_WORDS_POST },
  { name: 'keywordDensityMin', label: 'Densite mot-cle min (%)', defaultValue: KEYWORD_DENSITY_MIN },
  { name: 'keywordDensityMax', label: 'Densite mot-cle max (%)', defaultValue: KEYWORD_DENSITY_MAX },
  { name: 'fleschScorePass', label: 'Score Flesch min', defaultValue: FLESCH_SCORE_PASS },
  { name: 'slugMaxLength', label: 'Longueur max slug', defaultValue: SLUG_MAX_LENGTH },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PriorityOverride {
  slugPattern: string
  priority: number
  changefreq?: string
}

interface SitemapSettings {
  excludedSlugs?: Array<{ slug: string; id?: string }>
  defaultChangefreq?: string
  defaultPriority?: number | null
  priorityOverrides?: PriorityOverride[]
}

interface SitemapPreviewEntry {
  url: string
  collection: string
  title: string
  changefreq: string
  priority: number
  lastmod: string
}

interface SitemapPreviewData {
  config: {
    excludedSlugs: string[]
    defaultChangefreq: string
    defaultPriority: number
    priorityOverrides: PriorityOverride[]
  }
  preview: SitemapPreviewEntry[]
  stats: {
    totalPages: number
    excludedCount: number
    includedCount: number
  }
}

interface BreadcrumbSettings {
  enabled?: boolean
  homeLabel?: string
  separator?: string
  showOnHome?: boolean
}

interface Settings {
  siteName?: string
  ignoredSlugs?: Array<{ slug: string; id?: string }>
  disabledRules?: string[]
  thresholds?: Record<string, number | null | undefined>
  sitemap?: SitemapSettings
  breadcrumb?: BreadcrumbSettings
}

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------
const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontSize: 13,
  color: V.text,
  backgroundColor: V.bg,
  width: '100%',
  boxSizing: 'border-box',
}

const cardStyle: React.CSSProperties = {
  border: `1px solid ${V.border}`,
  borderRadius: 10,
  backgroundColor: V.bgCard,
  marginBottom: 20,
  overflow: 'hidden',
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: `1px solid ${V.border}`,
  fontWeight: 700,
  fontSize: 14,
  color: V.text,
  backgroundColor: V.bg,
}

const cardBodyStyle: React.CSSProperties = {
  padding: '18px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: V.textSecondary,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

// ---------------------------------------------------------------------------
// Toast sub-component
// ---------------------------------------------------------------------------
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        borderRadius: 8,
        backgroundColor: type === 'success' ? V.green : V.red,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SeoConfigView component
// ---------------------------------------------------------------------------
export function SeoConfigView() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Sitemap state
  const [newSitemapSlug, setNewSitemapSlug] = useState('')
  const [sitemapPreview, setSitemapPreview] = useState<SitemapPreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Slug input state + autocomplete
  const [newSlug, setNewSlug] = useState('')
  const [allSlugs, setAllSlugs] = useState<Array<{ slug: string; title: string; collection: string }>>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const slugInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/settings', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSettings(data.settings || {})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Fetch all page slugs for autocomplete
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/seo-plugin/audit?limit=500', { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const slugs = (data.results || []).map((r: { slug: string; title: string; collection: string }) => ({
            slug: r.slug,
            title: r.title,
            collection: r.collection,
          }))
          setAllSlugs(slugs)
        }
      } catch {
        // Non-critical
      }
    })()
  }, [])

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node) &&
        slugInputRef.current &&
        !slugInputRef.current.contains(e.target as Node)
      ) {
        setShowAutocomplete(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filtered slugs for autocomplete
  const filteredSlugs = useMemo(() => {
    const query = newSlug.trim().toLowerCase()
    const ignoredSet = new Set((settings.ignoredSlugs || []).map((s) => s.slug))
    return allSlugs
      .filter((s) => !ignoredSet.has(s.slug))
      .filter((s) => !query || s.slug.includes(query) || s.title.toLowerCase().includes(query))
      .slice(0, 8)
  }, [newSlug, allSlugs, settings.ignoredSlugs])

  // Save settings
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/seo-plugin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        setToast({ message: 'Configuration sauvegardee', type: 'success' })
      } else {
        throw new Error('Erreur serveur')
      }
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : 'Erreur de sauvegarde',
        type: 'error',
      })
    }
    setSaving(false)
  }, [settings])

  // Helpers
  const addSlug = useCallback(() => {
    const trimmed = newSlug.trim().toLowerCase().replace(/^\/+/, '')
    if (!trimmed) return
    const current = settings.ignoredSlugs || []
    if (current.some((s) => s.slug === trimmed)) return
    setSettings((prev) => ({
      ...prev,
      ignoredSlugs: [...(prev.ignoredSlugs || []), { slug: trimmed }],
    }))
    setNewSlug('')
  }, [newSlug, settings.ignoredSlugs])

  const removeSlug = useCallback((slug: string) => {
    setSettings((prev) => ({
      ...prev,
      ignoredSlugs: (prev.ignoredSlugs || []).filter((s) => s.slug !== slug),
    }))
  }, [])

  const toggleRule = useCallback((rule: string) => {
    setSettings((prev) => {
      const current = prev.disabledRules || []
      const isDisabled = current.includes(rule)
      return {
        ...prev,
        disabledRules: isDisabled ? current.filter((r) => r !== rule) : [...current, rule],
      }
    })
  }, [])

  const updateThreshold = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      thresholds: {
        ...(prev.thresholds || {}),
        [field]: value === '' ? null : Number(value),
      },
    }))
  }, [])

  // Sitemap helpers
  const addSitemapSlug = useCallback(() => {
    const trimmed = newSitemapSlug.trim().toLowerCase().replace(/^\/+/, '')
    if (!trimmed) return
    const current = settings.sitemap?.excludedSlugs || []
    if (current.some((s) => s.slug === trimmed)) return
    setSettings((prev) => ({
      ...prev,
      sitemap: {
        ...(prev.sitemap || {}),
        excludedSlugs: [...(prev.sitemap?.excludedSlugs || []), { slug: trimmed }],
      },
    }))
    setNewSitemapSlug('')
  }, [newSitemapSlug, settings.sitemap?.excludedSlugs])

  const removeSitemapSlug = useCallback((slug: string) => {
    setSettings((prev) => ({
      ...prev,
      sitemap: {
        ...(prev.sitemap || {}),
        excludedSlugs: (prev.sitemap?.excludedSlugs || []).filter((s) => s.slug !== slug),
      },
    }))
  }, [])

  const updateSitemapField = useCallback((field: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      sitemap: {
        ...(prev.sitemap || {}),
        [field]: value,
      },
    }))
  }, [])

  const addPriorityOverride = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      sitemap: {
        ...(prev.sitemap || {}),
        priorityOverrides: [
          ...(prev.sitemap?.priorityOverrides || []),
          { slugPattern: '', priority: 0.5 },
        ],
      },
    }))
  }, [])

  const removePriorityOverride = useCallback((index: number) => {
    setSettings((prev) => ({
      ...prev,
      sitemap: {
        ...(prev.sitemap || {}),
        priorityOverrides: (prev.sitemap?.priorityOverrides || []).filter((_, i) => i !== index),
      },
    }))
  }, [])

  const updatePriorityOverride = useCallback((index: number, field: string, value: unknown) => {
    setSettings((prev) => {
      const overrides = [...(prev.sitemap?.priorityOverrides || [])]
      if (overrides[index]) {
        overrides[index] = { ...overrides[index], [field]: value }
      }
      return {
        ...prev,
        sitemap: {
          ...(prev.sitemap || {}),
          priorityOverrides: overrides,
        },
      }
    })
  }, [])

  // Breadcrumb helpers
  const updateBreadcrumbField = useCallback((field: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      breadcrumb: {
        ...(prev.breadcrumb || {}),
        [field]: value,
      },
    }))
  }, [])

  const fetchSitemapPreview = useCallback(async () => {
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/seo-plugin/sitemap-config', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSitemapPreview(data)
      setShowPreview(true)
    } catch {
      // Non-critical
    }
    setLoadingPreview(false)
  }, [])

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          color: V.textSecondary,
          fontSize: 14,
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        Chargement de la configuration...
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        <div style={{ color: V.red, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Erreur de chargement
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>{error}</div>
        <button
          onClick={fetchSettings}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '20px 24px',
        maxWidth: 900,
        margin: '0 auto',
        fontFamily: 'var(--font-body, system-ui)',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: V.text }}>
            <span style={{ marginRight: 8 }}>&#9881;</span>
            Configuration SEO
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            Parametres globaux du moteur d&apos;analyse SEO
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...btnBase,
            backgroundColor: saving ? V.textSecondary : V.green,
            color: '#fff',
            border: 'none',
            padding: '8px 20px',
            fontSize: 12,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Section 1: General */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>General</div>
        <div style={cardBodyStyle}>
          <label style={labelStyle}>Nom du site</label>
          <input
            type="text"
            value={settings.siteName || ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
            placeholder="Ex: My Website"
            style={inputStyle}
          />
          <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4 }}>
            Utilise pour la verification de marque dans les titres (eviter la duplication du nom du site)
          </div>
        </div>
      </div>

      {/* Section 2: Pages ignorees */}
      <div style={{ ...cardStyle, overflow: 'visible' }}>
        <div style={cardHeaderStyle}>Pages ignorees</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 12 }}>
            Pages exclues de l&apos;audit SEO global (ex: mentions-legales, cgv, plan-du-site)
          </div>

          {/* Add slug input with autocomplete */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={slugInputRef}
                type="text"
                value={newSlug}
                onChange={(e) => {
                  setNewSlug(e.target.value)
                  setShowAutocomplete(true)
                }}
                onFocus={() => setShowAutocomplete(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSlug()
                    setShowAutocomplete(false)
                  }
                  if (e.key === 'Escape') {
                    setShowAutocomplete(false)
                  }
                }}
                placeholder="slug-de-la-page"
                style={inputStyle}
              />
              {showAutocomplete && filteredSlugs.length > 0 && (
                <div
                  ref={autocompleteRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: V.bg,
                    border: `1px solid ${V.border}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {filteredSlugs.map((item) => (
                    <div
                      key={`${item.collection}-${item.slug}`}
                      onClick={() => {
                        setNewSlug(item.slug)
                        setShowAutocomplete(false)
                        // Auto-add
                        const trimmed = item.slug.trim().toLowerCase().replace(/^\/+/, '')
                        if (trimmed && !(settings.ignoredSlugs || []).some((s) => s.slug === trimmed)) {
                          setSettings((prev) => ({
                            ...prev,
                            ignoredSlugs: [...(prev.ignoredSlugs || []), { slug: trimmed }],
                          }))
                        }
                        setNewSlug('')
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: `1px solid ${V.border}`,
                        fontSize: 12,
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(59,130,246,0.06)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: V.blue }}>
                          /{item.slug}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: item.collection === 'pages' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                            color: item.collection === 'pages' ? V.blue : V.green,
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.collection}
                        </span>
                      </div>
                      {item.title && (
                        <div style={{ fontSize: 11, color: V.textSecondary, marginTop: 2 }}>
                          {item.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                addSlug()
                setShowAutocomplete(false)
              }}
              style={{
                ...btnBase,
                backgroundColor: V.blue,
                color: '#fff',
                border: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Ajouter
            </button>
          </div>

          {/* Slug chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.ignoredSlugs || []).length === 0 && (
              <div style={{ fontSize: 11, color: V.textSecondary, fontStyle: 'italic' }}>
                Aucun slug ignore
              </div>
            )}
            {(settings.ignoredSlugs || []).map((item) => (
              <span
                key={item.slug}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(59,130,246,0.1)',
                  color: V.blue,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                /{item.slug}
                <span
                  onClick={() => removeSlug(item.slug)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 800,
                    color: V.red,
                    lineHeight: 1,
                    fontFamily: 'system-ui',
                  }}
                  title="Supprimer"
                >
                  &times;
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Regles desactivees */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Regles desactivees</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            Cochez les groupes de regles a ignorer lors de l&apos;analyse. Les regles desactivees ne seront pas executees.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
            }}
          >
            {RULE_GROUPS.map((group) => {
              const isDisabled = (settings.disabledRules || []).includes(group.value)
              return (
                <label
                  key={group.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: `1px solid ${isDisabled ? V.red : V.border}`,
                    backgroundColor: isDisabled ? 'rgba(239,68,68,0.06)' : V.bg,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isDisabled ? 700 : 500,
                    color: isDisabled ? V.red : V.text,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isDisabled}
                    onChange={() => toggleRule(group.value)}
                    style={{ accentColor: V.red }}
                  />
                  {group.label}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section 4: Seuils personnalises */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Seuils personnalises</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            Laissez vide pour utiliser les valeurs par defaut. Les seuils contrôlent les limites min/max de chaque regle.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {THRESHOLD_FIELDS.map((field) => {
              const currentValue = settings.thresholds?.[field.name]
              return (
                <div key={field.name}>
                  <label style={labelStyle}>{field.label}</label>
                  <input
                    type="number"
                    value={currentValue != null ? String(currentValue) : ''}
                    onChange={(e) => updateThreshold(field.name, e.target.value)}
                    placeholder={`Defaut: ${field.defaultValue}`}
                    step={field.name.includes('Density') ? '0.1' : '1'}
                    style={inputStyle}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section 5: Configuration Sitemap */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Configuration Sitemap</div>
        <div style={cardBodyStyle}>
          {/* Slugs exclus du sitemap */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Slugs exclus du sitemap</label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginBottom: 8 }}>
              Pages a exclure de la generation du sitemap (ex: mentions-legales, cgv, plan-du-site)
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="text"
                value={newSitemapSlug}
                onChange={(e) => setNewSitemapSlug(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSitemapSlug()
                  }
                }}
                placeholder="slug-a-exclure"
                style={inputStyle}
              />
              <button
                onClick={addSitemapSlug}
                style={{
                  ...btnBase,
                  backgroundColor: V.blue,
                  color: '#fff',
                  border: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(settings.sitemap?.excludedSlugs || []).length === 0 && (
                <div style={{ fontSize: 11, color: V.textSecondary, fontStyle: 'italic' }}>
                  Aucun slug exclu
                </div>
              )}
              {(settings.sitemap?.excludedSlugs || []).map((item) => (
                <span
                  key={item.slug}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    color: V.blue,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                  }}
                >
                  /{item.slug}
                  <span
                    onClick={() => removeSitemapSlug(item.slug)}
                    style={{
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 800,
                      color: V.red,
                      lineHeight: 1,
                      fontFamily: 'system-ui',
                    }}
                    title="Supprimer"
                  >
                    &times;
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Frequence par defaut + Priorite par defaut */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <label style={labelStyle}>Frequence par defaut</label>
              <select
                value={settings.sitemap?.defaultChangefreq || 'weekly'}
                onChange={(e) => updateSitemapField('defaultChangefreq', e.target.value)}
                style={inputStyle}
              >
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
                <option value="yearly">Annuel</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priorite par defaut</label>
              <input
                type="number"
                value={settings.sitemap?.defaultPriority != null ? String(settings.sitemap.defaultPriority) : ''}
                onChange={(e) =>
                  updateSitemapField(
                    'defaultPriority',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                placeholder="0.5"
                min={0}
                max={1}
                step={0.1}
                style={inputStyle}
              />
              <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
                Valeur entre 0 et 1 (defaut: 0.5)
              </div>
            </div>
          </div>

          {/* Overrides de priorite */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Overrides de priorite</label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginBottom: 8 }}>
              Definir la priorite pour des patterns de slugs specifiques (ex: home, blog/*, services/*)
            </div>

            {(settings.sitemap?.priorityOverrides || []).map((override, idx) => (
              <div
                key={`override-${idx}`}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={override.slugPattern}
                  onChange={(e) => updatePriorityOverride(idx, 'slugPattern', e.target.value)}
                  placeholder="Pattern (ex: blog/*)"
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  type="number"
                  value={String(override.priority)}
                  onChange={(e) =>
                    updatePriorityOverride(idx, 'priority', Number(e.target.value))
                  }
                  min={0}
                  max={1}
                  step={0.1}
                  placeholder="Priorite"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={override.changefreq || ''}
                  onChange={(e) =>
                    updatePriorityOverride(
                      idx,
                      'changefreq',
                      e.target.value || undefined,
                    )
                  }
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Defaut</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                </select>
                <button
                  onClick={() => removePriorityOverride(idx)}
                  style={{
                    ...btnBase,
                    padding: '6px 10px',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    color: V.red,
                    border: `1px solid rgba(239,68,68,0.2)`,
                    flexShrink: 0,
                  }}
                  title="Supprimer"
                >
                  &times;
                </button>
              </div>
            ))}

            <button
              onClick={addPriorityOverride}
              style={{
                ...btnBase,
                backgroundColor: V.bgCard,
                color: V.blue,
                border: `1px dashed ${V.border}`,
                width: '100%',
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              + Ajouter un override
            </button>
          </div>

          {/* Preview du sitemap */}
          <div>
            <label style={labelStyle}>Apercu du sitemap</label>
            <button
              onClick={fetchSitemapPreview}
              disabled={loadingPreview}
              style={{
                ...btnBase,
                backgroundColor: V.bgCard,
                color: V.text,
                opacity: loadingPreview ? 0.6 : 1,
              }}
            >
              {loadingPreview ? 'Chargement...' : showPreview ? 'Rafraichir l\'apercu' : 'Voir l\'apercu'}
            </button>

            {showPreview && sitemapPreview && (
              <div style={{ marginTop: 12 }}>
                {/* Preview stats */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 10,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: V.text }}>
                    {sitemapPreview.stats.totalPages} pages
                  </span>
                  <span style={{ color: V.green }}>
                    {sitemapPreview.stats.includedCount} incluses
                  </span>
                  <span style={{ color: V.red }}>
                    {sitemapPreview.stats.excludedCount} exclues
                  </span>
                </div>

                {/* Preview table */}
                <div
                  style={{
                    border: `1px solid ${V.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    maxHeight: 400,
                    overflowY: 'auto',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 80px 80px 120px',
                      gap: 8,
                      padding: '8px 12px',
                      backgroundColor: V.bgCard,
                      borderBottom: `1px solid ${V.border}`,
                      fontSize: 10,
                      fontWeight: 700,
                      color: V.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    <span>URL</span>
                    <span>Collection</span>
                    <span>Priorite</span>
                    <span>Frequence</span>
                    <span>Derniere modif.</span>
                  </div>
                  {sitemapPreview.preview.map((entry, idx) => (
                    <div
                      key={`preview-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 80px 80px 120px',
                        gap: 8,
                        padding: '6px 12px',
                        borderBottom: `1px solid ${V.border}`,
                        fontSize: 11,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: V.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={entry.url}
                      >
                        {entry.url}
                      </span>
                      <span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor:
                              entry.collection === 'pages'
                                ? 'rgba(59,130,246,0.1)'
                                : 'rgba(34,197,94,0.1)',
                            color: entry.collection === 'pages' ? V.blue : V.green,
                            textTransform: 'uppercase',
                          }}
                        >
                          {entry.collection}
                        </span>
                      </span>
                      <span style={{ fontWeight: 700, color: V.text }}>{entry.priority}</span>
                      <span style={{ fontSize: 10, color: V.textSecondary }}>
                        {entry.changefreq}
                      </span>
                      <span style={{ fontSize: 10, color: V.textSecondary }}>
                        {entry.lastmod ? new Date(entry.lastmod).toLocaleDateString('fr-FR') : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 6: Configuration Breadcrumb */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Configuration Breadcrumb</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            Configuration des fils d&apos;Ariane (breadcrumbs) et du schema JSON-LD BreadcrumbList.
          </div>

          {/* Enabled checkbox */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${settings.breadcrumb?.enabled !== false ? V.green : V.border}`,
                backgroundColor: settings.breadcrumb?.enabled !== false ? 'rgba(34,197,94,0.06)' : V.bg,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: settings.breadcrumb?.enabled !== false ? V.green : V.text,
              }}
            >
              <input
                type="checkbox"
                checked={settings.breadcrumb?.enabled !== false}
                onChange={(e) => updateBreadcrumbField('enabled', e.target.checked)}
                style={{ accentColor: V.green }}
              />
              Activer les breadcrumbs
            </label>
          </div>

          {/* Home label + Separator */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Label page d&apos;accueil</label>
              <input
                type="text"
                value={settings.breadcrumb?.homeLabel || 'Accueil'}
                onChange={(e) => updateBreadcrumbField('homeLabel', e.target.value)}
                placeholder="Accueil"
                style={inputStyle}
              />
              <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
                Texte affiche pour la page d&apos;accueil dans le breadcrumb
              </div>
            </div>
            <div>
              <label style={labelStyle}>Separateur</label>
              <select
                value={settings.breadcrumb?.separator || '>'}
                onChange={(e) => updateBreadcrumbField('separator', e.target.value)}
                style={inputStyle}
              >
                <option value=">">&gt;</option>
                <option value="/">/</option>
                <option value={'\u00BB'}>{'\u00BB'}</option>
                <option value={'\u2192'}>{'\u2192'}</option>
              </select>
              <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
                Caractere utilise entre les elements du breadcrumb
              </div>
            </div>
          </div>

          {/* Show on home checkbox */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${settings.breadcrumb?.showOnHome ? V.blue : V.border}`,
                backgroundColor: settings.breadcrumb?.showOnHome ? 'rgba(59,130,246,0.06)' : V.bg,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                color: settings.breadcrumb?.showOnHome ? V.blue : V.text,
              }}
            >
              <input
                type="checkbox"
                checked={settings.breadcrumb?.showOnHome || false}
                onChange={(e) => updateBreadcrumbField('showOnHome', e.target.checked)}
                style={{ accentColor: V.blue }}
              />
              Afficher sur la page d&apos;accueil
            </label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4, marginLeft: 30 }}>
              Par defaut, le breadcrumb n&apos;est pas affiche sur la page d&apos;accueil
            </div>
          </div>

          {/* Live preview */}
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: 'rgba(59,130,246,0.04)',
              border: `1px solid rgba(59,130,246,0.12)`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: V.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Apercu
            </div>
            <div style={{ fontSize: 13, color: V.text, fontWeight: 500 }}>
              {settings.breadcrumb?.homeLabel || 'Accueil'}
              <span style={{ margin: '0 6px', color: V.textSecondary }}>
                {settings.breadcrumb?.separator || '>'}
              </span>
              Services
              <span style={{ margin: '0 6px', color: V.textSecondary }}>
                {settings.breadcrumb?.separator || '>'}
              </span>
              <span style={{ fontWeight: 700 }}>Creation de site web</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom save button */}
      <div style={{ textAlign: 'right', paddingBottom: 40 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...btnBase,
            backgroundColor: saving ? V.textSecondary : V.green,
            color: '#fff',
            border: 'none',
            padding: '10px 28px',
            fontSize: 13,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
