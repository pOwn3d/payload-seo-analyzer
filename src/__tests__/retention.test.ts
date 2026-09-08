import { describe, it, expect, vi } from 'vitest'
import {
  RETENTION_TARGETS,
  resolveRetention,
  describeRetention,
  purgeRetention,
} from '../retention.js'

const NOW = new Date('2026-09-08T12:00:00.000Z')

function fakePayload(overrides: Record<string, unknown> = {}) {
  const calls: Array<Record<string, unknown>> = []
  const payload = {
    collections: {
      'seo-rank-history': {},
      'seo-score-history': {},
      'seo-performance': {},
      'seo-logs': {},
    },
    delete: vi.fn(async (args: Record<string, unknown>) => {
      calls.push(args)
      return { docs: [{ id: 1 }, { id: 2 }], errors: [] }
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, calls }
}

describe('retention — target definitions', () => {
  it('never compares against createdAt on a timestamps:false collection', () => {
    // seo-rank-history, seo-score-history and seo-performance all declare
    // `timestamps: false`, so `createdAt` does not exist as a column: a purge
    // keyed on it would silently delete nothing (or throw).
    const byField = Object.fromEntries(RETENTION_TARGETS.map((t) => [t.slug, t.dateField]))
    expect(byField['seo-rank-history']).toBe('snapshotDate')
    expect(byField['seo-score-history']).toBe('snapshotDate')
    expect(byField['seo-performance']).toBe('date')
    // seo-logs does have timestamps, but `lastSeen` is the right field: a 404
    // first recorded a year ago and still being hit today is live data.
    expect(byField['seo-logs']).toBe('lastSeen')
  })
})

describe('retention — resolveRetention', () => {
  it('is opt-in: no config means no purge', () => {
    expect(resolveRetention(undefined)).toEqual([])
    expect(resolveRetention({})).toEqual([])
  })

  it('drops values that would mean "delete everything" instead of clamping them', () => {
    // The whole point: clamping 0 to 1 would still wipe almost the entire table.
    const resolved = resolveRetention({
      'seo-logs': 0,
      'seo-performance': -30,
      'seo-rank-history': Number.NaN,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'seo-score-history': '90' as any,
    })
    expect(resolved).toEqual([])
  })

  it('accepts a positive window and floors it', () => {
    const resolved = resolveRetention({ 'seo-logs': 90.9 })
    expect(resolved).toEqual([{ slug: 'seo-logs', dateField: 'lastSeen', days: 90 }])
  })

  it('ignores an unknown collection slug', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveRetention({ pages: 30 } as any)).toEqual([])
  })

  it('keeps the declared order, whatever the object order is', () => {
    const resolved = resolveRetention({ 'seo-logs': 30, 'seo-rank-history': 365 })
    expect(resolved.map((r) => r.slug)).toEqual(['seo-rank-history', 'seo-logs'])
  })
})

describe('retention — describeRetention (dry run)', () => {
  it('reports the cutoff without deleting anything', () => {
    const described = describeRetention({ 'seo-logs': 90 }, NOW)
    expect(described).toEqual([
      {
        collection: 'seo-logs',
        dateField: 'lastSeen',
        days: 90,
        cutoff: new Date('2026-06-10T12:00:00.000Z').toISOString(),
      },
    ])
  })
})

describe('retention — purgeRetention', () => {
  it('does nothing at all when no window is configured', async () => {
    const { payload } = fakePayload()
    const result = await purgeRetention(payload, undefined, { now: NOW })
    expect(result).toEqual({ ran: false, results: [], totalDeleted: 0 })
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('deletes strictly older than the cutoff, on the collection s own date field', async () => {
    const { payload, calls } = fakePayload()
    const result = await purgeRetention(payload, { 'seo-logs': 90 }, { now: NOW })

    expect(calls).toHaveLength(1)
    expect(calls[0].collection).toBe('seo-logs')
    expect(calls[0].where).toEqual({
      lastSeen: { less_than: new Date('2026-06-10T12:00:00.000Z').toISOString() },
    })
    // A maintenance job must not be filtered by whoever triggered it.
    expect(calls[0].overrideAccess).toBe(true)
    expect(result.totalDeleted).toBe(2)
  })

  it('runs the collections one after another, never in parallel', async () => {
    // The plugin's reference host is SQLite, where concurrent writes raise
    // SQLITE_BUSY (documented pitfall of this codebase).
    let inFlight = 0
    let maxInFlight = 0
    const { payload } = fakePayload({
      delete: vi.fn(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return { docs: [], errors: [] }
      }),
    })

    await purgeRetention(
      payload,
      { 'seo-logs': 30, 'seo-rank-history': 365, 'seo-performance': 180 },
      { now: NOW },
    )
    expect(maxInFlight).toBe(1)
  })

  it('skips a collection the host never registered, without failing', async () => {
    // A feature flag can keep seo-rank-history out of the config entirely.
    const { payload } = fakePayload({
      collections: { 'seo-logs': {} },
    })
    const result = await purgeRetention(payload, { 'seo-rank-history': 365, 'seo-logs': 30 }, {
      now: NOW,
    })
    const rank = result.results.find((r) => r.collection === 'seo-rank-history')!
    expect(rank.skipped).toBe('not_registered')
    expect(rank.deleted).toBe(0)
    expect(payload.delete).toHaveBeenCalledTimes(1)
  })

  it('reports a failing collection and still purges the others', async () => {
    let call = 0
    const { payload } = fakePayload({
      delete: vi.fn(async () => {
        call++
        if (call === 1) throw new Error('SQLITE_BUSY: database is locked')
        return { docs: [{ id: 1 }], errors: [] }
      }),
    })

    const result = await purgeRetention(payload, { 'seo-rank-history': 365, 'seo-logs': 30 }, {
      now: NOW,
    })
    expect(result.results[0].error).toContain('SQLITE_BUSY')
    expect(result.results[1].deleted).toBe(1)
    expect(result.totalDeleted).toBe(1)
  })

  it('computes one cutoff per collection, from that collection s own window', async () => {
    const { payload, calls } = fakePayload()
    await purgeRetention(payload, { 'seo-rank-history': 365, 'seo-logs': 30 }, { now: NOW })
    expect(calls[0].where).toEqual({
      snapshotDate: { less_than: new Date('2025-09-08T12:00:00.000Z').toISOString() },
    })
    expect(calls[1].where).toEqual({
      lastSeen: { less_than: new Date('2026-08-09T12:00:00.000Z').toISOString() },
    })
  })
})
