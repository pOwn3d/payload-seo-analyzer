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
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

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
// Built dynamically from i18n translations
// ---------------------------------------------------------------------------
const RULE_GROUP_KEYS = [
  'title',
  'meta-description',
  'url',
  'headings',
  'content',
  'images',
  'linking',
  'social',
  'schema',
  'readability',
  'quality',
  'secondary-keywords',
  'cornerstone',
  'freshness',
  'technical',
  'accessibility',
  'ecommerce',
] as const

function getRuleGroups(t: ReturnType<typeof getDashboardT>): Array<{ value: string; label: string }> {
  const labelMap: Record<string, string> = {
    'title': t.seoConfig.ruleGroupTitle,
    'meta-description': t.seoConfig.ruleGroupMetaDescription,
    'url': t.seoConfig.ruleGroupUrlSlug,
    'headings': t.seoConfig.ruleGroupHeadings,
    'content': t.seoConfig.ruleGroupContent,
    'images': t.seoConfig.ruleGroupImages,
    'linking': t.seoConfig.ruleGroupLinks,
    'social': t.seoConfig.ruleGroupSocial,
    'schema': t.seoConfig.ruleGroupStructuredData,
    'readability': t.seoConfig.ruleGroupReadability,
    'quality': t.seoConfig.ruleGroupQuality,
    'secondary-keywords': t.seoConfig.ruleGroupSecondaryKeywords,
    'cornerstone': t.seoConfig.ruleGroupCornerstone,
    'freshness': t.seoConfig.ruleGroupFreshness,
    'technical': t.seoConfig.ruleGroupTechnical,
    'accessibility': t.seoConfig.ruleGroupAccessibility,
    'ecommerce': t.seoConfig.ruleGroupEcommerce,
  }
  return RULE_GROUP_KEYS.map((key) => ({ value: key, label: labelMap[key] || key }))
}

