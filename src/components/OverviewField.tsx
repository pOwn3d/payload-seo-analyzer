/**
 * OverviewField — UI-only Payload CMS field that shows meta completeness.
 *
 * Displays three indicators (Title, Description, Image) with check/cross
 * status and a completeness progress bar (0/3 to 3/3). Uses Payload's
 * `useFormFields` hook to reactively read meta field values from the
 * current document form state.
 *
 * Intended for use in the editor sidebar as a quick glance overview.
 */

'use client'

import React, { useMemo } from 'react'
import { useFormFields } from '@payloadcms/ui'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewFieldProps {
  titlePath?: string
  descriptionPath?: string
  imagePath?: string
}

// ---------------------------------------------------------------------------
// Color palette (neubrutalist — matches SeoAnalyzer.tsx)
// ---------------------------------------------------------------------------

const C = {
  cyan: '#00E5FF',
  black: '#000',
  white: '#fff',
  green: '#22c55e',
  yellow: '#FFD600',
  orange: '#FF8A00',
  red: '#ef4444',
  textPrimary: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  border: 'var(--theme-border-color, #000)',
  surfaceBg: 'var(--theme-elevation-0, #fff)',
  surface50: 'var(--theme-elevation-50, #f9fafb)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCompletenessColor(count: number): string {
  switch (count) {
    case 0:
      return C.red
    case 1:
      return C.orange
    case 2:
      return C.yellow
    case 3:
      return C.green
    default:
      return C.textSecondary
  }
}

function getCompletenessLabel(count: number, ov: { incomplete: string; partial: string; almostComplete: string; complete: string }): string {
  switch (count) {
    case 0:
      return ov.incomplete
    case 1:
      return ov.partial
    case 2:
      return ov.almostComplete
    case 3:
      return ov.complete
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewField({
  titlePath = 'meta.title',
  descriptionPath = 'meta.description',
  imagePath = 'meta.image',
}: OverviewFieldProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)

  // Read all three meta field values reactively
  const formFields = useFormFields(([fields]) => ({
    title: fields[titlePath]?.value,
    description: fields[descriptionPath]?.value,
    image: fields[imagePath]?.value,
  }))

  const { hasTitle, hasDescription, hasImage, completedCount } = useMemo(() => {
    const title = formFields?.title
    const description = formFields?.description
    const image = formFields?.image

    const ht = typeof title === 'string' && title.trim().length > 0
    const hd = typeof description === 'string' && description.trim().length > 0
    const hi = image !== null && image !== undefined && image !== ''

    return {
      hasTitle: ht,
      hasDescription: hd,
      hasImage: hi,
      completedCount: (ht ? 1 : 0) + (hd ? 1 : 0) + (hi ? 1 : 0),
    }
  }, [formFields])

  const completenessColor = getCompletenessColor(completedCount)
  const completenessLabel = getCompletenessLabel(completedCount, t.overview)
  const completenessPercent = (completedCount / 3) * 100

  const indicators: Array<{ label: string; filled: boolean }> = [
    { label: t.overview.titleLabel, filled: hasTitle },
    { label: t.overview.descriptionLabel, filled: hasDescription },
    { label: t.overview.imageLabel, filled: hasImage },
  ]

  return (
    <div
      style={{
        fontFamily: 'var(--font-body, Inter, system-ui, sans-serif)',
        padding: '12px 14px',
        borderRadius: 10,
        border: `2px solid ${C.border}`,
        backgroundColor: C.surfaceBg,
        boxShadow: '3px 3px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            color: C.textPrimary,
          }}
        >
          {t.overview.metaCompleteness}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 800,
            backgroundColor: completenessColor,
            color: completenessColor === C.yellow ? C.black : C.white,
            border: `2px solid ${C.border}`,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.03em',
          }}
        >
          {completedCount}/3
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'var(--theme-elevation-200, #e5e7eb)',
          overflow: 'hidden',
          marginBottom: 10,
          border: '1px solid var(--theme-elevation-200, #e5e7eb)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${completenessPercent}%`,
            backgroundColor: completenessColor,
            borderRadius: 3,
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Status label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: completenessColor,
          textAlign: 'center' as const,
          marginBottom: 10,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
        }}
      >
        {completenessLabel}
      </div>

      {/* Indicators */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {indicators.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor: item.filled
                ? 'rgba(34,197,94,0.06)'
                : 'rgba(239,68,68,0.04)',
            }}
          >
            {/* Status icon */}
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 900,
                backgroundColor: item.filled
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)',
                color: item.filled ? '#16a34a' : '#dc2626',
                flexShrink: 0,
              }}
            >
              {item.filled ? '\u2713' : '\u2717'}
            </span>

            {/* Label */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: item.filled ? C.textPrimary : C.textSecondary,
              }}
            >
              {item.label}
            </span>

            {/* Status text */}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 700,
                color: item.filled ? C.green : C.red,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.03em',
              }}
            >
              {item.filled ? t.overview.set : t.overview.missing}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OverviewField
