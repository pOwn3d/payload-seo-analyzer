import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Access } from 'payload'
import { createSeoSettingsCollection } from '../collections/SeoSettings.js'
import { createSeoRedirectsCollection } from '../collections/SeoRedirects.js'
import { createSeoGscAuthCollection } from '../collections/SeoGscAuth.js'
import { createAiAltTextHandler } from '../endpoints/aiAltText.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (fn: Access | undefined, user: any) => Boolean(fn?.({ req: { user } } as any))

const collections = [
  ['seo-settings', createSeoSettingsCollection()],
  ['seo-redirects', createSeoRedirectsCollection()],
  ['seo-gsc-auth', createSeoGscAuthCollection()],
] as const

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
