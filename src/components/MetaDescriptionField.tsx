/**
 * MetaDescriptionField — Custom Payload CMS field component for meta description.
 *
 * Adds a character counter (120-160 optimal range) with color indicator,
 * a progress bar, and an optional "Generate" button that calls the
 * plugin's generate endpoint to auto-fill the description via user-provided
 * generate functions.
 *
 * This component is registered as a custom Field component on the
 * `meta.description` field when the SEO Analyzer plugin creates meta fields.
 */

'use client'

import React, { useCallback, useState } from 'react'
import { useField, useDocumentInfo } from '@payloadcms/ui'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetaDescriptionFieldProps {
  path: string
  hasGenerateFn?: boolean
  basePath?: string
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
// Constants
// ---------------------------------------------------------------------------

const DESC_MIN = 120
const DESC_MAX = 160

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCharColor(len: number): string {
  if (len === 0) return C.textSecondary
  if (len >= DESC_MIN && len <= DESC_MAX) return C.green
  if (len > 0 && len < DESC_MIN) return C.orange
  return C.red
}

function getProgressPercent(len: number): number {
  if (len === 0) return 0
  return Math.min((len / DESC_MAX) * 100, 100)
}

function getProgressColor(len: number): string {
  if (len === 0) return 'var(--theme-elevation-200, #e5e7eb)'
  if (len >= DESC_MIN && len <= DESC_MAX) return C.green
  if (len < DESC_MIN) return C.orange
  return C.red
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetaDescriptionField({
  path,
  hasGenerateFn = false,
  basePath = '/api/seo-plugin',
}: MetaDescriptionFieldProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)

  const { value, setValue } = useField<string>({ path })
  const { collectionSlug, globalSlug, id: docId } = useDocumentInfo()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const charCount = (value || '').length
  const charColor = getCharColor(charCount)
  const progressPercent = getProgressPercent(charCount)
  const progressColor = getProgressColor(charCount)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${basePath}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'description',
          collectionSlug: collectionSlug || undefined,
          globalSlug: globalSlug || undefined,
          docId: docId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t.common.serverError }))
        setError(data.error || `${t.common.serverError} ${res.status}`)
        return
      }

      const data = await res.json()
      if (data.result !== undefined) {
        setValue(data.result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.networkError)
    } finally {
      setLoading(false)
    }
  }, [basePath, collectionSlug, globalSlug, docId, setValue])

  return (
    <div
      style={{
        fontFamily: 'var(--font-body, Inter, system-ui, sans-serif)',
        marginBottom: 16,
      }}
    >
      {/* Label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.textPrimary,
          }}
        >
          {t.metaDescription.label}
        </label>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: charColor,
          }}
        >
          {charCount} / {DESC_MAX} {t.metaDescription.characters}
        </span>
      </div>

      {/* Textarea + Generate button row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.metaDescription.placeholder}
          rows={3}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            borderRadius: 8,
            border: `2px solid ${C.border}`,
            backgroundColor: C.surfaceBg,
            color: C.textPrimary,
            outline: 'none',
            resize: 'vertical' as const,
            lineHeight: 1.5,
            boxShadow: '2px 2px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
          }}
        />

        {hasGenerateFn && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 14px',
              borderRadius: 8,
              border: `2px solid ${C.border}`,
              backgroundColor: loading ? C.surface50 : C.cyan,
              color: loading ? C.textSecondary : C.black,
              fontWeight: 800,
              fontSize: 11,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '2px 2px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {loading ? t.common.generating : t.common.generate}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 6,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'var(--theme-elevation-200, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: progressColor,
            borderRadius: 2,
            transition: 'width 0.2s ease, background-color 0.2s ease',
          }}
        />
      </div>

      {/* Range hint */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 10,
          color: C.textSecondary,
        }}
      >
        <span>
          {t.metaDescription.optimal} {DESC_MIN}-{DESC_MAX} {t.metaDescription.characters}
        </span>
        <span
          style={{
            fontWeight: 700,
            color: charColor,
          }}
        >
          {charCount < DESC_MIN
            ? `${DESC_MIN - charCount} ${t.metaDescription.charactersMissing}`
            : charCount > DESC_MAX
              ? `${charCount - DESC_MAX} ${t.metaDescription.charactersTooMany}`
              : t.metaDescription.idealLength}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: 6,
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: C.red,
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: `1px solid ${C.red}`,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default MetaDescriptionField
