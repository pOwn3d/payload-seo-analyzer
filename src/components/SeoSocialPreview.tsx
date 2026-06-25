'use client'

import React, { useState } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface SeoSocialPreviewProps {
  metaTitle?: string
  metaDescription?: string
  imageUrl?: string
  hostname?: string
}

// ---------------------------------------------------------------------------
// Color palette (neubrutalist — matches SeoAnalyzer.tsx)
// ---------------------------------------------------------------------------
const C = {
  cyan: '#00E5FF',
  black: '#000',
  white: '#fff',
  bg: '#fafafa',
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
function charCountColor(len: number, min: number, max: number): string {
  if (len >= min && len <= max) return C.green
  if (len > 0 && len < min) return C.orange
  if (len > max) return C.red
  return C.textSecondary
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SeoSocialPreview({
  metaTitle,
  metaDescription,
  imageUrl,
  hostname,
}: SeoSocialPreviewProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'facebook' | 'twitter'>('facebook')

  const title = metaTitle || ''
  const desc = metaDescription || ''
  const host = hostname || 'example.com'

  // Truncated values for preview display
  const fbTitle = title || t.socialPreview.pageTitlePlaceholder
  const fbDesc = desc || t.socialPreview.pageDescriptionPlaceholder
  const twTitle = title || t.socialPreview.pageTitlePlaceholder
  const twDesc = desc || t.socialPreview.pageDescriptionPlaceholder

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header — collapsible */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          cursor: 'pointer',
          borderRadius: 8,
          border: `2px solid ${C.border}`,
          backgroundColor: C.surface50,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: C.textPrimary,
          }}
        >
          {/* Share icon (SVG) */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {t.socialPreview.title}
        </span>
        <span
          style={{
            fontSize: 10,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            color: C.textSecondary,
          }}
        >
          {'\u25B6'}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div
          style={{
            padding: '12px 0 0',
          }}
        >
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <TabButton
              label={t.socialPreview.facebook}
              active={activeTab === 'facebook'}
              onClick={() => setActiveTab('facebook')}
            />
            <TabButton
              label={t.socialPreview.twitter}
              active={activeTab === 'twitter'}
              onClick={() => setActiveTab('twitter')}
            />
          </div>

          {/* Facebook Preview */}
          {activeTab === 'facebook' && (
            <div>
              <div
                style={{
                  backgroundColor: '#f0f2f5',
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    border: '1px solid #dadde1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#fff',
                  }}
                >
                  {/* Image area */}
                  <ImagePlaceholder imageUrl={imageUrl} label={t.socialPreview.ogImage} />

                  {/* Content */}
                  <div style={{ padding: '10px 12px', backgroundColor: '#f0f2f5' }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#606770',
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}
                    >
                      {host}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1d2129',
                        lineHeight: 1.3,
                        marginTop: 4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {fbTitle}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#606770',
                        lineHeight: 1.4,
                        marginTop: 4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {fbDesc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Character counters */}
              <CharCounters titleLen={title.length} descLen={desc.length} titleLabel={t.socialPreview.previewTitle} descLabel={t.socialPreview.previewDescription} charsLabel={t.common.characters} />
            </div>
          )}

          {/* Twitter/X Preview */}
          {activeTab === 'twitter' && (
            <div>
              <div
                style={{
                  border: '1px solid #cfd9de',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                {/* Image area */}
                <ImagePlaceholder imageUrl={imageUrl} label={t.socialPreview.cardImage} />

                {/* Content */}
                <div style={{ padding: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#536471',
                    }}
                  >
                    {host}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#0f1419',
                      lineHeight: 1.3,
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {twTitle}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#536471',
                      lineHeight: 1.4,
                      marginTop: 4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {twDesc}
                  </div>
                </div>
              </div>

              {/* Character counters */}
              <CharCounters titleLen={title.length} descLen={desc.length} titleLabel={t.socialPreview.previewTitle} descLabel={t.socialPreview.previewDescription} charsLabel={t.common.characters} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: `2px solid ${C.border}`,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        backgroundColor: active ? C.cyan : C.surfaceBg,
        color: active ? C.black : C.textPrimary,
        boxShadow: active ? `2px 2px 0 0 ${C.border}` : 'none',
        transition: 'background-color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function ImagePlaceholder({
  imageUrl,
  label,
}: {
  imageUrl?: string
  label: string
}) {
  if (imageUrl) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#e4e6eb',
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#e4e6eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8a8d91',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 24 }}>{'\uD83D\uDCF7'}</span>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function CharCounters({ titleLen, descLen, titleLabel, descLabel, charsLabel }: { titleLen: number; descLen: number; titleLabel: string; descLabel: string; charsLabel: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginTop: 10,
        padding: '0 2px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: C.textSecondary, fontWeight: 600 }}>{titleLabel}</span>
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: charCountColor(titleLen, 30, 60),
          }}
        >
          {titleLen} / 60 {charsLabel}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: C.textSecondary, fontWeight: 600 }}>{descLabel}</span>
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: charCountColor(descLen, 120, 160),
          }}
        >
          {descLen} / 160 {charsLabel}
        </span>
      </div>
    </div>
  )
}

export default SeoSocialPreview
