'use client'

import React, { useState, useMemo } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// Design tokens — uses Payload CSS variables for theme compatibility
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
}

interface AuditItem {
  id: number | string
  collection: string
  title: string
  slug: string
  updatedAt: string
  contentLastReviewed: string
  daysSinceUpdate: number | null
}

export function ContentDecaySection({ items }: { items: AuditItem[] }) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [open, setOpen] = useState(false)
  const [markingReviewed, setMarkingReviewed] = useState<string | null>(null)
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set())

  const decayData = useMemo(() => {
    return items
      .map((item) => {
        const days =
          item.daysSinceUpdate ??
          (item.updatedAt
            ? Math.floor(
                (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
              )
            : null)
        let level: 'green' | 'yellow' | 'orange' | 'red' = 'green'
        if (days !== null) {
          if (days > 365) level = 'red'
          else if (days > 180) level = 'orange'
          else if (days > 90) level = 'yellow'
        }
        return { ...item, daysSinceUpdate: days, level }
      })
      .filter((item) => item.daysSinceUpdate !== null)
      .sort((a, b) => (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0))
  }, [items])

  const staleCount = decayData.filter((d) => d.level === 'orange' || d.level === 'red').length

  const levelColors: Record<string, string> = {
    green: V.green,
    yellow: V.yellow,
    orange: V.orange,
    red: V.red,
  }
  const levelLabels: Record<string, string> = {
    green: t.contentDecay.lessThan3Months,
    yellow: t.contentDecay.months3to6,
    orange: t.contentDecay.months6to12,
    red: t.contentDecay.moreThan12Months,
  }

  const handleMarkReviewed = async (item: AuditItem) => {
    const key = `${item.collection}-${item.id}`
    setMarkingReviewed(key)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/${item.collection}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentLastReviewed: today }),
      })
      if (res.ok) {
        setReviewedKeys((prev) => new Set(prev).add(key))
      }
    } catch {
      /* ignore */
    }
    setMarkingReviewed(null)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          borderRadius: 10,
          border: `1px solid ${open ? V.orange : V.border}`,
          backgroundColor: open ? 'rgba(245,158,11,0.06)' : V.bgCard,
          color: V.text,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          textTransform: 'uppercase' as const,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {t.contentDecay.title}
          {staleCount > 0 && (
            <span
              style={{
                marginLeft: 10,
                backgroundColor: V.orange,
                color: '#000',
                borderRadius: 10,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {staleCount}
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: V.textSecondary }}>
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: 16,
            border: `1px solid ${V.orange}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            backgroundColor: 'rgba(245,158,11,0.02)',
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: V.textSecondary,
              margin: '0 0 12px',
              lineHeight: 1.5,
            }}
          >
            {t.contentDecay.description}
          </p>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['green', 'yellow', 'orange', 'red'] as const).map((lvl) => {
              const count = decayData.filter((d) => d.level === lvl).length
              return (
                <div
                  key={lvl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      backgroundColor: levelColors[lvl],
                    }}
                  />
                  <span style={{ color: V.textSecondary }}>{levelLabels[lvl]}</span>
                  <span style={{ color: V.text }}>({count})</span>
                </div>
              )
            })}
          </div>

          {decayData.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: V.textSecondary,
                textAlign: 'center',
                padding: 20,
              }}
            >
              {t.contentDecay.noData}
            </div>
          ) : (
            <div
              style={{
                border: `1px solid ${V.border}`,
                borderRadius: 10,
                overflow: 'hidden',
                maxHeight: 400,
                overflowY: 'auto' as const,
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '12px 1fr 90px 90px 80px 100px',
                  padding: '8px 12px',
                  backgroundColor: V.bgCard,
                  borderBottom: `1px solid ${V.border}`,
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase' as const,
                  color: V.textSecondary,
                  letterSpacing: 0.5,
                  gap: 8,
                }}
              >
                <span></span>
                <span>{t.common.page}</span>
                <span>{t.contentDecay.lastUpdate}</span>
                <span>{t.contentDecay.lastReview}</span>
                <span>{t.contentDecay.ageDays}</span>
                <span>{t.contentDecay.action}</span>
              </div>

              {/* Table rows */}
              {decayData.slice(0, 30).map((item) => {
                const key = `${item.collection}-${item.id}`
                const wasReviewed = reviewedKeys.has(key)
                return (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '12px 1fr 90px 90px 80px 100px',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--theme-elevation-200)',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: levelColors[item.level],
                      }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: V.text,
                          whiteSpace: 'nowrap' as const,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title || t.common.noTitle}
                      </div>
                      <div style={{ fontSize: 10, color: V.textSecondary }}>
                        <span
                          style={{
                            padding: '0 4px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase' as const,
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
                    </div>
                    <div style={{ fontSize: 11, color: V.textSecondary }}>
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleDateString('fr-FR')
                        : '-'}
                    </div>
                    <div style={{ fontSize: 11, color: V.textSecondary }}>
                      {item.contentLastReviewed
                        ? new Date(item.contentLastReviewed).toLocaleDateString('fr-FR')
                        : '-'}
                    </div>
                    <div style={{ fontWeight: 700, color: levelColors[item.level] }}>
                      {item.daysSinceUpdate ?? '-'} j
                    </div>
                    <div>
                      {wasReviewed ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: V.green,
                            textTransform: 'uppercase' as const,
                          }}
                        >
                          {t.contentDecay.reviewed}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkReviewed(item)}
                          disabled={markingReviewed === key}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 5,
                            border: `1px solid ${V.border}`,
                            backgroundColor: markingReviewed === key ? V.bgCard : V.green,
                            color: markingReviewed === key ? V.textSecondary : '#fff',
                            fontWeight: 600,
                            fontSize: 9,
                            cursor: markingReviewed === key ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase' as const,
                            opacity: markingReviewed === key ? 0.6 : 1,
                          }}
                        >
                          {markingReviewed === key ? '...' : t.contentDecay.markReviewed}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
