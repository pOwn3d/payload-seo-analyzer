/**
 * MetaImageField — Custom Payload CMS field component for meta image.
 *
 * Displays a status indicator for the meta image and an optional
 * "Generate" button that calls the plugin's generate endpoint to
 * auto-fill the image reference via user-provided generate functions.
 *
 * This component does NOT render the actual upload field — Payload
 * handles that natively. It adds the generate button UI alongside
 * the native upload field.
 */

'use client'

import React, { useCallback, useState } from 'react'
import { useField, useDocumentInfo } from '@payloadcms/ui'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetaImageFieldProps {
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
// Component
// ---------------------------------------------------------------------------

export function MetaImageField({
  path,
  hasGenerateFn = false,
  basePath = '/api/seo-plugin',
}: MetaImageFieldProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)

  const { value, setValue } = useField<string | number | null>({ path })
  const { collectionSlug, globalSlug, id: docId } = useDocumentInfo()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const hasImage = value !== null && value !== undefined && value !== ''

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`${basePath}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
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
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
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
      {/* Status + Generate row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 8,
          border: `2px solid ${C.border}`,
          backgroundColor: C.surfaceBg,
          boxShadow: '2px 2px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
        }}
      >
        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 900,
              backgroundColor: hasImage ? 'rgba(34,197,94,0.15)' : 'rgba(255,138,0,0.15)',
              color: hasImage ? '#16a34a' : '#d97706',
              border: `1px solid ${hasImage ? C.green : C.orange}`,
            }}
          >
            {hasImage ? '\u2713' : '!'}
          </span>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.textPrimary,
              }}
            >
              {t.metaImage.label}
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textSecondary,
                lineHeight: 1.4,
              }}
            >
              {hasImage
                ? t.metaImage.imageSet
                : t.metaImage.noImage}
            </div>
          </div>
        </div>

        {/* Generate button */}
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
              backgroundColor: loading
                ? C.surface50
                : success
                  ? C.green
                  : C.cyan,
              color: loading
                ? C.textSecondary
                : success
                  ? C.white
                  : C.black,
              fontWeight: 800,
              fontSize: 11,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '2px 2px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
              transition: 'background-color 0.2s ease',
            }}
          >
            {loading ? t.common.generating : success ? `\u2713 ${t.metaImage.set}` : t.common.generate}
          </button>
        )}
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

export default MetaImageField