// ---------------------------------------------------------------------------
// Threshold definitions (field name, label, default value)
// Built dynamically from i18n translations
// ---------------------------------------------------------------------------
function getThresholdFields(t: ReturnType<typeof getDashboardT>): Array<{ name: string; label: string; defaultValue: number }> {
  return [
    { name: 'titleLengthMin', label: t.seoConfig.thresholdTitleMin, defaultValue: TITLE_LENGTH_MIN },
    { name: 'titleLengthMax', label: t.seoConfig.thresholdTitleMax, defaultValue: TITLE_LENGTH_MAX },
    { name: 'metaDescLengthMin', label: t.seoConfig.thresholdMetaDescMin, defaultValue: META_DESC_LENGTH_MIN },
    { name: 'metaDescLengthMax', label: t.seoConfig.thresholdMetaDescMax, defaultValue: META_DESC_LENGTH_MAX },
    { name: 'minWordsGeneric', label: t.seoConfig.thresholdMinWordsPages, defaultValue: MIN_WORDS_GENERIC },
    { name: 'minWordsPost', label: t.seoConfig.thresholdMinWordsPosts, defaultValue: MIN_WORDS_POST },
    { name: 'keywordDensityMin', label: t.seoConfig.thresholdKeywordDensityMin, defaultValue: KEYWORD_DENSITY_MIN },
    { name: 'keywordDensityMax', label: t.seoConfig.thresholdKeywordDensityMax, defaultValue: KEYWORD_DENSITY_MAX },
    { name: 'fleschScorePass', label: t.seoConfig.thresholdFleschMin, defaultValue: FLESCH_SCORE_PASS },
    { name: 'slugMaxLength', label: t.seoConfig.thresholdSlugMaxLength, defaultValue: SLUG_MAX_LENGTH },
  ]
}

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
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const RULE_GROUPS = useMemo(() => getRuleGroups(t), [t])
  const THRESHOLD_FIELDS = useMemo(() => getThresholdFields(t), [t])

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
      setError(e instanceof Error ? e.message : t.common.loadingError)
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
        setToast({ message: t.seoConfig.saved, type: 'success' })
      } else {
        throw new Error(t.common.serverError)
      }
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : t.common.loadingError,
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
        {t.seoConfig.loading}
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
          {t.common.loadingError}
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>{error}</div>
        <button
          onClick={fetchSettings}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          {t.common.retry}
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
            {t.seoConfig.title}
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {t.seoConfig.subtitle}
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
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>

      {/* Section 1: General */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>General</div>
        <div style={cardBodyStyle}>
          <label style={labelStyle}>{t.seoConfig.siteName}</label>
          <input
            type="text"
            value={settings.siteName || ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
            placeholder="Ex: My Website"
            style={inputStyle}
          />
          <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4 }}>
            {t.seoConfig.siteNameDesc}
          </div>
        </div>
      </div>

      {/* Section 2: Pages ignorees */}
      <div style={{ ...cardStyle, overflow: 'visible' }}>
        <div style={cardHeaderStyle}>{t.seoConfig.ignoredPages}</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 12 }}>
            {t.seoConfig.ignoredPagesDesc}
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
                placeholder={t.seoConfig.pageSlugPlaceholder}
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
              {t.common.add}
            </button>
          </div>

          {/* Slug chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.ignoredSlugs || []).length === 0 && (
              <div style={{ fontSize: 11, color: V.textSecondary, fontStyle: 'italic' }}>
                {t.seoConfig.noIgnoredSlugs}
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
                  title={t.common.delete}
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
        <div style={cardHeaderStyle}>{t.seoConfig.disabledRules}</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            {t.seoConfig.disabledRulesDesc}
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
        <div style={cardHeaderStyle}>{t.seoConfig.customThresholds}</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            {t.seoConfig.customThresholdsDesc}
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
                    placeholder={`${t.seoConfig.defaultLabel} ${field.defaultValue}`}
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
        <div style={cardHeaderStyle}>{t.seoConfig.sitemapConfig}</div>
        <div style={cardBodyStyle}>
          {/* Slugs exclus du sitemap */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t.seoConfig.sitemapExcludedSlugs}</label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginBottom: 8 }}>
              {t.seoConfig.ignoredPagesDesc}
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
                placeholder={t.seoConfig.slugToExcludePlaceholder}
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
                {t.common.add}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(settings.sitemap?.excludedSlugs || []).length === 0 && (
                <div style={{ fontSize: 11, color: V.textSecondary, fontStyle: 'italic' }}>
                  {t.seoConfig.noExcludedSlugs}
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
                    title={t.common.delete}
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
              <label style={labelStyle}>{t.seoConfig.defaultChangeFrequency}</label>
              <select
                value={settings.sitemap?.defaultChangefreq || 'weekly'}
                onChange={(e) => updateSitemapField('defaultChangefreq', e.target.value)}
                style={inputStyle}
              >
                <option value="daily">{t.seoConfig.daily}</option>
                <option value="weekly">{t.seoConfig.weekly}</option>
                <option value="monthly">{t.seoConfig.monthly}</option>
                <option value="yearly">{t.seoConfig.yearly}</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t.seoConfig.defaultPriority}</label>
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
                {t.seoConfig.defaultPriorityDesc}
              </div>
            </div>
          </div>

          {/* Overrides de priorite */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t.seoConfig.priorityOverrides}</label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginBottom: 8 }}>
              {t.seoConfig.priorityOverridesDesc}
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
                  placeholder={t.seoConfig.patternPlaceholder}
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
                  placeholder={t.seoConfig.priority}
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
                  <option value="">{t.seoConfig.defaultShort}</option>
                  <option value="daily">{t.seoConfig.daily}</option>
                  <option value="weekly">{t.seoConfig.weekly}</option>
                  <option value="monthly">{t.seoConfig.monthly}</option>
                  <option value="yearly">{t.seoConfig.yearly}</option>
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
                  title={t.common.delete}
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
              {t.seoConfig.addOverride}
            </button>
          </div>

          {/* Preview du sitemap */}
          <div>
            <label style={labelStyle}>{t.seoConfig.sitemapPreview}</label>
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
              {loadingPreview ? t.common.loading : showPreview ? t.seoConfig.refreshPreview : t.seoConfig.viewPreview}
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
                    {sitemapPreview.stats.totalPages} {t.seoConfig.pages}
                  </span>
                  <span style={{ color: V.green }}>
                    {sitemapPreview.stats.includedCount} {t.seoConfig.included}
                  </span>
                  <span style={{ color: V.red }}>
                    {sitemapPreview.stats.excludedCount} {t.seoConfig.excluded}
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
                    <span>{t.seoConfig.url}</span>
                    <span>Collection</span>
                    <span>{t.seoConfig.priority}</span>
                    <span>{t.seoConfig.frequency}</span>
                    <span>{t.seoConfig.lastModified}</span>
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
        <div style={cardHeaderStyle}>{t.seoConfig.breadcrumbConfig}</div>
        <div style={cardBodyStyle}>
          <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14 }}>
            {t.seoConfig.breadcrumbConfigDesc}
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
              {t.seoConfig.enableBreadcrumbs}
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
              <label style={labelStyle}>{t.seoConfig.homePageLabel}</label>
              <input
                type="text"
                value={settings.breadcrumb?.homeLabel || 'Accueil'}
                onChange={(e) => updateBreadcrumbField('homeLabel', e.target.value)}
                placeholder="Accueil"
                style={inputStyle}
              />
              <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
                {t.seoConfig.homePageLabel}
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t.seoConfig.separator}</label>
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
                {t.seoConfig.separatorDesc}
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
              {t.seoConfig.showOnHomePage}
            </label>
            <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4, marginLeft: 30 }}>
              {t.seoConfig.showOnHomePageDesc}
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
              {t.seoConfig.preview}
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
              <span style={{ fontWeight: 700 }}>{t.seoConfig.websiteCreation}</span>
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
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
