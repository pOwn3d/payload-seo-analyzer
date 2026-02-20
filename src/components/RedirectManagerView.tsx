'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'

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
interface Redirect {
  id: string
  from: string
  to: string
  type: string
  createdAt: string
  updatedAt: string
}

interface PaginatedResponse {
  docs: Redirect[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
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
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontSize: 12,
  color: V.text,
  backgroundColor: V.bg,
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${V.border}`,
  fontSize: 12,
  color: V.text,
  backgroundColor: V.bg,
}

const TABLE_COLS = '36px 1fr 1fr 70px 100px 80px'

// ---------------------------------------------------------------------------
// Toast sub-component
// ---------------------------------------------------------------------------
function Toast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const bgColor = type === 'success' ? V.green : type === 'error' ? V.red : V.blue

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        borderRadius: 8,
        backgroundColor: bgColor,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: 360,
      }}
    >
      {message}
    </div>
  )
}

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
// Main RedirectManagerView component
// ---------------------------------------------------------------------------
export function RedirectManagerView() {
  const [redirects, setRedirects] = useState<Redirect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const PAGE_SIZE = 50

  // Search
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  // Add form
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newType, setNewType] = useState('301')
  const [adding, setAdding] = useState(false)

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')
  const [editType, setEditType] = useState('301')
  const [saving, setSaving] = useState(false)

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Test URL
  const [testUrl, setTestUrl] = useState('')
  const [testResult, setTestResult] = useState<{
    matched: boolean
    redirect?: Redirect
  } | null>(null)

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Fetch redirects
  const fetchRedirects = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        })
        if (searchDebounced) params.set('search', searchDebounced)

        const res = await fetch(`/api/seo-plugin/redirects?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: PaginatedResponse = await res.json()
        setRedirects(data.docs || [])
        setTotalPages(data.totalPages || 1)
        setTotalDocs(data.totalDocs || 0)
        setCurrentPage(data.page || 1)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      }
      setLoading(false)
    },
    [searchDebounced],
  )

  useEffect(() => {
    fetchRedirects(currentPage)
  }, [fetchRedirects, currentPage])

  // Stats
  const stats = useMemo(() => {
    const count301 = redirects.filter((r) => r.type === '301').length
    const count302 = redirects.filter((r) => r.type === '302').length
    return { total: totalDocs, count301, count302 }
  }, [redirects, totalDocs])

  // Add redirect
  const handleAdd = useCallback(async () => {
    if (!newFrom.trim() || !newTo.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/seo-plugin/create-redirect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: newFrom.trim(),
          to: newTo.trim(),
          type: newType,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setNewFrom('')
        setNewTo('')
        setNewType('301')
        setToast({ message: 'Redirection creee', type: 'success' })
        fetchRedirects(currentPage)
      } else {
        throw new Error(data.error || 'Erreur')
      }
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    }
    setAdding(false)
  }, [newFrom, newTo, newType, currentPage, fetchRedirects])

  // Delete single
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/seo-plugin/redirects', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setToast({ message: 'Redirection supprimee', type: 'success' })
        fetchRedirects(currentPage)
      } catch (e: unknown) {
        setToast({ message: e instanceof Error ? e.message : 'Erreur', type: 'error' })
      }
    },
    [currentPage, fetchRedirects],
  )

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/seo-plugin/redirects', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSelectedIds(new Set())
      setToast({
        message: `${data.deletedCount || ids.length} redirection(s) supprimee(s)`,
        type: 'success',
      })
      fetchRedirects(currentPage)
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    }
  }, [selectedIds, currentPage, fetchRedirects])

  // Inline edit — start
  const startEdit = useCallback((r: Redirect) => {
    setEditId(r.id)
    setEditFrom(r.from)
    setEditTo(r.to)
    setEditType(r.type)
  }, [])

  // Inline edit — save
  const handleEditSave = useCallback(async () => {
    if (!editId || !editFrom.trim() || !editTo.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/seo-plugin/redirects', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          from: editFrom.trim(),
          to: editTo.trim(),
          type: editType,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEditId(null)
      setToast({ message: 'Redirection modifiee', type: 'success' })
      fetchRedirects(currentPage)
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    }
    setSaving(false)
  }, [editId, editFrom, editTo, editType, currentPage, fetchRedirects])

  // CSV import
  const handleCsvImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())

      // Detect if first line is a header
      const firstLine = lines[0]?.toLowerCase() || ''
      const startIdx = firstLine.includes('from') && firstLine.includes('to') ? 1 : 0

      const parsed: Array<{ from: string; to: string; type: string }> = []
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Handle CSV with or without quotes
        const parts = line.match(/(?:"([^"]*(?:""[^"]*)*)"|([^,]+))/g)
        if (!parts || parts.length < 2) continue

        const cleanPart = (p: string) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        const from = cleanPart(parts[0])
        const to = cleanPart(parts[1])
        const type = parts[2] ? cleanPart(parts[2]) : '301'

        if (from && to) {
          parsed.push({ from, to, type: type === '302' ? '302' : '301' })
        }
      }

      if (parsed.length === 0) {
        setToast({ message: 'Aucune redirection valide trouvee dans le CSV', type: 'error' })
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      try {
        const res = await fetch('/api/seo-plugin/redirects', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirects: parsed }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setToast({
          message: `Import: ${data.created} creee(s), ${data.skipped || 0} doublon(s), ${data.errors || 0} erreur(s)`,
          type: data.created > 0 ? 'success' : 'info',
        })
        fetchRedirects(1)
        setCurrentPage(1)
      } catch (err: unknown) {
        setToast({ message: err instanceof Error ? err.message : 'Erreur import', type: 'error' })
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [fetchRedirects],
  )

  // CSV export
  const handleExportCsv = useCallback(async () => {
    try {
      // Fetch all redirects (no pagination limit)
      const res = await fetch('/api/seo-plugin/redirects?limit=10000', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PaginatedResponse = await res.json()
      const allRedirects = data.docs || []

      const headers = ['from', 'to', 'type', 'createdAt']
      const rows = allRedirects.map((r) => [
        r.from,
        r.to,
        r.type,
        r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redirects-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)

      setToast({ message: `${allRedirects.length} redirection(s) exportee(s)`, type: 'success' })
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Erreur export', type: 'error' })
    }
  }, [])

  // Test URL
  const handleTestUrl = useCallback(() => {
    const urlToTest = testUrl.trim()
    if (!urlToTest) {
      setTestResult(null)
      return
    }

    const normalized = urlToTest.startsWith('/') ? urlToTest : `/${urlToTest}`
    const match = redirects.find((r) => r.from === normalized)

    setTestResult(match ? { matched: true, redirect: match } : { matched: false })
  }, [testUrl, redirects])

  // Select all on current page
  const allPageSelected = useMemo(() => {
    if (redirects.length === 0) return false
    return redirects.every((r) => selectedIds.has(r.id))
  }, [redirects, selectedIds])

  const handleSelectAll = useCallback(() => {
    const pageIds = redirects.map((r) => r.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [redirects, allPageSelected])

  // Loading state
  if (loading && redirects.length === 0) {
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
        Chargement des redirections...
      </div>
    )
  }

  // Error state
  if (error && redirects.length === 0) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        <div style={{ color: V.red, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Erreur de chargement
        </div>
        <div style={{ color: V.textSecondary, fontSize: 12, marginBottom: 16 }}>{error}</div>
        <button
          onClick={() => fetchRedirects(1)}
          style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
        >
          Reessayer
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
            Gestionnaire de redirections
          </h1>
          <p style={{ fontSize: 12, color: V.textSecondary, margin: '4px 0 0' }}>
            {totalDocs} redirection{totalDocs > 1 ? 's' : ''} au total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchRedirects(currentPage)}
            style={{ ...btnBase, backgroundColor: V.bgCard, color: V.text }}
          >
            &#8635; Rafraichir
          </button>
          <button
            onClick={handleExportCsv}
            style={{ ...btnBase, backgroundColor: V.cyan, color: '#000' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ ...btnBase, backgroundColor: V.blue, color: '#fff' }}
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total" value={stats.total} color={V.blue} />
        <StatCard label="301 (permanentes)" value={stats.count301} color={V.green} />
        <StatCard label="302 (temporaires)" value={stats.count302} color={V.orange} />
      </div>

      {/* Add form */}
      <div
        style={{
          border: `1px solid ${V.border}`,
          borderRadius: 10,
          backgroundColor: V.bgCard,
          padding: '14px 18px',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: V.text,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Ajouter une redirection
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                color: V.textSecondary,
                marginBottom: 3,
                textTransform: 'uppercase',
              }}
            >
              URL source
            </label>
            <input
              type="text"
              value={newFrom}
              onChange={(e) => setNewFrom(e.target.value)}
              placeholder="/ancienne-page"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                color: V.textSecondary,
                marginBottom: 3,
                textTransform: 'uppercase',
              }}
            >
              URL destination
            </label>
            <input
              type="text"
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              placeholder="/nouvelle-page"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div style={{ minWidth: 80 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                color: V.textSecondary,
                marginBottom: 3,
                textTransform: 'uppercase',
              }}
            >
              Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={selectStyle}
            >
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newFrom.trim() || !newTo.trim()}
            style={{
              ...btnBase,
              backgroundColor: adding ? V.bgCard : V.green,
              color: adding ? V.textSecondary : '#fff',
              border: 'none',
              opacity: adding || !newFrom.trim() || !newTo.trim() ? 0.6 : 1,
              cursor: adding || !newFrom.trim() || !newTo.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {adding ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* Search + Test URL */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher (URL source ou destination)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...inputStyle,
            minWidth: 280,
            flex: 1,
          }}
        />

        {/* Test URL */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="/url-a-tester"
            value={testUrl}
            onChange={(e) => {
              setTestUrl(e.target.value)
              setTestResult(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTestUrl()
            }}
            style={{ ...inputStyle, minWidth: 180 }}
          />
          <button
            onClick={handleTestUrl}
            disabled={!testUrl.trim()}
            style={{
              ...btnBase,
              backgroundColor: V.bgCard,
              color: V.text,
              opacity: !testUrl.trim() ? 0.5 : 1,
            }}
          >
            Tester
          </button>
          {testResult && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: testResult.matched ? V.green : V.red,
                padding: '4px 10px',
                borderRadius: 6,
                backgroundColor: testResult.matched
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              {testResult.matched
                ? `${testResult.redirect?.type} → ${testResult.redirect?.to}`
                : 'Aucune correspondance'}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          border: `1px solid ${V.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
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
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={handleSelectAll}
              style={{ cursor: 'pointer' }}
            />
          </div>
          <span>Source (from)</span>
          <span>Destination (to)</span>
          <span style={{ textAlign: 'center' }}>Type</span>
          <span style={{ textAlign: 'right' }}>Date</span>
          <span style={{ textAlign: 'center' }}>Actions</span>
        </div>

        {/* Table body */}
        <div style={{ maxHeight: 'calc(100vh - 520px)', overflowY: 'auto' }}>
          {redirects.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: V.textSecondary,
                fontSize: 12,
              }}
            >
              {search
                ? 'Aucune redirection correspondante.'
                : 'Aucune redirection. Ajoutez-en une ci-dessus.'}
            </div>
          ) : (
            redirects.map((r) => {
              const isEditing = editId === r.id
              const isSelected = selectedIds.has(r.id)

              if (isEditing) {
                // Inline edit row
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: TABLE_COLS,
                      padding: '8px 14px',
                      borderBottom: `1px solid ${V.border}`,
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      backgroundColor: 'rgba(59,130,246,0.04)',
                    }}
                  >
                    <div />
                    <input
                      type="text"
                      value={editFrom}
                      onChange={(e) => setEditFrom(e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                    <input
                      type="text"
                      value={editTo}
                      onChange={(e) => setEditTo(e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="301">301</option>
                      <option value="302">302</option>
                    </select>
                    <div />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={handleEditSave}
                        disabled={saving}
                        style={{
                          ...btnBase,
                          padding: '4px 8px',
                          fontSize: 10,
                          backgroundColor: saving ? V.bgCard : V.green,
                          color: saving ? V.textSecondary : '#fff',
                          border: 'none',
                        }}
                      >
                        {saving ? '...' : 'OK'}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        style={{
                          ...btnBase,
                          padding: '4px 8px',
                          fontSize: 10,
                          backgroundColor: V.bgCard,
                          color: V.text,
                        }}
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>
                )
              }

              // Normal row
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: TABLE_COLS,
                    padding: '8px 14px',
                    borderBottom: `1px solid ${V.border}`,
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    backgroundColor: isSelected ? 'rgba(59,130,246,0.04)' : 'transparent',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>

                  {/* From */}
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: V.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={r.from}
                  >
                    {r.from}
                  </div>

                  {/* To */}
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: V.blue,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={r.to}
                  >
                    {r.to}
                  </div>

                  {/* Type badge */}
                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 800,
                        color: r.type === '301' ? V.green : V.orange,
                        backgroundColor:
                          r.type === '301'
                            ? 'rgba(34,197,94,0.12)'
                            : 'rgba(249,115,22,0.12)',
                      }}
                    >
                      {r.type}
                    </span>
                  </div>

                  {/* Date */}
                  <div
                    style={{
                      fontSize: 10,
                      color: V.textSecondary,
                      textAlign: 'right',
                    }}
                  >
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString('fr-FR')
                      : '-'}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      title="Modifier"
                      onClick={() => startEdit(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') startEdit(r)
                      }}
                      style={{
                        cursor: 'pointer',
                        fontSize: 14,
                        color: V.textSecondary,
                        userSelect: 'none',
                      }}
                    >
                      &#9998;
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Supprimer"
                      onClick={() => handleDelete(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDelete(r.id)
                      }}
                      style={{
                        cursor: 'pointer',
                        fontSize: 14,
                        color: V.red,
                        userSelect: 'none',
                      }}
                    >
                      &#10005;
                    </span>
                  </div>
                </div>
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
            &lsaquo; Precedent
          </button>
          <span
            style={{
              color: V.textSecondary,
              fontWeight: 600,
              padding: '0 8px',
            }}
          >
            Page {currentPage} / {totalPages}
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
            Suivant &rsaquo;
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
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
              {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ ...btnBase, backgroundColor: V.bg, color: V.textSecondary }}
            >
              Tout deselectionner
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            style={{
              ...btnBase,
              backgroundColor: V.red,
              color: '#fff',
              border: 'none',
            }}
          >
            Supprimer ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
