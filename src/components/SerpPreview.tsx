'use client'

import React, { useState } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface SerpPreviewProps {
  metaTitle?: string
  metaDescription?: string
  slug?: string
  hostname?: string
  favicon?: string
}

// ---------------------------------------------------------------------------
// Color palette (neubrutalist — matches SeoAnalyzer.tsx & SeoSocialPreview.tsx)
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

// Google SERP specific colors (2025 style)
const G = {
  titleBlue: '#1a0dab',
  urlGrey: '#4d5156',
  descGrey: '#4d5156',
  faviconBg: '#e8eaed',
  serpBg: '#ffffff',
  hoverBg: '#f8f9fa',
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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars).trimEnd() + '...'
}

function buildBreadcrumb(hostname: string, slug?: string): string {
  const base = hostname.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!slug || slug === '/' || slug === '') return base
  const cleanSlug = slug.replace(/^\//, '').replace(/\/$/, '')
  const parts = cleanSlug.split('/')
  const breadcrumb = parts.map((p) => p.replace(/-/g, ' ')).join(' > ')
  return `${base} > ${breadcrumb}`
}

function buildFullUrl(hostname: string, slug?: string): string {
  const base = hostname.replace(/\/$/, '')
  const prefix = base.startsWith('http') ? base : `https://${base}`
  if (!slug || slug === '/' || slug === '') return prefix
  const cleanSlug = slug.replace(/^\//, '')
  return `${prefix}/${cleanSlug}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DeviceMode = 'desktop' | 'mobile'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SerpPreview({
  metaTitle,
  metaDescription,
  slug,
  hostname,
  favicon,
}: SerpPreviewProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [open, setOpen] = useState(false)
  const [device, setDevice] = useState<DeviceMode>('desktop')

  const title = metaTitle || ''
  const desc = metaDescription || ''
  const host = hostname || 'example.com'
  const fullUrl = buildFullUrl(host, slug)
  const breadcrumb = buildBreadcrumb(host, slug)

  const isDesktop = device === 'desktop'

  // Truncation limits per device
  const descMaxChars = isDesktop ? 160 : 120
  const displayDesc = desc ? truncateText(desc, descMaxChars) : ''

  // Title and URL max widths per device
  const titleMaxWidth = isDesktop ? 580 : 320
  const titleFontSize = isDesktop ? 20 : 16
  const descFontSize = isDesktop ? 14 : 13

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
          {/* Google search icon (SVG) */}
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {t.serpPreview.title}
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
        <div style={{ padding: '12px 0 0' }}>
          {/* Device switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <DeviceButton
              label={t.serpPreview.desktop}
              icon="desktop"
              active={device === 'desktop'}
              onClick={() => setDevice('desktop')}
            />
            <DeviceButton
              label={t.serpPreview.mobile}
              icon="mobile"
              active={device === 'mobile'}
              onClick={() => setDevice('mobile')}
            />
          </div>

          {/* SERP Preview container */}
          <div
            style={{
              backgroundColor: C.white,
              border: `2px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: `3px 3px 0 0 ${C.border}`,
              padding: isDesktop ? 20 : 14,
              maxWidth: isDesktop ? 650 : 380,
              overflow: 'hidden',
            }}
          >
            {/* Row 1: Favicon + domain + 3-dot menu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              {/* Favicon circle */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: G.faviconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {favicon ? (
                  <img
                    src={favicon}
                    alt=""
                    width={16}
                    height={16}
                    style={{
                      width: 16,
                      height: 16,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#bdc1c6',
                    }}
                  />
                )}
              </div>

              {/* Domain + breadcrumb */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 400,
                    color: C.black,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {host.replace(/^https?:\/\//, '')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: G.urlGrey,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {breadcrumb}
                </div>
              </div>

              {/* 3-dot menu (decorative) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  flexShrink: 0,
                  padding: '0 2px',
                }}
              >
                <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#70757a' }} />
                <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#70757a' }} />
                <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#70757a' }} />
              </div>
            </div>

            {/* Row 2: Title */}
            <div
              style={{
                fontSize: titleFontSize,
                fontWeight: 400,
                color: G.titleBlue,
                lineHeight: 1.3,
                marginTop: 6,
                maxWidth: titleMaxWidth,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {title ? (
                title
              ) : (
                <span
                  style={{
                    color: C.textSecondary,
                    fontStyle: 'italic',
                    fontSize: titleFontSize - 2,
                  }}
                >
                  {t.serpPreview.noMetaTitle}
                </span>
              )}
            </div>

            {/* Row 3: Description */}
            <div
              style={{
                fontSize: descFontSize,
                color: G.descGrey,
                lineHeight: 1.58,
                marginTop: 4,
                maxWidth: titleMaxWidth,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: isDesktop ? 3 : 2,
                WebkitBoxOrient: 'vertical',
                fontFamily: 'Arial, sans-serif',
                wordBreak: 'break-word',
              }}
            >
              {displayDesc ? (
                displayDesc
              ) : (
                <span
                  style={{
                    color: C.textSecondary,
                    fontStyle: 'italic',
                    fontSize: descFontSize - 1,
                  }}
                >
                  {t.serpPreview.noMetaDescription}
                </span>
              )}
            </div>
          </div>

          {/* Character counters */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 12,
              padding: '0 2px',
            }}
          >
            {/* Title counter */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
              }}
            >
              <span style={{ color: C.textSecondary, fontWeight: 600 }}>{t.serpPreview.previewTitle}</span>
              <span
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: charCountColor(title.length, 30, 60),
                }}
              >
                {title.length} / 60 {t.common.characters}
              </span>
            </div>

            {/* Description counter */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
              }}
            >
              <span style={{ color: C.textSecondary, fontWeight: 600 }}>{t.serpPreview.previewDescription}</span>
              <span
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: charCountColor(desc.length, 120, 160),
                }}
              >
                {desc.length} / 160 {t.common.characters}
              </span>
            </div>

            {/* URL counter */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
              }}
            >
              <span style={{ color: C.textSecondary, fontWeight: 600 }}>{t.serpPreview.url}</span>
              <span
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: fullUrl.length <= 75 ? C.green : C.red,
                }}
              >
                {fullUrl.length} / 75 {t.common.characters}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeviceButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: 'desktop' | 'mobile'
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
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
      {icon === 'desktop' ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      )}
      {label}
    </button>
  )
}

export default SerpPreview
