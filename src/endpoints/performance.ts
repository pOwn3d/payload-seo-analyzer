/**
 * Performance data endpoint.
 * GET — Fetch performance data with aggregation by period.
 * POST — Import performance data from CSV string or JSON entries array.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'
import { parseJsonBody } from '../helpers/parseBody.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceEntry {
  url: string
  query?: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  date: string
}

interface AggregatedRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  count: number
}

// ---------------------------------------------------------------------------
// CSV parser (simple, handles quoted fields)
// ---------------------------------------------------------------------------

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length === 0) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]?.trim() ?? ''
    }
    rows.push(row)
  }

  return rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',' || ch === ';' || ch === '\t') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

// ---------------------------------------------------------------------------
// Period filter helper
// ---------------------------------------------------------------------------

function getDateThreshold(period: string): Date {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '30d':
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Check if the user has admin role */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  return false
}

export function createPerformanceHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const method = req.method?.toUpperCase()

      // =======================================================================
      // GET — Fetch and aggregate performance data
      // =======================================================================
      if (method === 'GET') {
        const url = new URL(req.url as string)
        const period = url.searchParams.get('period') || '30d'
        const filterUrl = url.searchParams.get('url') || ''
        const filterQuery = url.searchParams.get('query') || ''
        const threshold = getDateThreshold(period)

        // Fetch all performance entries within the period
        const result = await req.payload.find({
          collection: 'seo-performance',
          limit: 10000,
          depth: 0,
          overrideAccess: true,
          where: {
            date: { greater_than_equal: threshold.toISOString() },
            ...(filterUrl ? { url: { contains: filterUrl } } : {}),
            ...(filterQuery ? { query: { contains: filterQuery } } : {}),
          },
          sort: '-date',
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const docs = result.docs as any[]

        // Summary
        let totalClicks = 0
        let totalImpressions = 0
        let positionSum = 0
        let positionCount = 0

        for (const doc of docs) {
          totalClicks += doc.clicks || 0
          totalImpressions += doc.impressions || 0
          if (doc.position > 0) {
            positionSum += doc.position
            positionCount++
          }
        }

        const avgCtr = totalImpressions > 0
          ? Math.round((totalClicks / totalImpressions) * 10000) / 100
          : 0
        const avgPosition = positionCount > 0
          ? Math.round((positionSum / positionCount) * 10) / 10
          : 0

        // Aggregate by URL (top pages)
        const pageMap = new Map<string, AggregatedRow>()
        for (const doc of docs) {
          const key = doc.url || ''
          if (!pageMap.has(key)) {
            pageMap.set(key, { key, clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 })
          }
          const entry = pageMap.get(key)!
          entry.clicks += doc.clicks || 0
          entry.impressions += doc.impressions || 0
          if (doc.position > 0) {
            entry.position += doc.position
            entry.count++
          }
        }

        const topPages = Array.from(pageMap.values())
          .map((e) => ({
            url: e.key,
            clicks: e.clicks,
            impressions: e.impressions,
            ctr: e.impressions > 0
              ? Math.round((e.clicks / e.impressions) * 10000) / 100
              : 0,
            position: e.count > 0
              ? Math.round((e.position / e.count) * 10) / 10
              : 0,
          }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20)

        // Aggregate by query (top queries)
        const queryMap = new Map<string, AggregatedRow>()
        for (const doc of docs) {
          const key = doc.query || '(sans requête)'
          if (!queryMap.has(key)) {
            queryMap.set(key, { key, clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 })
          }
          const entry = queryMap.get(key)!
          entry.clicks += doc.clicks || 0
          entry.impressions += doc.impressions || 0
          if (doc.position > 0) {
            entry.position += doc.position
            entry.count++
          }
        }

        const topQueries = Array.from(queryMap.values())
          .map((e) => ({
            query: e.key,
            clicks: e.clicks,
            impressions: e.impressions,
            ctr: e.impressions > 0
              ? Math.round((e.clicks / e.impressions) * 10000) / 100
              : 0,
            position: e.count > 0
              ? Math.round((e.position / e.count) * 10) / 10
              : 0,
          }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20)

        // Raw data for charts (limit 200)
        const data = docs.slice(0, 200).map((doc) => ({
          url: doc.url || '',
          query: doc.query || '',
          clicks: doc.clicks || 0,
          impressions: doc.impressions || 0,
          ctr: doc.ctr || 0,
          position: doc.position || 0,
          date: doc.date || '',
        }))

        return Response.json({
          data,
          summary: { totalClicks, totalImpressions, avgCtr, avgPosition },
          topPages,
          topQueries,
        })
      }

      // =======================================================================
      // POST — Import performance data (admin only)
      // =======================================================================
      if (method === 'POST') {
        if (!isAdmin(req.user)) {
          return Response.json({ error: 'Admin access required' }, { status: 403 })
        }
        const body = await parseJsonBody(req)

        let entries: PerformanceEntry[] = []

        // Parse CSV if provided
        if (typeof body.csv === 'string' && body.csv.trim()) {
          const rows = parseCSV(body.csv as string)

          // Default date when GSC export doesn't include a date column (Pages/Queries reports)
          const todayISO = new Date().toISOString().split('T')[0]

          for (const row of rows) {
            // Support multiple header variants (FR and EN GSC exports)
            const urlVal = row.url || row.page || row.pages || row['pages les plus populaires'] || ''
            const queryVal = row.query || row.queries || row['top queries'] || row.requete || row['requête'] || row['requêtes les plus fréquentes'] || row['requêtes principales'] || ''
            const dateVal = row.date || ''

            // GSC exports different report types:
            // - Pages report: has url but no date → default to today
            // - Queries report: has query but no url/date → use query as key, default date
            // - Dates report: has date but no url → skip (no page-level data)
            // Need at least a url OR a query to create an entry
            if (!urlVal && !queryVal) continue

            entries.push({
              url: urlVal || '/',
              query: queryVal || undefined,
              clicks: parseFloat(row.clicks || row.clics || '0') || 0,
              impressions: parseFloat(row.impressions || '0') || 0,
              ctr: parseFloat((row.ctr || '0').replace('%', '').replace(',', '.')) || 0,
              position: parseFloat((row.position || '0').replace(',', '.')) || 0,
              date: dateVal || todayISO,
            })
          }
        }

        // Parse JSON entries if provided
        if (Array.isArray(body.entries)) {
          for (const entry of body.entries) {
            if (!entry || typeof entry !== 'object') continue
            const e = entry as Record<string, unknown>
            if (!e.url || !e.date) continue
            entries.push({
              url: String(e.url),
              query: e.query ? String(e.query) : undefined,
              clicks: Number(e.clicks) || 0,
              impressions: Number(e.impressions) || 0,
              ctr: Number(e.ctr) || 0,
              position: Number(e.position) || 0,
              date: String(e.date),
            })
          }
        }

        if (entries.length === 0) {
          return Response.json(
            {
              error: 'Aucune entrée valide trouvée. Le CSV doit contenir au moins une colonne "Page" (ou "URL") ou "Top queries". Formats acceptés : export Google Search Console (Pages, Requêtes, ou Dates).',
            },
            { status: 400 },
          )
        }

        // Limit entries to prevent excessive processing
        const MAX_ENTRIES = 5000
        let truncatedWarning: string | undefined
        if (entries.length > MAX_ENTRIES) {
          truncatedWarning = `Truncated from ${entries.length} to ${MAX_ENTRIES} entries (max limit)`
          entries = entries.slice(0, MAX_ENTRIES)
        }

        let imported = 0
        let updated = 0
        let errors = 0

        // Pre-process: normalize dates and filter invalid entries
        interface NormalizedEntry extends PerformanceEntry {
          dateISO: string
          key: string // url+query+date composite key
        }
        const normalizedEntries: NormalizedEntry[] = []
        for (const entry of entries) {
          try {
            const d = new Date(entry.date)
            if (isNaN(d.getTime())) { errors++; continue }
            const dateISO = d.toISOString().split('T')[0] + 'T00:00:00.000Z'
            const key = `${entry.url}::${entry.query || ''}::${dateISO}`
            normalizedEntries.push({ ...entry, dateISO, key })
          } catch {
            errors++
          }
        }

        // Process in batches of 50
        const BATCH_SIZE = 50
        for (let i = 0; i < normalizedEntries.length; i += BATCH_SIZE) {
          const batch = normalizedEntries.slice(i, i + BATCH_SIZE)
          const batchUrls = [...new Set(batch.map((e) => e.url))]

          // Single query to find all existing entries for this batch's URLs
          let existingDocs: Array<Record<string, unknown>> = []
          try {
            const result = await req.payload.find({
              collection: 'seo-performance',
              limit: batch.length * 2,
              depth: 0,
              overrideAccess: true,
              where: { url: { in: batchUrls } },
            })
            existingDocs = result.docs as Array<Record<string, unknown>>
          } catch {
            // If bulk find fails, count all as errors
            errors += batch.length
            continue
          }

          // Build a lookup map: "url::query::date" -> existing doc
          const existingMap = new Map<string, Record<string, unknown>>()
          for (const doc of existingDocs) {
            const docUrl = (doc.url as string) || ''
            const docQuery = (doc.query as string) || ''
            const docDate = (doc.date as string) || ''
            const key = `${docUrl}::${docQuery}::${docDate}`
            existingMap.set(key, doc)
          }

          // Separate into creates and updates
          const toCreate: NormalizedEntry[] = []
          const toUpdate: Array<{ id: string | number; entry: NormalizedEntry }> = []
          for (const entry of batch) {
            const existing = existingMap.get(entry.key)
            if (existing) {
              toUpdate.push({ id: existing.id as string | number, entry })
            } else {
              toCreate.push(entry)
            }
          }

          // Process updates in parallel (batched)
          const updatePromises = toUpdate.map(async ({ id, entry }) => {
            try {
              await req.payload.update({
                collection: 'seo-performance',
                id,
                data: {
                  clicks: entry.clicks,
                  impressions: entry.impressions,
                  ctr: entry.ctr,
                  position: entry.position,
                  source: 'csv',
                },
                overrideAccess: true,
              })
              return 'updated' as const
            } catch {
              return 'error' as const
            }
          })

          // Process creates in parallel (batched)
          const createPromises = toCreate.map(async (entry) => {
            try {
              await req.payload.create({
                collection: 'seo-performance',
                data: {
                  url: entry.url,
                  query: entry.query || '',
                  clicks: entry.clicks,
                  impressions: entry.impressions,
                  ctr: entry.ctr,
                  position: entry.position,
                  date: entry.dateISO,
                  source: 'csv',
                },
                overrideAccess: true,
              })
              return 'created' as const
            } catch {
              return 'error' as const
            }
          })

          const results = await Promise.all([...updatePromises, ...createPromises])
          for (const r of results) {
            if (r === 'updated') updated++
            else if (r === 'created') imported++
            else errors++
          }
        }

        return Response.json({
          imported,
          updated,
          errors,
          ...(truncatedWarning && { warning: truncatedWarning }),
        })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] performance error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
