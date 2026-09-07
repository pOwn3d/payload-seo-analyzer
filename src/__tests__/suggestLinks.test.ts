import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSuggestLinksHandler, SUGGEST_LINKS_CACHE_BASE } from '../endpoints/suggestLinks.js'
import { seoCache } from '../cache.js'

const CONTENT =
  "Nous parlons de creation site internet et de referencement naturel dans cet article assez long pour declencher l analyse."

function makeReq(find: ReturnType<typeof vi.fn>, locale?: string) {
  return {
    user: { id: 1 },
    method: 'POST',
    ...(locale ? { locale } : {}),
    json: async () => ({ documentId: '99', collection: 'pages', content: CONTENT }),
    payload: {
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      find,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function makeFind() {
  return vi.fn(async ({ collection }: { collection: string }) => {
    if (collection !== 'pages') return { docs: [], hasNextPage: false }
    return {
      docs: [
        { id: '1', title: 'Creation site internet', slug: 'creation-site-internet', focusKeyword: 'creation site internet' },
      ],
      hasNextPage: false,
    }
  })
}

describe('/suggest-links', () => {
  beforeEach(() => {
    seoCache.invalidate()
  })

  it('still returns the matching suggestion', async () => {
    const find = makeFind()
    const res = await createSuggestLinksHandler(['pages'])(makeReq(find))
    const body = (await res.json()) as { suggestions: Array<Record<string, unknown>> }

    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0].slug).toBe('creation-site-internet')
    expect(body.suggestions[0].matchType).toBe('keyword')
  })

  // The editor polls this every 2 s while typing; it used to reload the whole
  // corpus (Lexical trees included) on each call.
  it('reads only the projected fields, not whole documents', async () => {
    const find = makeFind()
    await createSuggestLinksHandler(['pages'])(makeReq(find))
    expect(find.mock.calls[0][0].select).toEqual({ title: true, slug: true, focusKeyword: true })
  })

  it('reuses the cached corpus on the next call', async () => {
    const find = makeFind()
    await createSuggestLinksHandler(['pages'])(makeReq(find))
    expect(find).toHaveBeenCalledTimes(1)
    await createSuggestLinksHandler(['pages'])(makeReq(find))
    expect(find).toHaveBeenCalledTimes(1)
  })

  it('scopes the cache key per locale so one locale cannot poison another', async () => {
    const find = makeFind()
    await createSuggestLinksHandler(['pages'])(makeReq(find, 'fr'))
    await createSuggestLinksHandler(['pages'])(makeReq(find, 'en'))
    expect(find).toHaveBeenCalledTimes(2)
    expect(seoCache.stats().keys).toContain(`${SUGGEST_LINKS_CACHE_BASE}:fr`)
    expect(seoCache.stats().keys).toContain(`${SUGGEST_LINKS_CACHE_BASE}:en`)
  })

  // The locale-scoped keys must be reachable by the save-time invalidation,
  // which goes through invalidateByPrefix — invalidateKey would never match.
  it('is cleared by a prefix invalidation', async () => {
    const find = makeFind()
    await createSuggestLinksHandler(['pages'])(makeReq(find, 'fr'))
    seoCache.invalidateByPrefix(SUGGEST_LINKS_CACHE_BASE)
    await createSuggestLinksHandler(['pages'])(makeReq(find, 'fr'))
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('falls back to a select-less read when the projection is rejected', async () => {
    const find = vi.fn(async (args: Record<string, unknown>) => {
      if (args.select) throw new Error('no such column: focusKeyword')
      return {
        docs: [{ id: '1', title: 'Creation site internet', slug: 'creation-site-internet' }],
        hasNextPage: false,
      }
    })
    const res = await createSuggestLinksHandler(['pages'])(makeReq(find))
    const body = (await res.json()) as { suggestions: unknown[] }

    // The collection is still analysed instead of silently vanishing.
    expect(body.suggestions.length).toBeGreaterThan(0)
  })
})
