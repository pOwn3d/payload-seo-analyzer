import { describe, it, expect, vi } from 'vitest'
import { createRedirectsHandler } from '../endpoints/redirects.js'

const COLLECTION = 'seo-redirects'

type CreateCall = { collection: string; data: Record<string, unknown> }

/**
 * Minimal PayloadRequest double for the bulk-import branch.
 * `create` records the interleaving of its calls so the test can prove the
 * writes are serialized (SQLite is single-writer).
 */
function makeReq(options: {
  redirects: Array<{ from: string; to: string; type?: string }>
  onCreate?: (call: CreateCall) => Promise<void> | void
  findImpl?: () => Promise<{ docs: unknown[] }>
}) {
  const createCalls: CreateCall[] = []
  const concurrency = { current: 0, max: 0 }
  const findArgs: Array<Record<string, unknown>> = []
  const warn = vi.fn()

  const req = {
    user: { id: 1 }, // role-less user → isSeoAdmin fails open, as documented
    method: 'POST',
    url: '/api/seo-plugin/redirects',
    json: async () => ({ redirects: options.redirects }),
    payload: {
      logger: { warn, error: vi.fn(), info: vi.fn() },
      find: async (args: Record<string, unknown>) => {
        findArgs.push(args)
        return options.findImpl ? await options.findImpl() : { docs: [] }
      },
      create: async (call: CreateCall) => {
        concurrency.current++
        concurrency.max = Math.max(concurrency.max, concurrency.current)
        createCalls.push(call)
        try {
          if (options.onCreate) await options.onCreate(call)
        } finally {
          concurrency.current--
        }
        return { id: createCalls.length }
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  return { req, createCalls, concurrency, findArgs, warn }
}

describe('redirects bulk import', () => {
  // Regression: the creates used to run through Promise.all, which raises
  // SQLITE_BUSY on the single-writer SQLite the plugin targets.
  it('creates redirects sequentially, never concurrently', async () => {
    const redirects = Array.from({ length: 12 }, (_, i) => ({
      from: `/old-${i}`,
      to: `/new-${i}`,
    }))
    const { req, concurrency, createCalls } = makeReq({
      redirects,
      // Yield to the event loop inside the write: any Promise.all would
      // immediately push concurrency above 1.
      onCreate: () => new Promise((resolve) => setTimeout(resolve, 0)),
    })

    const res = await createRedirectsHandler(COLLECTION)(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(concurrency.max).toBe(1)
    expect(createCalls).toHaveLength(12)
    expect(body.created).toBe(12)
    expect(body.errors).toBe(0)
  })

  it('does not cap the dedup query by page size', async () => {
    const { req, findArgs } = makeReq({
      redirects: [{ from: '/a', to: '/b' }],
    })
    await createRedirectsHandler(COLLECTION)(req)

    expect(findArgs[0]?.pagination).toBe(false)
    expect(findArgs[0]?.limit).toBeUndefined()
  })

  it('reports and logs individual create failures instead of losing them', async () => {
    const { req, warn } = makeReq({
      redirects: [
        { from: '/ok', to: '/fine' },
        { from: '/boom', to: '/target' },
      ],
      onCreate: (call) => {
        if (call.data.from === '/boom') throw new Error('SQLITE_BUSY')
      },
    })

    const res = await createRedirectsHandler(COLLECTION)(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.created).toBe(1)
    expect(body.errors).toBe(1)
    expect(body.failed).toEqual([
      { from: '/boom', to: '/target', reason: 'SQLITE_BUSY' },
    ])
    expect(body.failedTruncated).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('caps the reported failure list at 100 while keeping the counter exact', async () => {
    const redirects = Array.from({ length: 150 }, (_, i) => ({
      from: `/x-${i}`,
      to: `/y-${i}`,
    }))
    const { req } = makeReq({
      redirects,
      onCreate: () => {
        throw new Error('nope')
      },
    })

    const res = await createRedirectsHandler(COLLECTION)(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.errors).toBe(150)
    expect((body.failed as unknown[]).length).toBe(100)
    expect(body.failedTruncated).toBe(true)
  })
})
