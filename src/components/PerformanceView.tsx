'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

// NOTE: xlsx (SheetJS) is loaded dynamically on the client side only.
// Known CVEs: CVE-2023-30533 (Prototype Pollution), CVE-2024-22363 (ReDoS).
// Risk is mitigated because parsing happens entirely in the browser (no server-side usage).
// The xlsx package is an optional peerDependency — users must install it separately
// to enable XLSX import functionality.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXModule = any

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

type Period = '7d' | '30d' | '90d'
type SortField = 'clicks' | 'impressions' | 'ctr' | 'position'
type SortDir = 'asc' | 'desc'

interface TopPage {
  url: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface TopQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface Summary {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

interface ImportResult {
  imported: number
  updated: number
  errors: number
}

// ---------------------------------------------------------------------------
// Shared styles
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

const cardStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderRadius: 10,
  border: `1px solid ${V.border}`,
  backgroundColor: V.bgCard,
  flex: '1 1 200px',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: V.textSecondary,
  letterSpacing: 0.5,
  borderBottom: `2px solid ${V.border}`,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  borderBottom: `1px solid ${V.border}`,
}

// ---------------------------------------------------------------------------
// Helper: sort array by field
// ---------------------------------------------------------------------------

function sortBy<T>(arr: T[], field: keyof T, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const va = a[field] as number
    const vb = b[field] as number
    return dir === 'asc' ? va - vb : vb - va
  })
}

// ---------------------------------------------------------------------------
// SummaryCard sub-component
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string
  value: string | number
  color: string
  suffix?: string
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: V.textSecondary,
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortableTable header cell
// ---------------------------------------------------------------------------

