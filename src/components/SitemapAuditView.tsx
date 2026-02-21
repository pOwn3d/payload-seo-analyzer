'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
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
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// Score color helpers (same as SeoView)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OrphanPage {
  id: number | string
  title: string
  slug: string
  collection: string
}

interface WeakPage {
  id: number | string
  title: string
  slug: string
  collection: string
  incomingCount: number
  incomingFrom: Array<{ slug: string; anchorText: string }>
}

interface LinkHub {
  id: number | string
  title: string
  slug: string
  collection: string
  outgoingCount: number
}

interface BrokenLink {
  sourceId: number | string
  sourceTitle: string
  sourceSlug: string
  targetUrl: string
  targetSlug: string
  collection: string
  suggestedSlug: string | null
}

interface SitemapAuditStats {
  totalPages: number
  totalLinks: number
  avgLinksPerPage: number
  orphanCount: number
  weakCount: number
  hubCount: number
  brokenCount: number
}

interface SitemapAuditData {
  orphanPages: OrphanPage[]
  weakPages: WeakPage[]
  linkHubs: LinkHub[]
  brokenLinks: BrokenLink[]
  stats: SitemapAuditStats
}

type TabId = 'orphan' | 'weak' | 'hubs' | 'broken' | 'external' | 'logs404'

// ---------------------------------------------------------------------------
// External Links types
// ---------------------------------------------------------------------------
interface ExternalLinkResult {
  url: string
  status: number
  ok: boolean
  error?: string
  sourcePages: Array<{ title: string; slug: string; collection: string }>
}

interface ExternalLinksData {
  results: ExternalLinkResult[]
  stats: {
    total: number
    ok: number
    broken: number
    timeout: number
  }
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

// ---------------------------------------------------------------------------
// HoverPreview sub-component (C5)
// ---------------------------------------------------------------------------
function HoverPreview({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = useCallback(() => setShow(true), [])
  const handleMouseLeave = useCallback(() => setShow(false), [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX + 12, y: e.clientY + 12 })
  }, [])

