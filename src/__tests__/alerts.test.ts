import { describe, it, expect } from 'vitest'
import { buildAlertDigest, type AlertConfig } from '../endpoints/alerts.js'

const cfg: AlertConfig = {
  webhookUrl: '',
  emails: [],
  scoreDrop: 10,
  positionDrop: 5,
  windowHours: 24,
}

// Minimal payload mock — returns canned docs per collection (where/sort are ignored;
// docs are provided already newest-first to match the real -snapshotDate sort).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakePayload(data: Record<string, any[]>): any {
  return {
    logger: { warn() {}, error() {}, info() {} },
    async find({ collection }: { collection: string }) {
      return { docs: data[collection] || [] }
    },
  }
}

describe('buildAlertDigest', () => {
  it('flags a score regression at/above the threshold', async () => {
    const payload = fakePayload({
      'seo-score-history': [
        { documentId: '1', collection: 'pages', score: 60, snapshotDate: '2026-06-23' },
        { documentId: '1', collection: 'pages', score: 85, snapshotDate: '2026-06-10' },
      ],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.scoreRegressions).toHaveLength(1)
    expect(d.scoreRegressions[0]).toMatchObject({ from: 85, to: 60, drop: 25 })
  })

  it('ignores a score drop below the threshold', async () => {
    const payload = fakePayload({
      'seo-score-history': [
        { documentId: '1', collection: 'pages', score: 80, snapshotDate: '2026-06-23' },
        { documentId: '1', collection: 'pages', score: 85, snapshotDate: '2026-06-10' },
      ],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.scoreRegressions).toHaveLength(0)
  })

  it('reports new 404s', async () => {
    const payload = fakePayload({
      'seo-logs': [{ url: '/gone', count: 4, lastSeen: '2026-06-23' }],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.newNotFound).toEqual([{ url: '/gone', count: 4, lastSeen: '2026-06-23' }])
  })

  it('flags a ranking drop at/above the threshold', async () => {
    const payload = fakePayload({
      'seo-rank-history': [
        { query: 'plombier paris', position: 12, dateKey: '2026-06-23', snapshotDate: '2026-06-23T08:00:00Z' },
        { query: 'plombier paris', position: 5, dateKey: '2026-06-22', snapshotDate: '2026-06-22T08:00:00Z' },
      ],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.rankDrops).toHaveLength(1)
    expect(d.rankDrops[0]).toMatchObject({ query: 'plombier paris', from: 5, to: 12, drop: 7 })
  })

  it('does not flag an improvement', async () => {
    const payload = fakePayload({
      'seo-rank-history': [
        { query: 'x', position: 3, dateKey: '2026-06-23', snapshotDate: '2026-06-23T08:00:00Z' },
        { query: 'x', position: 9, dateKey: '2026-06-22', snapshotDate: '2026-06-22T08:00:00Z' },
      ],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.rankDrops).toHaveLength(0)
  })

  it('sums totalIssues across all sources', async () => {
    const payload = fakePayload({
      'seo-score-history': [
        { documentId: '1', collection: 'pages', score: 50, snapshotDate: '2026-06-23' },
        { documentId: '1', collection: 'pages', score: 90, snapshotDate: '2026-06-10' },
      ],
      'seo-logs': [{ url: '/a', count: 1, lastSeen: '2026-06-23' }],
    })
    const d = await buildAlertDigest(payload, cfg)
    expect(d.totalIssues).toBe(2)
  })
})
