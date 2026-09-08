import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Access } from 'payload'
import { createSeoSettingsCollection } from '../collections/SeoSettings.js'
import { createSeoRedirectsCollection } from '../collections/SeoRedirects.js'
import { createSeoGscAuthCollection } from '../collections/SeoGscAuth.js'
import { createSeoPerformanceCollection } from '../collections/SeoPerformance.js'
import { createSeoLogsCollection } from '../collections/SeoLogs.js'
import { createSeoScoreHistoryCollection } from '../collections/SeoScoreHistory.js'
import { createSeoRankHistoryCollection } from '../collections/SeoRankHistory.js'
import { createAiAltTextHandler } from '../endpoints/aiAltText.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (fn: Access | undefined, user: any) => Boolean(fn?.({ req: { user } } as any))

const collections = [
  ['seo-settings', createSeoSettingsCollection()],
  ['seo-redirects', createSeoRedirectsCollection()],
  ['seo-gsc-auth', createSeoGscAuthCollection()],
  // Added after the 2026 audit: the June hardening had covered only the three
  // collections above, leaving these two on `create/update/delete: !!req.user`
  // (wipe the imported GSC history / read visitor referrers from any account).
  ['seo-performance', createSeoPerformanceCollection()],
  ['seo-logs', createSeoLogsCollection()],
] as const

/** Every collection the plugin registers, whatever its write policy. */
const allCollections = [
  ...collections,
  ['seo-score-history', createSeoScoreHistoryCollection()],
  ['seo-rank-history', createSeoRankHistoryCollection()],
] as const

/** A request from a user authenticated on ANOTHER auth collection. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callAs = (fn: Access | undefined, user: any, adminCollection = 'users') =>
  Boolean(fn?.({ req: { user, payload: { config: { admin: { user: adminCollection } } } } } as any))

// Regression: create/update/delete used to be `!!req.user`, so an editor could
// bypass the admin-gated endpoints through the REST collection API — writing
// robotsCustomRules, creating a redirect, or clobbering the OAuth CSRF state.
describe.each(collections)('%s access', (_slug, collection) => {
  const editor = { id: 2, role: 'editor' }
  const admin = { id: 1, role: 'admin' }

  it('keeps read open to any authenticated user', () => {
    expect(call(collection.access?.read, editor)).toBe(true)
  })

  it('denies read to anonymous callers', () => {
    expect(call(collection.access?.read, null)).toBe(false)
  })

  it.each(['create', 'update', 'delete'] as const)('denies %s to a non-admin', (op) => {
    expect(call(collection.access?.[op], editor)).toBe(false)
  })

  it.each(['create', 'update', 'delete'] as const)('allows %s for an admin', (op) => {
    expect(call(collection.access?.[op], admin)).toBe(true)
  })

  it.each(['create', 'update', 'delete'] as const)(
    'still allows %s on a role-less setup (documented fail-open)',
    (op) => {
      expect(call(collection.access?.[op], { id: 3 })).toBe(true)
    },
  )
})

// IDOR regression: `body.collection` used to select the collection passed to
// findByID/update with overrideAccess: true.
describe('POST /ai-alt-text collection allowlist', () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  function makeReq(body: Record<string, unknown>, update = vi.fn()) {
    return {
      user: { id: 1, role: 'admin' },
      json: async () => body,
      payload: {
        logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
        update,
        findByID: vi.fn(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('rejects a collection other than the configured uploads collection', async () => {
    const update = vi.fn()
    const res = await createAiAltTextHandler('media')(
      makeReq({ collection: 'users', id: '1', apply: true, altText: 'x' }, update),
    )
    expect(res.status).toBe(403)
    expect(update).not.toHaveBeenCalled()
  })

  it('writes only into the configured uploads collection', async () => {
    const update = vi.fn().mockResolvedValue({})
    const res = await createAiAltTextHandler('media')(
      makeReq({ collection: 'media', id: '7', apply: true, altText: 'Une photo' }, update),
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: '7' }),
    )
  })
})


// Regression (SEO-01/02/04): a session on a second auth collection — a front-office
// customer on an e-commerce site — populates `req.user` on every route. Every access
// rule of the plugin must reject it, on read as well as on write.
describe.each(allCollections)('%s — foreign auth collection', (_slug, collection) => {
  const customer = { id: 3, collection: 'customers' }

  it.each(['read', 'create', 'update', 'delete'] as const)(
    'denies %s to a customer, even role-less',
    (op) => {
      expect(callAs(collection.access?.[op], customer)).toBe(false)
    },
  )

  it('denies write to a customer who carries role: admin on their own collection', () => {
    expect(callAs(collection.access?.create, { ...customer, role: 'admin' })).toBe(false)
  })

  it('still allows the admin-panel user', () => {
    expect(callAs(collection.access?.read, { id: 1, collection: 'users' })).toBe(true)
    expect(callAs(collection.access?.create, { id: 1, collection: 'users', role: 'admin' })).toBe(true)
  })
})

// Regression (SEO-04): seo-score-history feeds the alert digest; forged snapshots
// change the e-mails sent to admins.
describe('seo-score-history / seo-rank-history write policy', () => {
  const scoreHistory = createSeoScoreHistoryCollection()
  const rankHistory = createSeoRankHistoryCollection()
  const editor = { id: 2, role: 'editor' }

  it('denies create to a non-admin on seo-score-history', () => {
    expect(call(scoreHistory.access?.create, editor)).toBe(false)
  })

  it('keeps create working for an admin and on a role-less setup', () => {
    expect(call(scoreHistory.access?.create, { id: 1, role: 'admin' })).toBe(true)
    expect(call(scoreHistory.access?.create, { id: 3 })).toBe(true)
  })

  it('keeps the stricter update/delete policy of both collections', () => {
    for (const op of ['update', 'delete'] as const) {
      expect(call(scoreHistory.access?.[op], editor)).toBe(false)
      expect(call(rankHistory.access?.[op], editor)).toBe(false)
      expect(call(scoreHistory.access?.[op], { id: 1, role: 'admin' })).toBe(true)
      expect(call(rankHistory.access?.[op], { id: 1, role: 'admin' })).toBe(true)
    }
  })
})