  return (
    <span
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{ position: 'relative' }}
    >
      {children}
      {show && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            backgroundColor: '#1a1a2e',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            maxWidth: 300,
            zIndex: 100,
            fontSize: 11,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ScoreBadge sub-component (C3)
// ---------------------------------------------------------------------------
function ScoreBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 8px',
        borderRadius: 6,
        fontWeight: 800,
        fontSize: 11,
        color: getScoreColor(score),
        backgroundColor: getScoreBg(score),
        marginLeft: 6,
      }}
    >
      {score}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string
  value: number | string
  color: string
  subtitle?: string
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
      {subtitle && (
        <div
          style={{
            fontSize: 9,
            color: V.textSecondary,
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollectionBadge sub-component
// ---------------------------------------------------------------------------
function CollectionBadge({ collection, articleLabel }: { collection: string; articleLabel?: string }) {
  const isPages = collection === 'pages'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        backgroundColor: isPages ? 'rgba(37,99,235,0.15)' : 'rgba(217,119,6,0.2)',
        color: isPages ? V.blue : V.orange,
        letterSpacing: 0.3,
      }}
    >
      {isPages ? 'Page' : (articleLabel || 'Article')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// EditButton sub-component
// ---------------------------------------------------------------------------
function EditButton({ collection, id }: { collection: string; id: number | string }) {
  const t = getDashboardT(useSeoLocale())
  const [hover, setHover] = useState(false)
  return (
    <span
      role="link"
      tabIndex={0}
      title={t.common.edit}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        window.location.href = `/admin/collections/${collection}/${id}`
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') window.location.href = `/admin/collections/${collection}/${id}`
      }}
      style={{
        cursor: 'pointer',
        fontSize: 15,
        color: hover ? V.blue : V.textSecondary,
        transition: 'color 0.15s',
        userSelect: 'none',
      }}
    >
      &#9998;
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tab button sub-component
// ---------------------------------------------------------------------------
function TabButton({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  color: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: active ? `2px solid ${color}` : `1px solid ${V.border}`,
        backgroundColor: active ? `${color}12` : hover ? V.bgCard : V.bg,
        color: active ? color : V.text,
        fontWeight: active ? 800 : 600,
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
    >
      {label}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 20,
          height: 18,
          padding: '0 5px',
          borderRadius: 9,
          fontSize: 10,
          fontWeight: 800,
          backgroundColor: active ? color : V.border,
          color: active ? '#fff' : V.textSecondary,
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// EmptyState sub-component
// ---------------------------------------------------------------------------
function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: V.textSecondary,
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>&#10003;</div>
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row base style
// ---------------------------------------------------------------------------
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: `1px solid ${V.border}`,
  gap: 12,
  fontSize: 12,
}

// ---------------------------------------------------------------------------
// OrphanTab (C3: score badge, C5: hover preview)
// ---------------------------------------------------------------------------
function OrphanTab({ pages, scoreMap }: { pages: OrphanPage[]; scoreMap: Map<string, number> }) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  if (pages.length === 0) {
    return <EmptyState message={t.sitemapAudit.noOrphanedPages} />
  }
  return (
    <div>
      <div
        style={{
          padding: '8px 14px',
          fontSize: 11,
          color: V.textSecondary,
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          fontWeight: 600,
        }}
      >
        {t.sitemapAudit.orphanedPagesDesc}
      </div>
      {pages.map((page) => (
        <div key={`${page.collection}-${page.id}`} style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                color: V.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <HoverPreview content={<>{page.title}<br />/{page.slug}</>}>
                <span>{page.title || t.common.noTitle}</span>
              </HoverPreview>
              <ScoreBadge score={scoreMap.get(page.slug)} />
            </div>
            <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
              <CollectionBadge collection={page.collection} articleLabel={t.common.article} />{' '}
              <span style={{ marginLeft: 4 }}>/{page.slug}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: V.red,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: 'rgba(239,68,68,0.1)',
              }}
            >
              {t.sitemapAudit.zeroIncomingLinks}
            </span>
            <EditButton collection={page.collection} id={page.id} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WeakTab (C3: score badge, C4: anchor text, C5: hover preview)
// ---------------------------------------------------------------------------
function WeakTab({ pages, scoreMap }: { pages: WeakPage[]; scoreMap: Map<string, number> }) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  if (pages.length === 0) {
    return <EmptyState message={t.sitemapAudit.noFragilePages} />
  }
  return (
    <div>
      <div
        style={{
          padding: '8px 14px',
          fontSize: 11,
          color: V.textSecondary,
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          fontWeight: 600,
        }}
      >
        {t.sitemapAudit.fragilePagesDesc}
      </div>
      {pages.map((page) => (
        <div key={`${page.collection}-${page.id}`} style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                color: V.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {page.title || t.common.noTitle}
              <ScoreBadge score={scoreMap.get(page.slug)} />
            </div>
            <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
              <CollectionBadge collection={page.collection} articleLabel={t.common.article} />{' '}
              <span style={{ marginLeft: 4 }}>/{page.slug}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: V.orange,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(249,115,22,0.1)',
                }}
              >
                {t.sitemapAudit.oneIncomingLink}
              </span>
              {page.incomingFrom && page.incomingFrom.length > 0 && (
                <div style={{ fontSize: 9, color: V.textSecondary, marginTop: 2 }}>
                  <HoverPreview
                    content={
                      <>
                        <div style={{ fontWeight: 700 }}>/{page.incomingFrom[0].slug}</div>
                        {page.incomingFrom[0].anchorText && (
                          <div style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.85 }}>
                            &laquo; {page.incomingFrom[0].anchorText} &raquo;
                          </div>
                        )}
                      </>
                    }
                  >
                    <span>{t.sitemapAudit.from} /{page.incomingFrom[0].slug}</span>
                  </HoverPreview>
                  {page.incomingFrom[0].anchorText && (
                    <div style={{ fontSize: 9, color: V.textSecondary, fontStyle: 'italic', marginTop: 1 }}>
                      {t.sitemapAudit.anchor} &laquo; {page.incomingFrom[0].anchorText} &raquo;
                    </div>
                  )}
                </div>
              )}
            </div>
            <EditButton collection={page.collection} id={page.id} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HubsTab
// ---------------------------------------------------------------------------
function HubsTab({ hubs }: { hubs: LinkHub[] }) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  if (hubs.length === 0) {
    return <EmptyState message={t.sitemapAudit.noLinkHubs} />
  }
  return (
    <div>
      <div
        style={{
          padding: '8px 14px',
          fontSize: 11,
          color: V.textSecondary,
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          fontWeight: 600,
        }}
      >
        {t.sitemapAudit.linkHubsDesc}
      </div>
      {hubs.map((hub) => (
        <div key={`${hub.collection}-${hub.id}`} style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                color: V.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hub.title || t.common.noTitle}
            </div>
            <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
              <CollectionBadge collection={hub.collection} articleLabel={t.common.article} />{' '}
              <span style={{ marginLeft: 4 }}>/{hub.slug}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: V.purple,
                padding: '2px 10px',
                borderRadius: 6,
                backgroundColor: 'rgba(139,92,246,0.1)',
              }}
            >
              {hub.outgoingCount} {t.sitemapAudit.links}
            </span>
            <EditButton collection={hub.collection} id={hub.id} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BrokenTab (C1: suggestions, C2: redirect button, C5: hover preview, bulk)
// ---------------------------------------------------------------------------
function BrokenTab({ links, onRefresh }: { links: BrokenLink[]; onRefresh: () => void }) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [createdRedirects, setCreatedRedirects] = useState<Set<string>>(new Set())
  const [loadingRedirects, setLoadingRedirects] = useState<Set<string>>(new Set())
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: number } | null>(null)

  const handleCreateRedirect = useCallback(async (from: string, to: string) => {
    const key = from
    setLoadingRedirects((prev) => new Set(prev).add(key))
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `/${from}`, to: `/${to}`, type: '301' }),
      })
      if (res.ok) {
        setCreatedRedirects((prev) => new Set(prev).add(key))
      }
    } catch {
      // Silently fail — button stays in default state
    }
    setLoadingRedirects((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  // Bulk create: all selected links with a suggestion or manual input
  const handleBulkCreate = useCallback(async () => {
    const redirects: Array<{ from: string; to: string; type: string }> = []

    for (const link of links) {
      const key = `${link.sourceSlug}::${link.targetSlug}`
      if (!selectedIds.has(key) || createdRedirects.has(link.targetSlug)) continue
      const to = link.suggestedSlug || manualInputs[key]
      if (to) {
        redirects.push({ from: `/${link.targetSlug}`, to: `/${to}`, type: '301' })
      }
    }

    if (redirects.length === 0) return

    setBulkLoading(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirects }),
      })
      if (res.ok) {
        const json = await res.json()
        setBulkResult({ created: json.created || 0, errors: json.errors || 0 })
        // Mark created redirects
        for (const r of redirects) {
          const slug = r.from.replace(/^\/+/, '')
          setCreatedRedirects((prev) => new Set(prev).add(slug))
        }
        setSelectedIds(new Set())
        // Auto-refresh data after bulk creation
        setTimeout(() => onRefresh(), 1000)
      }
    } catch {
      setBulkResult({ created: 0, errors: redirects.length })
    }
    setBulkLoading(false)
  }, [links, selectedIds, createdRedirects, manualInputs, onRefresh])

  // Bulk create ALL with suggestions (no selection needed)
  const handleBulkCreateAll = useCallback(async () => {
    const redirects: Array<{ from: string; to: string; type: string }> = []

    for (const link of links) {
      if (createdRedirects.has(link.targetSlug)) continue
      const inputKey = `${link.sourceSlug}::${link.targetSlug}`
      const to = link.suggestedSlug || manualInputs[inputKey]
      if (to) {
        redirects.push({ from: `/${link.targetSlug}`, to: `/${to}`, type: '301' })
      }
    }

    if (redirects.length === 0) return

    setBulkLoading(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirects }),
      })
      if (res.ok) {
        const json = await res.json()
        setBulkResult({ created: json.created || 0, errors: json.errors || 0 })
        for (const r of redirects) {
          const slug = r.from.replace(/^\/+/, '')
          setCreatedRedirects((prev) => new Set(prev).add(slug))
        }
        // Auto-refresh data after bulk creation
        setTimeout(() => onRefresh(), 1000)
      }
    } catch {
      setBulkResult({ created: 0, errors: redirects.length })
    }
    setBulkLoading(false)
  }, [links, createdRedirects, manualInputs, onRefresh])

  const toggleSelect = useCallback((key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === links.length) {
      setSelectedIds(new Set())
    } else {
      const all = new Set(links.map((l) => `${l.sourceSlug}::${l.targetSlug}`))
      setSelectedIds(all)
    }
  }, [links, selectedIds.size])

  // Count links with suggestions (actionable for bulk)
  const withSuggestionCount = useMemo(
    () => links.filter((l) => !createdRedirects.has(l.targetSlug) && (l.suggestedSlug || manualInputs[l.targetSlug])).length,
    [links, createdRedirects, manualInputs],
  )

  const selectedWithSuggestion = useMemo(() => {
    let count = 0
    for (const link of links) {
      const key = `${link.sourceSlug}::${link.targetSlug}`
      if (selectedIds.has(key) && !createdRedirects.has(link.targetSlug) && (link.suggestedSlug || manualInputs[link.targetSlug])) {
        count++
      }
    }
    return count
  }, [links, selectedIds, createdRedirects, manualInputs])

  if (links.length === 0) {
    return <EmptyState message={t.sitemapAudit.noBrokenLinks} />
  }
  return (
    <div>
      {/* Bulk action bar */}
      <div
        style={{
          padding: '8px 14px',
          fontSize: 11,
          color: V.textSecondary,
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          {t.sitemapAudit.brokenLinksDesc}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {bulkResult && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: bulkResult.errors > 0 ? V.orange : V.green,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: bulkResult.errors > 0 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
              }}
            >
              {bulkResult.created} {t.sitemapAudit.created}{bulkResult.errors > 0 ? `, ${bulkResult.errors} ${t.sitemapAudit.errors}` : ''}
            </span>
          )}
          {selectedIds.size > 0 && (
            <button
              disabled={bulkLoading || selectedWithSuggestion === 0}
              onClick={handleBulkCreate}
              style={{
                ...btnBase,
                fontSize: 10,
                padding: '4px 12px',
                backgroundColor: selectedWithSuggestion > 0 ? V.blue : V.bgCard,
                color: selectedWithSuggestion > 0 ? '#fff' : V.textSecondary,
                border: 'none',
                opacity: bulkLoading || selectedWithSuggestion === 0 ? 0.5 : 1,
              }}
            >
              {bulkLoading ? '...' : `301 selection (${selectedWithSuggestion})`}
            </button>
          )}
          <button
            disabled={bulkLoading || withSuggestionCount === 0}
            onClick={handleBulkCreateAll}
            style={{
              ...btnBase,
              fontSize: 10,
              padding: '4px 12px',
              backgroundColor: withSuggestionCount > 0 ? V.green : V.bgCard,
              color: withSuggestionCount > 0 ? '#fff' : V.textSecondary,
              border: 'none',
              opacity: bulkLoading || withSuggestionCount === 0 ? 0.5 : 1,
            }}
          >
            {bulkLoading ? '...' : `301 tout (${withSuggestionCount})`}
          </button>
        </div>
      </div>
      {/* Select all row */}
      <div
        style={{
          padding: '4px 14px',
          borderBottom: `1px solid ${V.border}`,
          backgroundColor: V.bg,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          color: V.textSecondary,
        }}
      >
        <input
          type="checkbox"
          checked={selectedIds.size === links.length && links.length > 0}
          onChange={toggleSelectAll}
          style={{ cursor: 'pointer' }}
        />
        <span>{selectedIds.size > 0 ? `${selectedIds.size} ${t.sitemapAudit.selectedItems}` : t.sitemapAudit.selectAll}</span>
      </div>
      {links.map((link, idx) => {
        const key = `${link.sourceSlug}::${link.targetSlug}`
        const isCreated = createdRedirects.has(link.targetSlug)
        const isLoading = loadingRedirects.has(link.targetSlug)
        const manualTo = manualInputs[key] ?? ''
        const isSelected = selectedIds.has(key)

        return (
          <div
            key={`broken-${idx}`}
            style={{
              ...rowStyle,
              backgroundColor: isSelected ? 'rgba(59,130,246,0.04)' : undefined,
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(key)}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: V.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {link.sourceTitle || t.common.noTitle}
              </div>
              <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 2 }}>
                <CollectionBadge collection={link.collection} articleLabel={t.common.article} />{' '}
                <span style={{ marginLeft: 4 }}>/{link.sourceSlug}</span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: V.red,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  &#10007;
                </span>
                <HoverPreview content={<span style={{ fontFamily: 'monospace' }}>{link.targetUrl}</span>}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: V.red,
                      marginLeft: 4,
                      fontFamily: 'monospace',
                    }}
                  >
                    {link.targetUrl}
                  </span>
                </HoverPreview>
                <div style={{ fontSize: 9, color: V.textSecondary, marginTop: 2 }}>
                  slug: {link.targetSlug}
                </div>
                {/* C1: Suggestion display */}
                {link.suggestedSlug && (
                  <div style={{ fontSize: 9, color: V.green, fontWeight: 600, marginTop: 2 }}>
                    {t.sitemapAudit.suggestion} /{link.suggestedSlug}
                  </div>
                )}
                {/* C2: Redirect creation */}
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {isCreated ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: V.green,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(34,197,94,0.1)',
                      }}
                    >
                      &#10003; {t.sitemapAudit.createdLabel}
                    </span>
                  ) : (
                    <>
                      {!link.suggestedSlug && (
                        <input
                          type="text"
                          placeholder={t.sitemapAudit.targetSlug}
                          value={manualTo}
                          onChange={(e) =>
                            setManualInputs((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: `1px solid ${V.border}`,
                            fontSize: 10,
                            width: 100,
                            color: V.text,
                            backgroundColor: V.bg,
                          }}
                        />
                      )}
                      <button
                        disabled={isLoading || (!link.suggestedSlug && !manualTo)}
                        onClick={() => {
                          const to = link.suggestedSlug || manualTo
                          if (to) handleCreateRedirect(link.targetSlug, to)
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: `1px solid ${V.border}`,
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: isLoading || (!link.suggestedSlug && !manualTo) ? 'not-allowed' : 'pointer',
                          backgroundColor: V.bgCard,
                          color: V.text,
                          opacity: isLoading || (!link.suggestedSlug && !manualTo) ? 0.5 : 1,
                        }}
                      >
                        {isLoading ? '...' : '301 →'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <EditButton collection={link.collection} id={link.sourceId} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Logs404Tab sub-component — shows 404 errors from visitors
// ---------------------------------------------------------------------------
interface SeoLog {
  id: number | string
  url: string
  type: string
  count: number
  lastSeen: string
  referrer: string
  ignored: boolean
}

function Logs404Tab() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [logs, setLogs] = useState<SeoLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createdRedirects, setCreatedRedirects] = useState<Set<string>>(new Set())
  const [loadingRedirects, setLoadingRedirects] = useState<Set<string>>(new Set())
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/seo-logs', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setLogs(json.logs || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleCreateRedirect = useCallback(async (from: string, to: string) => {
    setLoadingRedirects((prev) => new Set(prev).add(from))
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, type: '301' }),
      })
      if (res.ok) {
        setCreatedRedirects((prev) => new Set(prev).add(from))
      }
    } catch { /* ignore */ }
    setLoadingRedirects((prev) => {
      const next = new Set(prev)
      next.delete(from)
      return next
    })
  }, [])

  const handleIgnore = useCallback(async (id: number | string) => {
    try {
      await fetch(`/api/seo-plugin/seo-logs?id=${id}&action=ignore`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setLogs((prev) => prev.filter((l) => l.id !== id))
    } catch { /* ignore */ }
  }, [])

  const handleDelete = useCallback(async (id: number | string) => {
    try {
      await fetch(`/api/seo-plugin/seo-logs?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setLogs((prev) => prev.filter((l) => l.id !== id))
    } catch { /* ignore */ }
  }, [])

  const handleBulkRedirect = useCallback(async () => {
    const redirects: Array<{ from: string; to: string; type: string }> = []
    for (const log of logs) {
      if (!selectedIds.has(String(log.id)) || createdRedirects.has(log.url)) continue
      const to = manualInputs[log.url]
      if (to) {
        redirects.push({ from: log.url, to: to.startsWith('/') ? to : `/${to}`, type: '301' })
      }
    }
    if (redirects.length === 0) return

    setBulkLoading(true)
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirects }),
      })
      if (res.ok) {
        for (const r of redirects) {
          setCreatedRedirects((prev) => new Set(prev).add(r.from))
        }
        setSelectedIds(new Set())
      }
    } catch { /* ignore */ }
    setBulkLoading(false)
  }, [logs, selectedIds, createdRedirects, manualInputs])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(logs.map((l) => String(l.id))))
    }
  }, [logs, selectedIds.size])

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: V.textSecondary, fontSize: 13 }}>
        {t.sitemapAudit.loading404}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: V.red, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          {t.common.loadingError}: {error}
        </div>
        <button
          onClick={fetchLogs}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          {t.common.retry}
        </button>
      </div>
    )
  }

  if (logs.length === 0) {
    return <EmptyState message={t.sitemapAudit.no404Errors} />
  }

  const selectedWithInput = logs.filter(
    (l) => selectedIds.has(String(l.id)) && !createdRedirects.has(l.url) && manualInputs[l.url],
  ).length

  return (
    <div>
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          fontSize: 11,
          color: V.textSecondary,
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          {t.sitemapAudit.pages404Desc}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {selectedIds.size > 0 && selectedWithInput > 0 && (
            <button
              disabled={bulkLoading}
              onClick={handleBulkRedirect}
              style={{
                ...btnBase,
                fontSize: 10,
                padding: '4px 12px',
                backgroundColor: V.blue,
                color: '#fff',
                border: 'none',
                opacity: bulkLoading ? 0.5 : 1,
              }}
            >
              {bulkLoading ? '...' : `301 selection (${selectedWithInput})`}
            </button>
          )}
          <button
            onClick={fetchLogs}
            style={{ ...btnBase, fontSize: 10, padding: '4px 12px', backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; {t.common.refresh}
          </button>
        </div>
      </div>

      {/* Select all row */}
      <div
        style={{
          padding: '4px 14px',
          borderBottom: `1px solid ${V.border}`,
          backgroundColor: V.bg,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          color: V.textSecondary,
        }}
      >
        <input
          type="checkbox"
          checked={selectedIds.size === logs.length && logs.length > 0}
          onChange={toggleSelectAll}
          style={{ cursor: 'pointer' }}
        />
        <span>{selectedIds.size > 0 ? `${selectedIds.size} ${t.sitemapAudit.selectedItems}` : t.sitemapAudit.selectAll}</span>
      </div>

      {/* Log rows */}
      {logs.map((log) => {
        const isCreated = createdRedirects.has(log.url)
        const isLoading = loadingRedirects.has(log.url)
        const isSelected = selectedIds.has(String(log.id))
        const manualTo = manualInputs[log.url] ?? ''

        return (
          <div
            key={log.id}
            style={{
              ...rowStyle,
              backgroundColor: isSelected ? 'rgba(59,130,246,0.04)' : undefined,
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(String(log.id))}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: V.red,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {log.url}
              </div>
              <div style={{ fontSize: 9, color: V.textSecondary, marginTop: 2, display: 'flex', gap: 8 }}>
                <span style={{ fontWeight: 700, color: V.orange }}>
                  {log.count}x
                </span>
                <span>
                  {t.sitemapAudit.last} {log.lastSeen ? new Date(log.lastSeen).toLocaleDateString(locale) : '?'}
                </span>
                {log.referrer && (
                  <span title={log.referrer}>
                    {t.sitemapAudit.ref} {log.referrer.length > 30 ? log.referrer.slice(0, 28) + '...' : log.referrer}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isCreated ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: V.green,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(34,197,94,0.1)',
                  }}
                >
                  &#10003; 301
                </span>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t.sitemapAudit.targetSlug}
                    value={manualTo}
                    onChange={(e) =>
                      setManualInputs((prev) => ({ ...prev, [log.url]: e.target.value }))
                    }
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: `1px solid ${V.border}`,
                      fontSize: 10,
                      width: 120,
                      color: V.text,
                      backgroundColor: V.bg,
                    }}
                  />
                  <button
                    disabled={isLoading || !manualTo}
                    onClick={() => {
                      if (manualTo) {
                        const to = manualTo.startsWith('/') ? manualTo : `/${manualTo}`
                        handleCreateRedirect(log.url, to)
                      }
                    }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: `1px solid ${V.border}`,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: isLoading || !manualTo ? 'not-allowed' : 'pointer',
                      backgroundColor: V.bgCard,
                      color: V.text,
                      opacity: isLoading || !manualTo ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? '...' : '301 →'}
                  </button>
                </>
              )}
              <button
                onClick={() => handleIgnore(log.id)}
                title={t.sitemapAudit.ignore}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${V.border}`,
                  fontSize: 10,
                  cursor: 'pointer',
                  backgroundColor: V.bg,
                  color: V.textSecondary,
                }}
              >
                &#128065;
              </button>
              <button
                onClick={() => handleDelete(log.id)}
                title={t.common.delete}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${V.border}`,
                  fontSize: 10,
                  cursor: 'pointer',
                  backgroundColor: V.bg,
                  color: V.red,
                }}
              >
                &#128465;
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExternalLinksTab sub-component
// ---------------------------------------------------------------------------
type ExternalFilter = 'all' | 'broken' | 'ok'

function ExternalLinksTab() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [data, setData] = useState<ExternalLinksData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ExternalFilter>('all')

  const handleScan = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo-plugin/external-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setLoading(false)
  }, [t])

  const handleExportCSV = useCallback(() => {
    if (!data) return
    const broken = data.results.filter((r) => !r.ok)
    const rows: string[][] = [['URL', 'Statut', 'Erreur', 'Pages sources']]
    for (const r of broken) {
      rows.push([
        r.url,
        String(r.status),
        r.error || '',
        r.sourcePages.map((p) => `/${p.slug} (${p.collection})`).join('; '),
      ])
    }
    const csvContent = rows
      .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const now = new Date().toISOString().split('T')[0]
    const a = document.createElement('a')
    a.href = url
    a.download = `external-links-broken-${now}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  const filteredResults = useMemo(() => {
    if (!data) return []
    if (filter === 'broken') return data.results.filter((r) => !r.ok)
    if (filter === 'ok') return data.results.filter((r) => r.ok)
    return data.results
  }, [data, filter])

  // Initial state: prompt to scan
  if (!data && !loading && !error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>&#128279;</div>
        <div style={{ fontSize: 13, color: V.textSecondary, marginBottom: 16 }}>
          {t.sitemapAudit.checkExternalLinksDesc}
        </div>
        <button
          onClick={() => handleScan()}
          style={{
            ...btnBase,
            backgroundColor: V.cyan,
            color: '#000',
            border: 'none',
            padding: '10px 24px',
            fontSize: 12,
          }}
        >
          {t.sitemapAudit.scanExternalLinks}
        </button>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: V.textSecondary, fontSize: 13 }}>
        <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>&#8635;</div>
        {t.sitemapAudit.verificationInProgress}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: V.red, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          {t.common.loadingError}: {error}
        </div>
        <button
          onClick={() => handleScan()}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          {t.common.retry}
        </button>
      </div>
    )
  }

  if (!data) return null

  const { stats } = data

  return (
    <div>
      {/* Stats bar */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: V.bgCard,
          borderBottom: `1px solid ${V.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: V.text }}>{stats.total} {t.sitemapAudit.total}</span>
          <span style={{ color: V.green }}>{stats.ok} {t.common.ok}</span>
          <span style={{ color: V.red }}>{stats.broken + stats.timeout} {t.sitemapAudit.broken}</span>
          {stats.timeout > 0 && (
            <span style={{ color: V.orange }}>{stats.timeout} {t.sitemapAudit.timeout}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Filter toggles */}
          {(['all', 'broken', 'ok'] as ExternalFilter[]).map((f) => {
            const active = filter === f
            const label = f === 'all' ? t.sitemapAudit.all : f === 'broken' ? t.sitemapAudit.brokenLabel : t.common.ok
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: active ? `2px solid ${V.cyan}` : `1px solid ${V.border}`,
                  backgroundColor: active ? `rgba(6,182,212,0.1)` : V.bg,
                  color: active ? V.cyan : V.textSecondary,
                  fontWeight: active ? 800 : 600,
                  fontSize: 10,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </button>
            )
          })}
          {/* Export CSV (broken only) */}
          {stats.broken + stats.timeout > 0 && (
            <button
              onClick={handleExportCSV}
              style={{
                ...btnBase,
                fontSize: 10,
                padding: '3px 10px',
                backgroundColor: V.bgCard,
                color: V.text,
              }}
            >
              {t.common.exportCsv}
            </button>
          )}
          {/* Rescan */}
          <button
            onClick={() => handleScan(true)}
            style={{
              ...btnBase,
              fontSize: 10,
              padding: '3px 10px',
              backgroundColor: V.bgCard,
              color: V.text,
            }}
            title={t.sitemapAudit.forceNewVerification}
          >
            &#8635; {t.sitemapAudit.rescan}
          </button>
        </div>
      </div>

      {/* Results table */}
      {filteredResults.length === 0 ? (
        <EmptyState message={filter === 'broken' ? t.sitemapAudit.noBrokenLinks : t.sitemapAudit.noExternalLinks} />
      ) : (
        filteredResults.map((result, idx) => (
          <div key={`ext-${idx}`} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 11,
                  color: V.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: 'monospace',
                }}
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: result.ok ? V.blue : V.red, textDecoration: 'none' }}
                  title={result.url}
                >
                  {result.url.length > 60 ? result.url.substring(0, 60) + '...' : result.url}
                </a>
              </div>
              <div style={{ fontSize: 9, color: V.textSecondary, marginTop: 2 }}>
                {result.sourcePages.map((p, i) => (
                  <span key={`src-${i}`}>
                    {i > 0 && ', '}
                    <CollectionBadge collection={p.collection} articleLabel={t.common.article} />{' '}
                    <span style={{ marginLeft: 2 }}>/{p.slug}</span>
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}
            >
              {/* Status badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  backgroundColor: result.ok
                    ? 'rgba(34,197,94,0.1)'
                    : 'rgba(239,68,68,0.1)',
                  color: result.ok ? V.green : V.red,
                }}
              >
                {result.ok ? (
                  <>&#10003; {result.status}</>
                ) : result.error ? (
                  <>{result.error.toUpperCase()}</>
                ) : (
                  <>&#10007; {result.status}</>
                )}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export helpers (C6)
// ---------------------------------------------------------------------------
function exportJSON(data: SitemapAuditData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const now = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `sitemap-audit-${now}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(data: SitemapAuditData, t: ReturnType<typeof getDashboardT>) {
  const rows: string[][] = [['type', 'slug', 'title', 'collection', 'details']]

  for (const p of data.orphanPages) {
    rows.push(['orphan', p.slug, p.title, p.collection, t.sitemapAudit.zeroIncomingLinks])
  }
  for (const p of data.weakPages) {
    const from = p.incomingFrom?.[0]?.slug || '?'
    rows.push(['weak', p.slug, p.title, p.collection, `${t.sitemapAudit.oneIncomingLink} ${t.sitemapAudit.from} /${from}`])
  }
  for (const h of data.linkHubs) {
    rows.push(['hub', h.slug, h.title, h.collection, `${h.outgoingCount} ${t.sitemapAudit.links}`])
  }
  for (const b of data.brokenLinks) {
    rows.push(['broken-source', b.sourceSlug, b.sourceTitle, b.collection, `${t.sitemapAudit.brokenLinkTo} /${b.targetSlug}`])
  }

  const csvContent = rows
    .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const now = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `sitemap-audit-${now}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main SitemapAuditView component
// ---------------------------------------------------------------------------
export function SitemapAuditView() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [data, setData] = useState<SitemapAuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('orphan')
  const [search, setSearch] = useState('')
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map())
  const [logs404Count, setLogs404Count] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // C3: Parallel fetch for sitemap audit + SEO scores + 404 logs count
      const [sitemapRes, auditRes, logsRes] = await Promise.all([
        fetch('/api/seo-plugin/sitemap-audit', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/seo-plugin/audit', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/seo-plugin/seo-logs', { credentials: 'include', cache: 'no-store' }).catch(() => null),
      ])
      if (!sitemapRes.ok) throw new Error(`HTTP ${sitemapRes.status}`)
      const json = await sitemapRes.json()
      setData(json)

      // Build score map from audit results
      if (auditRes.ok) {
        try {
          const auditJson = await auditRes.json()
          const results = auditJson.results || auditJson
          if (Array.isArray(results)) {
            const map = new Map<string, number>()
            for (const item of results) {
              if (item.slug && typeof item.score === 'number') {
                map.set(item.slug, item.score)
              }
            }
            setScoreMap(map)
          }
        } catch {
          // Non-critical — proceed without scores
        }
      }

      // Fetch 404 logs count
      if (logsRes && logsRes.ok) {
        try {
          const logsJson = await logsRes.json()
          setLogs404Count(logsJson.logs?.length || 0)
        } catch { /* ignore */ }
      }

      // Auto-select the tab with most critical issues
      if (json.stats.brokenCount > 0) setActiveTab('broken')
      else if (json.stats.orphanCount > 0) setActiveTab('orphan')
      else if (json.stats.weakCount > 0) setActiveTab('weak')
      else setActiveTab('hubs')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter items based on search
  const filtered = useMemo(() => {
    if (!data) return null
    const q = search.toLowerCase().trim()
    if (!q) return data

    return {
      ...data,
      orphanPages: data.orphanPages.filter(
        (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      ),
      weakPages: data.weakPages.filter(
        (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      ),
      linkHubs: data.linkHubs.filter(
        (h) => h.title.toLowerCase().includes(q) || h.slug.toLowerCase().includes(q),
      ),
      brokenLinks: data.brokenLinks.filter(
        (l) =>
          l.sourceTitle.toLowerCase().includes(q) ||
          l.sourceSlug.toLowerCase().includes(q) ||
          l.targetSlug.toLowerCase().includes(q) ||
          l.targetUrl.toLowerCase().includes(q),
      ),
    }
  }, [data, search])

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
        {t.sitemapAudit.analyzingInternal}
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
          onClick={fetchData}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          {t.common.retry}
        </button>
      </div>
    )
  }

  if (!data || !filtered) return null

  const { stats } = data

  return (
    <div
      style={{
        padding: '20px 24px',
        maxWidth: 1400,
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
            {t.sitemapAudit.title}
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {stats.totalPages} {t.common.page.toLowerCase()}s, {stats.totalLinks} {t.sitemapAudit.links}
          </p>
        </div>
        {/* C6: Export buttons + Refresh */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => exportJSON(data)}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            {t.common.exportJson}
          </button>
          <button
            onClick={() => exportCSV(data, t)}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            {t.common.exportCsv}
          </button>
          <button
            onClick={fetchData}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; {t.common.refresh}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label={t.sitemapAudit.totalPages} value={stats.totalPages} color={V.blue} />
        <StatCard label={t.sitemapAudit.internalLinks} value={stats.totalLinks} color={V.cyan} />
        <StatCard
          label={t.sitemapAudit.linksPerPage}
          value={stats.avgLinksPerPage}
          color={stats.avgLinksPerPage >= 3 ? V.green : V.yellow}
          subtitle={t.sitemapAudit.average}
        />
        <StatCard
          label={t.sitemapAudit.orphaned}
          value={stats.orphanCount}
          color={stats.orphanCount === 0 ? V.green : V.red}
        />
        <StatCard
          label={t.sitemapAudit.fragile}
          value={stats.weakCount}
          color={stats.weakCount === 0 ? V.green : V.orange}
        />
        <StatCard
          label={t.sitemapAudit.brokenLinks}
          value={stats.brokenCount}
          color={stats.brokenCount === 0 ? V.green : V.red}
        />
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder={t.sitemapAudit.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${V.border}`,
            fontSize: 12,
            minWidth: 280,
            color: V.text,
            backgroundColor: V.bg,
          }}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <TabButton
          active={activeTab === 'orphan'}
          label={t.sitemapAudit.orphanedPages}
          count={filtered.orphanPages.length}
          color={V.red}
          onClick={() => setActiveTab('orphan')}
        />
        <TabButton
          active={activeTab === 'weak'}
          label={t.sitemapAudit.fragilePages}
          count={filtered.weakPages.length}
          color={V.orange}
          onClick={() => setActiveTab('weak')}
        />
        <TabButton
          active={activeTab === 'hubs'}
          label={t.sitemapAudit.linkHubs}
          count={filtered.linkHubs.length}
          color={V.purple}
          onClick={() => setActiveTab('hubs')}
        />
        <TabButton
          active={activeTab === 'broken'}
          label={t.sitemapAudit.brokenLinks}
          count={filtered.brokenLinks.length}
          color={V.red}
          onClick={() => setActiveTab('broken')}
        />
        <TabButton
          active={activeTab === 'logs404'}
          label={t.sitemapAudit.logs404}
          count={logs404Count}
          color={V.orange}
          onClick={() => setActiveTab('logs404')}
        />
        <TabButton
          active={activeTab === 'external'}
          label={t.sitemapAudit.externalLinks}
          count={0}
          color={V.cyan}
          onClick={() => setActiveTab('external')}
        />
      </div>

      {/* Tab content */}
      <div
        style={{
          border: `1px solid ${V.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {activeTab === 'orphan' && <OrphanTab pages={filtered.orphanPages} scoreMap={scoreMap} />}
        {activeTab === 'weak' && <WeakTab pages={filtered.weakPages} scoreMap={scoreMap} />}
        {activeTab === 'hubs' && <HubsTab hubs={filtered.linkHubs} />}
        {activeTab === 'broken' && <BrokenTab links={filtered.brokenLinks} onRefresh={fetchData} />}
        {activeTab === 'logs404' && <Logs404Tab />}
        {activeTab === 'external' && <ExternalLinksTab />}
      </div>
    </div>
  )
}
