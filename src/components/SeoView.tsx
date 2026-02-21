'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { ContentDecaySection } from './ContentDecaySection.js'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'
import type { DashboardTranslations } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Design tokens — uses Payload CSS variables for theme compatibility
// ---------------------------------------------------------------------------
const V = {
  text: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  bg: 'var(--theme-elevation-0, #fff)',
  bgCard: 'var(--theme-elevation-50, #f9fafb)',
  border: 'var(--theme-elevation-200, #e5e7eb)',
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  blue: '#3b82f6',
  cyan: '#06b6d4',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuditItem {
  id: number | string
  collection: string
  title: string
  slug: string
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  focusKeywords: string[]
  hasOgImage: boolean
  wordCount: number
  readingTime: number
  readabilityScore: number
  internalLinkCount: number
  externalLinkCount: number
  headingCount: number
  hasH1: boolean
  h1Count: number
  score: number
  previousScore?: number | null
  level: string
  status: string
  updatedAt: string
  isCornerstone: boolean
  contentLastReviewed: string
  daysSinceUpdate: number | null
}

interface AuditStats {
  totalPages: number
  avgScore: number
  good: number
  needsWork: number
  critical: number
  noKeyword: number
  noMetaTitle: number
  noMetaDesc: number
  avgWordCount: number
  avgReadability: number
}

type SortKey =
  | 'title'
  | 'score'
  | 'wordCount'
  | 'readabilityScore'
  | 'focusKeyword'
  | 'collection'
  | 'updatedAt'
  | 'h1Count'
  | 'internalLinkCount'

type QuickFilter = 'none' | 'noMeta' | 'noH1' | 'lowReadability'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getScoreColor(score: number): string {
  if (score >= 80) return V.green
  if (score >= 50) return V.yellow
  return V.red
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'rgba(34,197,94,0.12)'
  if (score >= 50) return 'rgba(245,158,11,0.12)'
  return 'rgba(239,68,68,0.12)'
}

function itemKey(item: AuditItem): string {
  return `${item.collection}::${item.id}`
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

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontSize: 12,
  color: V.text,
  backgroundColor: V.bg,
}

// A1: Updated grid — checkbox(30) + page(1fr) + collection(85) + score(55) + keyword(120) + h1(35) + og(30) + int links(60) + ext links(60) + words(50) + readability(45) + date(80) + edit(35)
const TABLE_COLS = '30px 1fr 85px 55px 120px 35px 30px 60px 60px 50px 45px 80px 35px'

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: `1px solid ${V.border}`,
        backgroundColor: V.bgCard,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: V.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortHeader sub-component
// ---------------------------------------------------------------------------
function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const isActive = currentSort === sortKey
  return (
    <span
      onClick={() => onSort(sortKey)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? V.text : V.textSecondary,
        fontWeight: isActive ? 800 : 600,
      }}
    >
      {label} {isActive && (currentDir === 'asc' ? '\u25B2' : '\u25BC')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// InlineEditPanel sub-component (B3)
// ---------------------------------------------------------------------------
function InlineEditPanel({
  item,
  onSave,
  onCancel,
  saving,
  t,
}: {
  item: AuditItem
  onSave: (metaTitle: string, metaDescription: string) => void
  onCancel: () => void
  saving: boolean
  t: DashboardTranslations
}) {
  const [metaTitle, setMetaTitle] = useState(item.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(item.metaDescription || '')

  const titleLen = metaTitle.length
  const descLen = metaDescription.length
  const titleOk = titleLen > 0 && titleLen <= 60
  const descOk = descLen > 0 && descLen <= 160

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        padding: '12px 14px',
        borderBottom: `1px solid ${V.border}`,
        backgroundColor: 'rgba(59,130,246,0.04)',
      }}
    >
      {/* Span entire row */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Meta title */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <label style={{ fontSize: 10, fontWeight: 700, color: V.textSecondary, textTransform: 'uppercase' }}>
              {t.seoView.metaTitle}
            </label>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: titleOk ? V.green : V.red,
              }}
            >
              {titleLen}/60
            </span>
          </div>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={70}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${titleOk ? V.border : V.red}`,
              fontSize: 12,
              color: V.text,
              backgroundColor: V.bg,
            }}
          />
        </div>

        {/* Meta description */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <label style={{ fontSize: 10, fontWeight: 700, color: V.textSecondary, textTransform: 'uppercase' }}>
              {t.seoView.metaDesc}
            </label>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: descOk ? V.green : V.red,
              }}
            >
              {descLen}/160
            </span>
          </div>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            maxLength={170}
            rows={2}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${descOk ? V.border : V.red}`,
              fontSize: 12,
              color: V.text,
              backgroundColor: V.bg,
              resize: 'vertical',
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: V.text,
            }}
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => onSave(metaTitle, metaDescription)}
            disabled={saving}
            style={{
              ...btnBase,
              backgroundColor: saving ? V.bgCard : V.blue,
              color: saving ? V.textSecondary : '#fff',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TableRow sub-component
// ---------------------------------------------------------------------------
function TableRow({
  item,
  selected,
  onToggle,
  expanded,
  onRowClick,
  t,
  locale,
}: {
  item: AuditItem
  selected: boolean
  onToggle: () => void
  expanded: boolean
  onRowClick: () => void
  t: DashboardTranslations
  locale: string
}) {
  const scoreColor = getScoreColor(item.score)
  const scoreBg = getScoreBg(item.score)
  const [editHover, setEditHover] = useState(false)

  // A2: Meta missing badges
  const missingMeta = !item.metaTitle || !item.metaDescription
  const badgeStyle: React.CSSProperties = {
    fontSize: 8,
    fontWeight: 700,
    color: '#fff',
    backgroundColor: V.red,
    padding: '1px 4px',
    borderRadius: 3,
    marginRight: 4,
    marginTop: 3,
    display: 'inline-block',
  }

  return (
    <div
      onClick={(e) => {
        // B3: Don't toggle expand when clicking checkbox or edit
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.closest('[data-edit-link]')) return
        onRowClick()
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        padding: '10px 14px',
        borderBottom: `1px solid ${V.border}`,
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        cursor: 'pointer',
        backgroundColor: expanded ? 'rgba(59,130,246,0.04)' : 'transparent',
      }}
    >
      {/* B1: Checkbox */}
      <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Title + slug + A2 meta badges */}
      <div style={{ overflow: 'hidden' }}>
        <div
          style={{
            fontWeight: 700,
            color: V.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.title || t.common.noTitle}
          {item.isCornerstone && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 8,
                fontWeight: 800,
                color: '#7c3aed',
                textTransform: 'uppercase',
                verticalAlign: 'middle',
              }}
            >
              {t.seoView.cornerstone}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 1 }}>
          <span
            style={{
              padding: '0 4px',
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              backgroundColor:
                item.collection === 'pages'
                  ? 'rgba(37,99,235,0.15)'
                  : 'rgba(217,119,6,0.2)',
            }}
          >
            {item.collection === 'pages' ? t.common.page : t.common.article}
          </span>{' '}
          /{item.slug}
        </div>
        {/* A2: Missing meta badges */}
        {missingMeta && (
          <div>
            {!item.metaTitle && <span style={badgeStyle}>{t.seoView.metaTitle}</span>}
            {!item.metaDescription && <span style={badgeStyle}>{t.seoView.metaDesc}</span>}
          </div>
        )}
      </div>

      {/* Collection */}
      <div style={{ fontSize: 11, color: V.textSecondary }}>{item.collection}</div>

      {/* Score + A6 trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 800,
            fontSize: 13,
            color: scoreColor,
            backgroundColor: scoreBg,
            minWidth: 40,
            textAlign: 'center',
          }}
        >
          {item.score}
        </span>
        {/* A6: Score trend indicator */}
        {item.previousScore != null && item.previousScore !== item.score && (
          <span
            title={`${t.seoView.previousLabel} ${item.previousScore}`}
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: item.score > item.previousScore ? V.green : V.red,
              lineHeight: 1,
            }}
          >
            {item.score > item.previousScore ? '\u2191' : '\u2193'}
          </span>
        )}
      </div>

      {/* Focus keyword + A5 multi-keyword */}
      <div
        style={{
          fontSize: 11,
          color: item.focusKeyword ? V.text : V.red,
          fontWeight: item.focusKeyword ? 600 : 400,
          fontStyle: item.focusKeyword ? 'normal' : 'italic',
          overflow: 'hidden',
        }}
      >
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.focusKeyword || t.common.none}
        </div>
        {/* A5: Secondary keywords */}
        {item.focusKeywords && item.focusKeywords.length > 0 && (
          <div>
            {item.focusKeywords.map((kw, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9,
                  color: V.textSecondary,
                  fontWeight: 400,
                  fontStyle: 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                +{kw}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* A1: H1 count */}
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: item.h1Count === 1 ? V.green : V.red,
            backgroundColor: item.h1Count === 1 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {item.h1Count}
        </span>
      </div>

      {/* A1: OG image */}
      <div style={{ textAlign: 'center', fontSize: 12 }}>
        {item.hasOgImage ? (
          <span style={{ color: V.green, fontWeight: 700 }}>{'\u2713'}</span>
        ) : (
          <span style={{ color: V.red, fontWeight: 700 }}>{'\u2717'}</span>
        )}
      </div>

      {/* A1: Internal links */}
      <div style={{ fontSize: 11, color: V.textSecondary, textAlign: 'right' }}>
        {item.internalLinkCount}
      </div>

      {/* A1: External links */}
      <div style={{ fontSize: 11, color: V.textSecondary, textAlign: 'right' }}>
        {item.externalLinkCount}
      </div>

      {/* Word count */}
      <div style={{ fontSize: 11, color: V.textSecondary, textAlign: 'right' }}>
        {item.wordCount}
      </div>

      {/* Readability */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color:
            item.readabilityScore >= 60
              ? V.green
              : item.readabilityScore >= 40
                ? V.yellow
                : V.red,
          textAlign: 'right',
        }}
      >
        {item.readabilityScore > 0 ? item.readabilityScore : '-'}
      </div>

      {/* Updated at */}
      <div style={{ fontSize: 10, color: V.textSecondary, textAlign: 'right' }}>
        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(locale) : '-'}
      </div>

      {/* Edit link */}
      <div style={{ textAlign: 'center' }} data-edit-link>
        <span
          role="link"
          tabIndex={0}
          title={t.common.edit}
          onMouseEnter={() => setEditHover(true)}
          onMouseLeave={() => setEditHover(false)}
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = `/admin/collections/${item.collection}/${item.id}`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') window.location.href = `/admin/collections/${item.collection}/${item.id}`
          }}
          style={{
            cursor: 'pointer',
            fontSize: 15,
            color: editHover ? V.blue : V.textSecondary,
            transition: 'color 0.15s',
            userSelect: 'none',
          }}
        >
          &#9998;
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BulkActionBar sub-component (B2)
// ---------------------------------------------------------------------------
function BulkActionBar({
  count,
  onDeselectAll,
  onExportCsv,
  onMarkCornerstone,
  onUnmarkCornerstone,
  t,
}: {
  count: number
  onDeselectAll: () => void
  onExportCsv: () => void
  onMarkCornerstone: () => void
  onUnmarkCornerstone: () => void
  t: DashboardTranslations
}) {
  if (count === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        backgroundColor: V.bgCard,
        borderTop: `2px solid ${V.border}`,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'space-between',
        fontFamily: 'var(--font-body, system-ui)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: V.text }}>
          {count} {t.common.selected}{count > 1 ? 's' : ''}
        </span>
        <button
          onClick={onDeselectAll}
          style={{ ...btnBase, backgroundColor: V.bg, color: V.textSecondary }}
        >
          {t.common.deselectAll}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onExportCsv}
          style={{ ...btnBase, backgroundColor: V.cyan, color: '#000' }}
        >
          {t.common.exportCsv}
        </button>
        <button
          onClick={onMarkCornerstone}
          style={{ ...btnBase, backgroundColor: '#7c3aed', color: '#fff' }}
        >
          {t.seoView.markCornerstone}
        </button>
        <button
          onClick={onUnmarkCornerstone}
          style={{ ...btnBase, backgroundColor: V.bg, color: V.text }}
        >
          {t.seoView.unmarkCornerstone}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SeoView component
// ---------------------------------------------------------------------------
export function SeoView() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [items, setItems] = useState<AuditItem[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'good' | 'needsWork' | 'critical'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const fetchAudit = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh ? '/api/seo-plugin/audit?nocache=1' : '/api/seo-plugin/audit'
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.results || [])
      setStats(data.stats || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    fetchAudit()
  }, [fetchAudit])

  const collections = useMemo(() => {
    const set = new Set(items.map((i) => i.collection))
    return Array.from(set).sort()
  }, [items])

  // A4: Quick filter counts
  const quickFilterCounts = useMemo(() => {
    return {
      noMeta: items.filter((i) => !i.metaTitle || !i.metaDescription).length,
      noH1: items.filter((i) => i.h1Count !== 1).length,
      lowReadability: items.filter((i) => i.readabilityScore > 0 && i.readabilityScore < 40).length,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (filter !== 'all') {
      result = result.filter((i) => i.collection === filter)
    }
    if (scoreFilter === 'good') result = result.filter((i) => i.score >= 80)
    else if (scoreFilter === 'needsWork')
      result = result.filter((i) => i.score >= 50 && i.score < 80)
    else if (scoreFilter === 'critical') result = result.filter((i) => i.score < 50)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          i.focusKeyword.toLowerCase().includes(q),
      )
    }

    // A4: Apply quick filter
    if (quickFilter === 'noMeta') {
      result = result.filter((i) => !i.metaTitle || !i.metaDescription)
    } else if (quickFilter === 'noH1') {
      result = result.filter((i) => i.h1Count !== 1)
    } else if (quickFilter === 'lowReadability') {
      result = result.filter((i) => i.readabilityScore > 0 && i.readabilityScore < 40)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'score':
          cmp = a.score - b.score
          break
        case 'wordCount':
          cmp = a.wordCount - b.wordCount
          break
        case 'readabilityScore':
          cmp = a.readabilityScore - b.readabilityScore
          break
        case 'focusKeyword':
          cmp = a.focusKeyword.localeCompare(b.focusKeyword)
          break
        case 'collection':
          cmp = a.collection.localeCompare(b.collection)
          break
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'h1Count':
          cmp = a.h1Count - b.h1Count
          break
        case 'internalLinkCount':
          cmp = a.internalLinkCount - b.internalLinkCount
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [items, filter, scoreFilter, search, sortBy, sortDir, quickFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, scoreFilter, search, sortBy, sortDir, quickFilter])

  // Paginated view
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, currentPage])

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortBy(key)
        setSortDir('asc')
      }
    },
    [sortBy],
  )

  // B1: Select all on current page
  const handleSelectAll = useCallback(() => {
    const pageKeys = paginatedItems.map(itemKey)
    const allSelected = pageKeys.every((k) => selectedIds.has(k))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        pageKeys.forEach((k) => next.delete(k))
      } else {
        pageKeys.forEach((k) => next.add(k))
      }
      return next
    })
  }, [paginatedItems, selectedIds])

  const allPageSelected = useMemo(() => {
    if (paginatedItems.length === 0) return false
    return paginatedItems.every((item) => selectedIds.has(itemKey(item)))
  }, [paginatedItems, selectedIds])

  // CSV export (shared between header and bulk)
  const buildCsv = useCallback(
    (itemList: AuditItem[]) => {
      const headers = [
        'Title',
        'Slug',
        'Collection',
        'Score',
        'Level',
        'Keyword',
        'Meta Title',
        'Meta Description',
        'Words',
        'Readability',
        'Internal Links',
        'External Links',
        'H1 Count',
        'Headings',
        'OG Image',
        'Cornerstone',
        'Reading Time',
        'Updated',
      ]
      const rows = itemList.map((i) => [
        i.title,
        i.slug,
        i.collection,
        i.score,
        i.level || '',
        i.focusKeyword,
        i.metaTitle,
        i.metaDescription,
        i.wordCount,
        i.readabilityScore,
        i.internalLinkCount,
        i.externalLinkCount,
        i.h1Count,
        i.headingCount,
        i.hasOgImage ? 'Yes' : 'No',
        i.isCornerstone ? 'Yes' : 'No',
        i.readingTime,
        i.updatedAt ? new Date(i.updatedAt).toLocaleDateString(locale) : '',
      ])
      const csv = [
        headers.join(','),
        ...rows.map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `seo-audit-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
    [],
  )

  const handleExportCsv = useCallback(() => {
    buildCsv(filteredItems)
  }, [filteredItems, buildCsv])

  // B2: Bulk export CSV (selected only)
  const handleBulkExportCsv = useCallback(() => {
    const selected = items.filter((i) => selectedIds.has(itemKey(i)))
    buildCsv(selected)
  }, [items, selectedIds, buildCsv])

  // B2: Bulk mark/unmark cornerstone
  const handleBulkCornerstone = useCallback(
    async (value: boolean) => {
      for (const key of selectedIds) {
        const [collection, id] = key.split('::')
        try {
          await fetch(`/api/${collection}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isCornerstone: value }),
          })
        } catch {
          /* skip */
        }
      }
      setSelectedIds(new Set())
      fetchAudit()
    },
    [selectedIds, fetchAudit],
  )

  // B3: Inline save handler
  const handleInlineSave = useCallback(
    async (item: AuditItem, metaTitle: string, metaDescription: string) => {
      setSaving(true)
      setSaveError(null)
      try {
        const res = await fetch(`/api/${item.collection}/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ meta: { title: metaTitle, description: metaDescription } }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setExpandedId(null)
        fetchAudit()
      } catch (e) {
        setSaveError(e instanceof Error ? `${t.seoView.errorSaving}: ${e.message}` : t.seoView.errorSaving)
      }
      setSaving(false)
    },
    [fetchAudit, t],
  )

  // Fetch site name from settings for branded PDF
  const [siteName, setSiteName] = useState<string>('')
  useEffect(() => {
    fetch('/api/seo-plugin/settings', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.siteName) setSiteName(data.siteName)
      })
      .catch(() => {
        // Non-critical — fallback to empty
      })
  }, [])

  const handleExportPdf = useCallback(() => {
    const today = new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const avgScore = stats?.avgScore ?? 0
    const totalAnalyzed = stats?.totalPages ?? 0
    const goodCount = stats?.good ?? 0
    const needsWorkCount = stats?.needsWork ?? 0
    const criticalCount = stats?.critical ?? 0
    const noKwCount = stats?.noKeyword ?? 0
    const avgWords = stats?.avgWordCount ?? 0
    const avgReadability = stats?.avgReadability ?? 0

    function pdfScoreColor(score: number): string {
      if (score >= 80) return '#22c55e'
      if (score >= 50) return '#f59e0b'
      return '#ef4444'
    }

    // Top 5 priority pages (lowest scores with issues)
    const sortedByScore = [...filteredItems].sort((a, b) => a.score - b.score)
    const top5Priority = sortedByScore.slice(0, 5)

    const priorityRows = top5Priority
      .map((i) => {
        const issues: string[] = []
        if (!i.metaTitle) issues.push(t.seoView.missingMetaTitle)
        if (!i.metaDescription) issues.push(t.seoView.missingMetaDescription)
        if (!i.focusKeyword) issues.push(t.seoView.missingKeyword)
        if (i.h1Count !== 1) issues.push(i.h1Count === 0 ? t.seoView.missingH1 : `${i.h1Count} H1`)
        if (i.wordCount < 300) issues.push(`${t.seoView.shortContent} (${i.wordCount})`)
        if (i.readabilityScore > 0 && i.readabilityScore < 40) issues.push(t.seoView.lowReadabilityIssue)
        if (!i.hasOgImage) issues.push(t.seoView.missingOgImage)
        if (i.internalLinkCount === 0) issues.push(t.seoView.noInternalLinks)
        if (issues.length === 0) issues.push(t.seoView.lowOverallScore)

        return `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:700;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.title || t.common.noTitle)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;font-size:13px;color:${pdfScoreColor(i.score)};">${i.score}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#6b7280;line-height:1.5;">${issues.map(escapeHtml).join('<br>')}</td>
        </tr>`
      })
      .join('')

    // Per-page detail rows (sorted by score ascending)
    const detailRows = sortedByScore
      .map((i) => {
        const issues: string[] = []
        if (!i.metaTitle) issues.push(t.seoView.missingMetaTitle)
        else if (i.metaTitle.length < 30) issues.push(`${t.seoView.shortMetaTitle} (${i.metaTitle.length})`)
        else if (i.metaTitle.length > 60) issues.push(`${t.seoView.longMetaTitle} (${i.metaTitle.length})`)
        if (!i.metaDescription) issues.push(t.seoView.missingMetaDescription)
        else if (i.metaDescription.length < 120) issues.push(`${t.seoView.shortMetaDesc} (${i.metaDescription.length})`)
        else if (i.metaDescription.length > 160) issues.push(`${t.seoView.longMetaDesc} (${i.metaDescription.length})`)
        if (!i.focusKeyword) issues.push(t.seoView.missingKeyword)
        if (i.h1Count !== 1) issues.push(i.h1Count === 0 ? t.seoView.missingH1 : `${i.h1Count} H1`)
        if (i.wordCount < 300) issues.push(`${t.seoView.shortContent} (${i.wordCount})`)
        if (i.readabilityScore > 0 && i.readabilityScore < 40) issues.push(`${t.seoView.lowReadabilityIssue} (${i.readabilityScore})`)
        if (!i.hasOgImage) issues.push(t.seoView.missingOgImage)
        if (i.internalLinkCount === 0) issues.push(t.seoView.noInternalLinks)

        const issuesHtml = issues.length > 0
          ? issues.map((iss) => `<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:3px;font-size:9px;background:rgba(239,68,68,0.08);color:#dc2626;">${escapeHtml(iss)}</span>`).join('')
          : '<span style="font-size:9px;color:#22c55e;font-weight:700;">OK</span>'

        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${escapeHtml(i.title || t.common.noTitle)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#6b7280;">/${escapeHtml(i.slug)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;font-size:12px;color:${pdfScoreColor(i.score)};">${i.score}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px;${i.focusKeyword ? '' : 'color:#ef4444;font-style:italic;'}">${escapeHtml(i.focusKeyword || t.common.none)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px;">${issuesHtml}</td>
        </tr>`
      })
      .join('')

    const brandingTitle = siteName ? `${t.seoView.seoReport} — ${escapeHtml(siteName)}` : t.seoView.seoReport

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <title>${brandingTitle} - ${today}</title>
  <style>
    @media print {
      body { margin: 0; padding: 16px; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
      .page-break { page-break-before: always; }
    }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 30px; max-width: 1100px; margin: 0 auto; font-size: 12px; }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 2px; }
    h2 { font-size: 16px; font-weight: 800; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1a1a1a; }
    .header-right { text-align: right; font-size: 11px; color: #6b7280; }
    .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
    .stats-grid-2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .stat-card { padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
    .stat-value { font-size: 24px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
    thead th { padding: 8px 8px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; text-align: left; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 2px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    .score-gauge { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; font-weight: 800; font-size: 18px; }
    .priority-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  </style>
</head>
<body>
  <!-- Header with branding -->
  <div class="header">
    <div>
      <h1>${brandingTitle}</h1>
      <div class="subtitle">${totalAnalyzed} ${t.seoView.pagesAnalyzed} — ${filteredItems.length} ${t.seoView.resultsDisplayed}</div>
    </div>
    <div class="header-right">
      <div style="font-weight:700;font-size:12px;color:#1a1a1a;">${today}</div>
      <div style="margin-top:2px;">${t.seoView.generatedBy}</div>
    </div>
  </div>

  <!-- Summary stats -->
  <h2>${t.seoView.overview}</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" style="color:${pdfScoreColor(avgScore)}">${avgScore}<span style="font-size:12px;font-weight:600;color:#6b7280;">/100</span></div>
      <div class="stat-label">${t.seoView.averageScore}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#22c55e">${goodCount}</div>
      <div class="stat-label">${t.seoView.goodLabel}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#f59e0b">${needsWorkCount}</div>
      <div class="stat-label">${t.seoView.needsWorkLabel}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#ef4444">${criticalCount}</div>
      <div class="stat-label">${t.seoView.criticalLabel}</div>
    </div>
  </div>
  <div class="stats-grid-2">
    <div class="stat-card">
      <div class="stat-value" style="color:#f97316">${noKwCount}</div>
      <div class="stat-label">${t.seoView.noKeywordLabel}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#3b82f6">${avgWords}</div>
      <div class="stat-label">${t.seoView.wordsAverage}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${avgReadability >= 60 ? '#22c55e' : avgReadability >= 40 ? '#f59e0b' : '#ef4444'}">${avgReadability}</div>
      <div class="stat-label">${t.seoView.readabilityAvg}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#6b7280">${stats?.noMetaTitle ?? 0} / ${stats?.noMetaDesc ?? 0}</div>
      <div class="stat-label">${t.seoView.noTitleDesc}</div>
    </div>
  </div>

  <!-- Top 5 priority actions -->
  ${top5Priority.length > 0 ? `
  <h2>${t.seoView.top5PriorityActions}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:35%;">${t.common.page}</th>
        <th style="text-align:center;width:12%;">${t.seoView.score}</th>
        <th>${t.seoView.identifiedIssues}</th>
      </tr>
    </thead>
    <tbody>
      ${priorityRows}
    </tbody>
  </table>
  ` : ''}

  <!-- Per-page details -->
  <h2>${t.seoView.perPageDetails}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:22%;">${t.seoView.title}</th>
        <th style="width:15%;">${t.seoView.slug}</th>
        <th style="text-align:center;width:8%;">${t.seoView.score}</th>
        <th style="width:15%;">${t.seoView.keyword}</th>
        <th>${t.seoView.issues}</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
    </tbody>
  </table>

  <!-- Score distribution summary -->
  <div style="margin-top:20px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">${t.seoView.scoreDistribution}</div>
    <div style="display:flex;gap:4px;height:16px;border-radius:4px;overflow:hidden;">
      ${goodCount > 0 ? `<div style="flex:${goodCount};background:#22c55e;" title="${goodCount} ${t.seoView.good}"></div>` : ''}
      ${needsWorkCount > 0 ? `<div style="flex:${needsWorkCount};background:#f59e0b;" title="${needsWorkCount} ${t.seoView.needsWorkLabel}"></div>` : ''}
      ${criticalCount > 0 ? `<div style="flex:${criticalCount};background:#ef4444;" title="${criticalCount} ${t.seoView.critical}"></div>` : ''}
    </div>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:9px;color:#6b7280;">
      <span><span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:2px;margin-right:3px;vertical-align:middle;"></span>${goodCount} ${t.seoView.good} (${totalAnalyzed > 0 ? Math.round((goodCount / totalAnalyzed) * 100) : 0}%)</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:2px;margin-right:3px;vertical-align:middle;"></span>${needsWorkCount} ${t.seoView.needsWorkLabel} (${totalAnalyzed > 0 ? Math.round((needsWorkCount / totalAnalyzed) * 100) : 0}%)</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:2px;margin-right:3px;vertical-align:middle;"></span>${criticalCount} ${t.seoView.critical} (${totalAnalyzed > 0 ? Math.round((criticalCount / totalAnalyzed) * 100) : 0}%)</span>
    </div>
  </div>

  <div class="footer">
    ${t.seoView.generatedBy} &mdash; ${today}${siteName ? ` &mdash; ${escapeHtml(siteName)}` : ''}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }, [filteredItems, stats, siteName, locale, t])

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
        {t.seoView.loadingAudit}
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
          onClick={() => fetchAudit(true)}
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
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: 'var(--font-body, system-ui)',
        paddingBottom: selectedIds.size > 0 ? 70 : 20,
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
            {t.seoView.auditTitle}
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {stats?.totalPages || 0} {t.seoView.pagesAnalyzed}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchAudit(true)}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; {t.common.refresh}
          </button>
          <button
            onClick={handleExportCsv}
            style={{ ...btnBase, backgroundColor: V.cyan, color: '#000' }}
          >
            {t.common.exportCsv}
          </button>
          <button
            onClick={handleExportPdf}
            style={{ ...btnBase, backgroundColor: V.blue, color: '#fff' }}
          >
            {t.common.exportPdf}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label={t.seoView.averageScore} value={stats.avgScore} color={getScoreColor(stats.avgScore)} />
          <StatCard label={t.seoView.goodLabel} value={stats.good} color={V.green} />
          <StatCard label={t.seoView.needsWorkLabel} value={stats.needsWork} color={V.yellow} />
          <StatCard label={t.seoView.criticalLabel} value={stats.critical} color={V.red} />
          <StatCard label={t.seoView.noKeyword} value={stats.noKeyword} color={V.orange} />
          <StatCard label={t.seoView.wordsAvg} value={stats.avgWordCount} color={V.blue} />
        </div>
      )}

      {/* Content Decay */}
      <ContentDecaySection items={items as AuditItem[]} />

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder={t.seoView.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${V.border}`,
            fontSize: 12,
            minWidth: 220,
            color: V.text,
            backgroundColor: V.bg,
          }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectStyle}>
          <option value="all">{t.seoView.allCollections}</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value as typeof scoreFilter)}
          style={selectStyle}
        >
          <option value="all">{t.seoView.allScores}</option>
          <option value="good">{t.seoView.goodScores}</option>
          <option value="needsWork">{t.seoView.needsWork}</option>
          <option value="critical">{t.seoView.criticalScores}</option>
        </select>
        <span style={{ fontSize: 11, color: V.textSecondary, fontWeight: 600 }}>
          {filteredItems.length} {t.seoView.resultsDisplayed}
        </span>
      </div>

      {/* A4: Quick filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { key: 'noMeta' as QuickFilter, label: t.seoView.missingMeta, count: quickFilterCounts.noMeta, color: V.red },
          { key: 'noH1' as QuickFilter, label: t.seoView.missingH1, count: quickFilterCounts.noH1, color: V.orange },
          { key: 'lowReadability' as QuickFilter, label: t.seoView.lowReadability, count: quickFilterCounts.lowReadability, color: V.yellow },
        ]).map((qf) => {
          const isActive = quickFilter === qf.key
          return (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(isActive ? 'none' : qf.key)}
              style={{
                ...btnBase,
                backgroundColor: isActive ? `${qf.color}15` : V.bg,
                borderColor: isActive ? qf.color : V.border,
                color: isActive ? qf.color : V.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {qf.label}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  backgroundColor: isActive ? qf.color : V.border,
                  color: isActive ? '#fff' : V.textSecondary,
                  borderRadius: 8,
                  padding: '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {qf.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div
        style={{
          border: `1px solid ${V.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* A3: Sticky table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: TABLE_COLS,
            padding: '10px 14px',
            backgroundColor: V.bgCard,
            borderBottom: `1px solid ${V.border}`,
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            color: V.textSecondary,
            letterSpacing: 0.5,
            gap: 8,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {/* B1: Select all checkbox */}
          <div style={{ textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={handleSelectAll}
              style={{ cursor: 'pointer' }}
            />
          </div>
          <SortHeader
            label={t.common.page}
            sortKey="title"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label={t.seoView.collection}
            sortKey="collection"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label={t.seoView.score}
            sortKey="score"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label={t.seoView.keyword}
            sortKey="focusKeyword"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          {/* A1: H1 — sortable */}
          <SortHeader
            label={t.seoView.h1}
            sortKey="h1Count"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          {/* A1: OG — not sortable */}
          <span>{t.seoView.og}</span>
          {/* A1: Internal links — sortable */}
          <SortHeader
            label={t.seoView.internal}
            sortKey="internalLinkCount"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          {/* A1: External links — not sortable */}
          <span>{t.seoView.external}</span>
          <SortHeader
            label={t.seoView.words}
            sortKey="wordCount"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label={t.seoView.readability}
            sortKey="readabilityScore"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label={t.seoView.updated}
            sortKey="updatedAt"
            currentSort={sortBy}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <span />
        </div>

        {/* A3: Scrollable table body */}
        <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: V.textSecondary,
                fontSize: 12,
              }}
            >
              {t.common.noResults}
            </div>
          ) : (
            paginatedItems.map((item) => {
              const key = itemKey(item)
              const isExpanded = expandedId === key
              return (
                <React.Fragment key={`${item.collection}-${item.id}`}>
                  <TableRow
                    item={item}
                    selected={selectedIds.has(key)}
                    onToggle={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }}
                    expanded={isExpanded}
                    onRowClick={() => setExpandedId(isExpanded ? null : key)}
                    t={t}
                    locale={locale}
                  />
                  {/* B3: Inline edit panel */}
                  {isExpanded && (
                    <>
                      <InlineEditPanel
                        item={item}
                        saving={saving}
                        onCancel={() => setExpandedId(null)}
                        onSave={(title, desc) => handleInlineSave(item, title, desc)}
                        t={t}
                      />
                      {saveError && (
                        <div
                          style={{
                            padding: '8px 14px',
                            backgroundColor: 'rgba(239,68,68,0.08)',
                            borderBottom: `1px solid ${V.border}`,
                            fontSize: 11,
                            fontWeight: 600,
                            color: V.red,
                          }}
                        >
                          {saveError}
                        </div>
                      )}
                    </>
                  )}
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16,
            fontSize: 12,
          }}
        >
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: currentPage === 1 ? V.textSecondary : V.text,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            &laquo;
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: currentPage === 1 ? V.textSecondary : V.text,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            &lsaquo; {t.common.previous}
          </button>
          <span style={{ color: V.textSecondary, fontWeight: 600, padding: '0 8px' }}>
            {t.common.page} {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: currentPage === totalPages ? V.textSecondary : V.text,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            {t.common.next} &rsaquo;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: currentPage === totalPages ? V.textSecondary : V.text,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            &raquo;
          </button>
        </div>
      )}

      {/* B2: Bulk action bar */}
      <BulkActionBar
        count={selectedIds.size}
        onDeselectAll={() => setSelectedIds(new Set())}
        onExportCsv={handleBulkExportCsv}
        onMarkCornerstone={() => handleBulkCornerstone(true)}
        onUnmarkCornerstone={() => handleBulkCornerstone(false)}
        t={t}
      />
    </div>
  )
}
