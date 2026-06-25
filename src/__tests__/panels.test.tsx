// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RankTrackingPanel } from '../components/RankTrackingPanel.js'
import { CtrOpportunitiesPanel } from '../components/CtrOpportunitiesPanel.js'
import { AlertsPanel } from '../components/AlertsPanel.js'
import { HealthPanel } from '../components/HealthPanel.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockFetch(status: number, body: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('UI panels — render smoke (jsdom)', () => {
  it('RankTrackingPanel: 404 (feature off) → graceful "connect GSC", not "Error 404"', async () => {
    mockFetch(404, { error: 'Not Found' })
    render(<RankTrackingPanel locale="fr" />)
    expect(await screen.findByText(/Connectez Google Search Console/i)).toBeTruthy()
    expect(screen.queryByText(/Error 404/i)).toBeNull()
  })

  it('RankTrackingPanel: data → shows the query row', async () => {
    mockFetch(200, {
      count: 1,
      lastSnapshot: '2026-06-24T08:00:00Z',
      movers: [
        { query: 'plombier brive', page: null, position: 5, previousPosition: 3, delta: -2, clicks: 10, impressions: 100, ctr: 0.1, snapshotDate: '2026-06-24T08:00:00Z' },
      ],
    })
    render(<RankTrackingPanel locale="fr" />)
    expect(await screen.findByText('plombier brive')).toBeTruthy()
  })

  it('CtrOpportunitiesPanel: 404 (feature off) → graceful "connect GSC", not "Error 404"', async () => {
    mockFetch(404, { error: 'Not Found' })
    render(<CtrOpportunitiesPanel locale="fr" />)
    expect(await screen.findByText(/Connectez Google Search Console/i)).toBeTruthy()
    expect(screen.queryByText(/Error 404/i)).toBeNull()
  })

  it('CtrOpportunitiesPanel: data → shows an opportunity row', async () => {
    mockFetch(200, {
      count: 1,
      opportunities: [
        { url: 'https://consilioweb.fr/a-propos', impressions: 1000, clicks: 5, ctr: 0.005, position: 4, expectedCtr: 0.07, potentialClicks: 65, doc: null },
      ],
    })
    render(<CtrOpportunitiesPanel locale="fr" />)
    expect(await screen.findByText(/a-propos/)).toBeTruthy()
    expect(await screen.findByText(/\+65/)).toBeTruthy()
  })

  it('AlertsPanel: 404 (feature off) → shows the "no channel / disabled" hint, not an error', async () => {
    mockFetch(404, { error: 'Not Found' })
    render(<AlertsPanel locale="fr" />)
    expect(await screen.findByText(/Aucun canal configuré/i)).toBeTruthy()
  })

  it('HealthPanel: renders status + warnings from /health', async () => {
    mockFetch(200, {
      ok: false,
      config: { aiKey: true, pageSpeedKey: false, gscConfigured: false, alertWebhook: false, alertEmail: false },
      runtime: { gscConnected: false, lastRankSnapshot: null },
      warnings: ['No alert channel configured'],
    })
    render(<HealthPanel locale="fr" />)
    expect(await screen.findByText(/Santé du module SEO/i)).toBeTruthy()
    expect(await screen.findByText(/No alert channel configured/i)).toBeTruthy()
  })
})