function SortTh({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  style,
}: {
  label: string
  field: SortField
  currentSort: SortField
  currentDir: SortDir
  onSort: (f: SortField) => void
  style?: React.CSSProperties
}) {
  const isActive = currentSort === field
  return (
    <th onClick={() => onSort(field)} style={{ ...thStyle, ...style }}>
      {label} {isActive ? (currentDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </th>
  )
}

// ---------------------------------------------------------------------------
// Main PerformanceView component
// ---------------------------------------------------------------------------

export function PerformanceView() {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [period, setPeriod] = useState<Period>('30d')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topPages, setTopPages] = useState<TopPage[]>([])
  const [topQueries, setTopQueries] = useState<TopQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Import state
  const [csvText, setCsvText] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  // Sort state for tables
  const [pageSortField, setPageSortField] = useState<SortField>('clicks')
  const [pageSortDir, setPageSortDir] = useState<SortDir>('desc')
  const [querySortField, setQuerySortField] = useState<SortField>('clicks')
  const [querySortDir, setQuerySortDir] = useState<SortDir>('desc')

  // Fetch performance data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo-plugin/performance?period=${period}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSummary(data.summary || null)
      setTopPages(data.topPages || [])
      setTopQueries(data.topQueries || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setLoading(false)
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle file upload (CSV or XLSX)
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (isXlsx) {
      // Parse XLSX with SheetJS (dynamic import — client-side only)
      const reader = new FileReader()
      reader.onload = async (evt) => {
        try {
          // @ts-ignore — xlsx is an optional dependency loaded dynamically
          const xlsxMod: XLSXModule = await import(/* webpackIgnore: true */ 'xlsx')
          const data = new Uint8Array(evt.target?.result as ArrayBuffer)
          const workbook = xlsxMod.read(data, { type: 'array' })

          const todayISO = new Date().toISOString().split('T')[0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allEntries: any[] = []

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]
            const rows = xlsxMod.utils.sheet_to_json(sheet) as Record<string, any>[]

            for (const row of rows) {
              // Normalize header keys to lowercase
              const normalized: Record<string, string> = {}
              for (const [k, v] of Object.entries(row)) {
                normalized[k.toLowerCase().trim()] = String(v ?? '').trim()
              }

              // Extract URL from various header formats
              const urlVal = normalized.url || normalized.page || normalized.pages
                || normalized['pages les plus populaires'] || ''
              // Extract query
              const queryVal = normalized.query || normalized.queries
                || normalized['top queries'] || normalized['requêtes les plus fréquentes']
                || normalized.requete || normalized['requête'] || ''
              // Extract date
              const dateVal = normalized.date || ''

              // Need at least a URL or query
              if (!urlVal && !queryVal) continue

              // Parse CTR (remove % sign)
              const ctrRaw = normalized.ctr || '0'
              const ctr = parseFloat(ctrRaw.replace('%', '').replace(',', '.')) || 0

              allEntries.push({
                url: urlVal || '/',
                query: queryVal || undefined,
                clicks: parseFloat(normalized.clicks || normalized.clics || '0') || 0,
                impressions: parseFloat(normalized.impressions || '0') || 0,
                ctr,
                position: parseFloat((normalized.position || '0').replace(',', '.')) || 0,
                date: dateVal || todayISO,
              })
            }
          }

          if (allEntries.length > 0) {
            // Set as JSON entries for import
            setJsonText(JSON.stringify(allEntries))
            setCsvText('')
          } else {
            setCsvText('')
            setJsonText('')
          }
        } catch {
          setCsvText('')
          setJsonText('')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      // CSV/TSV — read as text
      const reader = new FileReader()
      reader.onload = (evt) => {
        setCsvText(evt.target?.result as string || '')
      }
      reader.readAsText(file, 'utf-8')
    }
  }, [])

  // Handle import
  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const body: Record<string, unknown> = {}

      if (csvText.trim()) {
        body.csv = csvText
      } else if (jsonText.trim()) {
        try {
          const parsed = JSON.parse(jsonText)
          if (Array.isArray(parsed)) {
            body.entries = parsed
          } else if (parsed.entries) {
            body.entries = parsed.entries
          }
        } catch {
          setImportError('Invalid JSON')
          setImporting(false)
          return
        }
      } else {
        setImportError(t.performance.noData)
        setImporting(false)
        return
      }

      const res = await fetch('/api/seo-plugin/performance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const result = await res.json()
      setImportResult(result)
      setCsvText('')
      setJsonText('')

      // Refresh data after import
      await fetchData()
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : t.common.loadingError)
    }
    setImporting(false)
  }, [csvText, jsonText, fetchData])

  // Sort handlers
  const handlePageSort = useCallback(
    (field: SortField) => {
      if (pageSortField === field) {
        setPageSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setPageSortField(field)
        setPageSortDir('desc')
      }
    },
    [pageSortField],
  )

  const handleQuerySort = useCallback(
    (field: SortField) => {
      if (querySortField === field) {
        setQuerySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setQuerySortField(field)
        setQuerySortDir('desc')
      }
    },
    [querySortField],
  )

  // Sorted data
  const sortedPages = useMemo(
    () => sortBy(topPages, pageSortField, pageSortDir),
    [topPages, pageSortField, pageSortDir],
  )

  const sortedQueries = useMemo(
    () => sortBy(topQueries, querySortField, querySortDir),
    [topQueries, querySortField, querySortDir],
  )

  // Export CSV
  const handleExportCsv = useCallback(() => {
    const headers = ['URL', t.performance.clicks, t.performance.impressions, t.performance.ctrPercent, t.performance.position]
    const rows = sortedPages.map((p) => [p.url, p.clicks, p.impressions, p.ctr, p.position])

    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seo-performance-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [sortedPages, period])

  // Has data?
  const hasData = topPages.length > 0 || topQueries.length > 0

  // Period labels
  const periodLabels: Record<Period, string> = {
    '7d': t.performance.days7,
    '30d': t.performance.days30,
    '90d': t.performance.days90,
  }

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
        {t.performance.loading}
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
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={fetchData}
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
        maxWidth: 1200,
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
            {t.performance.title}
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {t.performance.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period selector */}
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...btnBase,
                backgroundColor: period === p ? V.cyan : V.bgCard,
                color: period === p ? '#000' : V.text,
                fontWeight: period === p ? 800 : 600,
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
          <button
            onClick={() => setShowImport(!showImport)}
            style={{
              ...btnBase,
              backgroundColor: showImport ? V.blue : V.bgCard,
              color: showImport ? '#fff' : V.text,
            }}
          >
            {showImport ? t.performance.closeImport : t.performance.import}
          </button>
          <button
            onClick={fetchData}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; {t.common.refresh}
          </button>
          {hasData && (
            <button
              onClick={handleExportCsv}
              style={{ ...btnBase, backgroundColor: V.cyan, color: '#000' }}
            >
              {t.common.exportCsv}
            </button>
          )}
        </div>
      </div>

      {/* Import section */}
      {showImport && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            backgroundColor: V.bgCard,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: V.text, marginBottom: 12 }}>
            {t.performance.importGscData}
          </div>
          <p style={{ fontSize: 11, color: V.textSecondary, marginTop: 0, marginBottom: 16 }}>
            {t.performance.noDataDesc}
          </p>

          {/* File picker (CSV or XLSX) */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{ fontSize: 11, fontWeight: 700, color: V.textSecondary, display: 'block', marginBottom: 4 }}
            >
              {t.performance.fileType}
            </label>
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={handleFileUpload}
              style={{ fontSize: 12, color: V.text }}
            />
          </div>

          {/* CSV textarea preview */}
          {csvText && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: V.textSecondary,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                CSV ({csvText.split('\n').length} lines)
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  padding: 8,
                  border: `1px solid ${V.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: V.text,
                  backgroundColor: V.bg,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* XLSX parsed preview */}
          {!csvText && jsonText && (() => {
            try {
              const parsed = JSON.parse(jsonText)
              if (Array.isArray(parsed) && parsed.length > 0) {
                const withUrl = parsed.filter((e: { url?: string }) => e.url && e.url !== '/')
                const withQuery = parsed.filter((e: { query?: string }) => e.query)
                return (
                  <div style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    fontSize: 12,
                    color: V.text,
                  }}>
                    <strong>{parsed.length}</strong> {t.performance.xlsxEntriesLoaded}
                    {withUrl.length > 0 && <span> &mdash; {withUrl.length} {t.performance.pages}</span>}
                    {withQuery.length > 0 && <span> &mdash; {withQuery.length} {t.performance.queries}</span>}
                  </div>
                )
              }
            } catch { /* ignore */ }
            return null
          })()}

          {/* JSON textarea (alternative) */}
          {!csvText && !jsonText && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: V.textSecondary,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                {t.performance.pasteJsonHint}
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'[\n  { "url": "/page", "query": "mot clé", "clicks": 10, "impressions": 100, "ctr": 10, "position": 3.5, "date": "2025-01-15" }\n]'}
                rows={4}
                style={{
                  width: '100%',
                  padding: 8,
                  border: `1px solid ${V.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: V.text,
                  backgroundColor: V.bg,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Import button */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleImport}
              disabled={importing || (!csvText.trim() && !jsonText.trim())}
              style={{
                ...btnBase,
                backgroundColor:
                  !importing && (csvText.trim() || jsonText.trim()) ? V.green : V.bgCard,
                color: !importing && (csvText.trim() || jsonText.trim()) ? '#fff' : V.textSecondary,
                opacity: !importing && (csvText.trim() || jsonText.trim()) ? 1 : 0.5,
                cursor:
                  !importing && (csvText.trim() || jsonText.trim()) ? 'pointer' : 'not-allowed',
              }}
            >
              {importing ? t.performance.importing : t.performance.import}
            </button>

            {/* Import result feedback */}
            {importResult && (
              <span style={{ fontSize: 12, color: V.green, fontWeight: 700 }}>
                {importResult.imported} {t.performance.importedCount}, {importResult.updated} {t.performance.updatedCount}
                {importResult.errors > 0 && (
                  <span style={{ color: V.red }}>, {importResult.errors} {t.sitemapAudit.errors}</span>
                )}
              </span>
            )}
            {importError && (
              <span style={{ fontSize: 12, color: V.red, fontWeight: 700 }}>{importError}</span>
            )}
          </div>
        </div>
      )}

      {/* No data empty state */}
      {!hasData && !showImport && (
        <div
          style={{
            padding: 50,
            textAlign: 'center',
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            backgroundColor: V.bgCard,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>{'\uD83D\uDCCA'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: V.text, marginBottom: 6 }}>
            {t.performance.noData}
          </div>
          <p style={{ fontSize: 12, color: V.textSecondary, maxWidth: 500, margin: '0 auto 16px' }}>
            {t.performance.noDataDesc}
          </p>
          <button
            onClick={() => setShowImport(true)}
            style={{ ...btnBase, backgroundColor: V.cyan, color: '#000' }}
          >
            {t.performance.importData}
          </button>
        </div>
      )}

      {/* Summary cards */}
      {hasData && summary && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <SummaryCard
            label={t.performance.totalClicks}
            value={summary.totalClicks.toLocaleString(locale)}
            color={V.blue}
          />
          <SummaryCard
            label={t.performance.totalImpressions}
            value={summary.totalImpressions.toLocaleString(locale)}
            color={V.cyan}
          />
          <SummaryCard
            label={t.performance.averageCtr}
            value={summary.avgCtr}
            color={summary.avgCtr >= 5 ? V.green : summary.avgCtr >= 2 ? V.yellow : V.red}
            suffix="%"
          />
          <SummaryCard
            label={t.performance.averagePosition}
            value={summary.avgPosition}
            color={summary.avgPosition <= 10 ? V.green : summary.avgPosition <= 30 ? V.yellow : V.red}
          />
        </div>
      )}

      {/* Top pages table */}
      {hasData && sortedPages.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              margin: '0 0 10px',
              color: V.text,
            }}
          >
            {t.performance.topPages} ({sortedPages.length})
          </h2>
          <div
            style={{
              border: `1px solid ${V.border}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: V.bgCard }}>
                  <th style={{ ...thStyle, cursor: 'default', textAlign: 'left' }}>URL</th>
                  <SortTh
                    label={t.performance.clicks}
                    field="clicks"
                    currentSort={pageSortField}
                    currentDir={pageSortDir}
                    onSort={handlePageSort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.impressions}
                    field="impressions"
                    currentSort={pageSortField}
                    currentDir={pageSortDir}
                    onSort={handlePageSort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.ctrPercent}
                    field="ctr"
                    currentSort={pageSortField}
                    currentDir={pageSortDir}
                    onSort={handlePageSort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.position}
                    field="position"
                    currentSort={pageSortField}
                    currentDir={pageSortDir}
                    onSort={handlePageSort}
                    style={{ textAlign: 'right' }}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedPages.map((page, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 600,
                        color: V.text,
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={page.url}
                    >
                      {page.url}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                      {page.clicks.toLocaleString(locale)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {page.impressions.toLocaleString(locale)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color: page.ctr >= 5 ? V.green : page.ctr >= 2 ? V.yellow : V.red,
                        fontWeight: 700,
                      }}
                    >
                      {page.ctr}%
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color:
                          page.position <= 10
                            ? V.green
                            : page.position <= 30
                              ? V.yellow
                              : V.red,
                        fontWeight: 700,
                      }}
                    >
                      {page.position}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top queries table */}
      {hasData && sortedQueries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              margin: '0 0 10px',
              color: V.text,
            }}
          >
            {t.performance.topQueries} ({sortedQueries.length})
          </h2>
          <div
            style={{
              border: `1px solid ${V.border}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: V.bgCard }}>
                  <th style={{ ...thStyle, cursor: 'default', textAlign: 'left' }}>
                    {t.performance.query}
                  </th>
                  <SortTh
                    label={t.performance.clicks}
                    field="clicks"
                    currentSort={querySortField}
                    currentDir={querySortDir}
                    onSort={handleQuerySort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.impressions}
                    field="impressions"
                    currentSort={querySortField}
                    currentDir={querySortDir}
                    onSort={handleQuerySort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.ctrPercent}
                    field="ctr"
                    currentSort={querySortField}
                    currentDir={querySortDir}
                    onSort={handleQuerySort}
                    style={{ textAlign: 'right' }}
                  />
                  <SortTh
                    label={t.performance.position}
                    field="position"
                    currentSort={querySortField}
                    currentDir={querySortDir}
                    onSort={handleQuerySort}
                    style={{ textAlign: 'right' }}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedQueries.map((q, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 600,
                        color: V.text,
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={q.query}
                    >
                      {q.query}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                      {q.clicks.toLocaleString(locale)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {q.impressions.toLocaleString(locale)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color: q.ctr >= 5 ? V.green : q.ctr >= 2 ? V.yellow : V.red,
                        fontWeight: 700,
                      }}
                    >
                      {q.ctr}%
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color:
                          q.position <= 10
                            ? V.green
                            : q.position <= 30
                              ? V.yellow
                              : V.red,
                        fontWeight: 700,
                      }}
                    >
                      {q.position}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
