/**
 * Non-regression tests for the confirmed security findings of the 2026 audit.
 *
 * Each block below fails if the corresponding door is reopened. The common thread
 * of SEO-01/02/04 is the same wrong assumption — `req.user` was read as "an admin
 * is calling" — which any second auth collection (front-office customers, members)
 * invalidates.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSeoAdmin, isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'
import { isPrivateIP, isPrivateUrl } from '../helpers/ssrfGuard.js'
import { validateRedirectDestination, validateRedirectTarget } from '../helpers/redirectSafety.js'
import { createAutoRedirectHook } from '../hooks/autoRedirect.js'
import { createAuditHandler } from '../endpoints/audit.js'
import { createAiContentBriefHandler, MAX_KEYWORD_LENGTH } from '../endpoints/aiContentBrief.js'
import { createSitemapHandler } from '../endpoints/sitemap.js'
import { createRedirectsHandler } from '../endpoints/redirects.js'
import { createDuplicateContentHandler } from '../endpoints/duplicateContent.js'
import { createSeoRedirectsCollection } from '../collections/SeoRedirects.js'
import { createSeoLogsHandler, MAX_LOG_TEXT_LENGTH } from '../endpoints/seoLogs.js'
import { SITEMAP_XML_CACHE_BASE } from '../endpoints/sitemap.js'
import {
  createImageSitemapHandler,
  createNewsSitemapHandler,
  SITEMAP_IMAGES_CACHE_BASE,
  SITEMAP_NEWS_CACHE_BASE,
  SITEMAP_VIDEO_CACHE_BASE,
} from '../endpoints/sitemapExtensions.js'
import { seoViewRedirectTarget } from '../helpers/viewAccess.js'
import { safeCacheLocale } from '../helpers/safeCacheLocale.js'
import { seoAnalyzerPlugin } from '../plugin.js'
import { seoCache } from '../cache.js'

const ENDPOINTS_DIR = join(fileURLToPath(new URL('../endpoints/', import.meta.url)))
const VIEWS_DIR = join(fileURLToPath(new URL('../views/', import.meta.url)))
const COMPONENTS_DIR = join(fileURLToPath(new URL('../components/', import.meta.url)))

/** A host with a staff collection (`users`) AND a front-office one (`customers`). */
const multiAuthPayload = {
  config: { admin: { user: 'users' } },
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}

const staff = { id: 1, collection: 'users' }
const customer = { id: 1, collection: 'customers' } // same id on purpose

// ---------------------------------------------------------------------------
// SEO-01 — isSeoAdmin granted admin rights to any authenticated user
// ---------------------------------------------------------------------------
describe('SEO-01 — the admin gate checks the auth collection, not just `req.user`', () => {
  const prev = process.env.SEO_ADMIN_USER_COLLECTIONS
  afterEach(() => {
    if (prev === undefined) delete process.env.SEO_ADMIN_USER_COLLECTIONS
    else process.env.SEO_ADMIN_USER_COLLECTIONS = prev
  })

  it('denies a front-office customer, even role-less (fail-open no longer reaches them)', () => {
    const req = { user: customer, payload: multiAuthPayload }
    expect(isSeoPanelUser(req)).toBe(false)
    expect(isSeoAdminRequest(req)).toBe(false)
  })

  it('denies a customer who even carries role: admin on their own collection', () => {
    const req = { user: { ...customer, role: 'admin' }, payload: multiAuthPayload }
    expect(isSeoAdminRequest(req)).toBe(false)
  })

  it('still allows the admin-panel user (role-less setups keep working)', () => {
    const req = { user: staff, payload: multiAuthPayload }
    expect(isSeoPanelUser(req)).toBe(true)
    expect(isSeoAdminRequest(req)).toBe(true)
  })

  it('honours a custom admin collection slug declared by the host', () => {
    const req = { user: { id: 1, collection: 'staff' }, payload: { config: { admin: { user: 'staff' } } } }
    expect(isSeoAdminRequest(req)).toBe(true)
  })

  it('supports several admin collections via SEO_ADMIN_USER_COLLECTIONS', () => {
    process.env.SEO_ADMIN_USER_COLLECTIONS = 'users, staff'
    expect(isSeoPanelUser({ user: { id: 1, collection: 'staff' }, payload: multiAuthPayload })).toBe(true)
    expect(isSeoPanelUser({ user: customer, payload: multiAuthPayload })).toBe(false)
  })

  it('keeps the legacy behaviour when the host exposes no admin collection', () => {
    // Unknown origin → we cannot prove the user is foreign; do not lock admins out.
    expect(isSeoPanelUser({ user: { id: 1 }, payload: multiAuthPayload })).toBe(true)
    expect(isSeoPanelUser({ user: customer, payload: {} })).toBe(true)
  })

  it('rejects anonymous callers', () => {
    expect(isSeoPanelUser({ payload: multiAuthPayload })).toBe(false)
    expect(isSeoAdminRequest({ user: null, payload: multiAuthPayload })).toBe(false)
  })

  it('leaves the user-only role helper untouched for existing consumers', () => {
    expect(isSeoAdmin({ role: 'admin' })).toBe(true)
    expect(isSeoAdmin({ role: 'editor' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SEO-02 — `!!req.user` guards leaked the whole CMS (drafts included)
// ---------------------------------------------------------------------------
describe('SEO-02 — endpoint guards require an admin-panel session', () => {
  /** Endpoint sources with comments and string literals stripped. */
  function endpointCode(): Array<{ file: string; code: string }> {
    return readdirSync(ENDPOINTS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((file) => ({
        file,
        code: readFileSync(join(ENDPOINTS_DIR, file), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (the prose explaining the fix)
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1'), // line comments
      }))
  }

  // The first version of this guard grepped for the literal '!req.user'. It would
  // have missed `if (!req?.user)`, `const u = req.user; if (!u)`, and fired on a
  // comment. Since no endpoint reads `req.user` at all any more — every gate goes
  // through the helpers — the tight invariant is: no `req.user` in endpoint CODE.
  it('no endpoint reads `req.user` directly, whatever the spelling', () => {
    const offenders = endpointCode()
      .filter(({ code }) => /\breq\s*\??\.\s*user\b/.test(code))
      .map(({ file }) => file)
    expect(offenders).toEqual([])
  })

  it('every endpoint that can answer 401 goes through the isAdmin helpers', () => {
    const offenders = endpointCode()
      .filter(({ code }) => code.includes('status: 401'))
      .filter(({ code }) => !code.includes("helpers/isAdmin.js"))
      .map(({ file }) => file)
    expect(offenders).toEqual([])
  })

  it('returns 401 on /audit for a front-office customer before touching the data', async () => {
    const find = vi.fn()
    const res = await createAuditHandler(['pages'])({
      user: customer,
      url: 'http://localhost/api/seo-plugin/audit?limit=500',
      payload: { ...multiAuthPayload, find },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(res.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SEO-03 — SSRF via IPv4-mapped IPv6
// ---------------------------------------------------------------------------
describe('SEO-03 — SSRF guard understands IPv4-mapped IPv6', () => {
  it('blocks the mapped forms that used to slip through', () => {
    // Hexadecimal notation is what `new URL()` hands back.
    expect(isPrivateIP('::ffff:a9fe:a9fe')).toBe(true) // 169.254.169.254 (cloud metadata)
    expect(isPrivateIP('::ffff:7f00:1')).toBe(true) // 127.0.0.1
    expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true)
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIP('0:0:0:0:0:ffff:7f00:1')).toBe(true)
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIP('::ffff:c0a8:1')).toBe(true) // 192.168.0.1
  })

  it('blocks the URL forms of the same addresses', () => {
    expect(isPrivateUrl('http://[::ffff:169.254.169.254]/latest/meta-data/')).toBe(true)
    expect(isPrivateUrl('http://[::ffff:127.0.0.1]/')).toBe(true)
    expect(isPrivateUrl('http://[::ffff:7f00:1]/')).toBe(true)
  })

  it('blocks 6to4 and NAT64 wrappers around private space', () => {
    expect(isPrivateIP('2002:7f00:1::')).toBe(true) // 6to4 of 127.0.0.1
    expect(isPrivateIP('64:ff9b::a9fe:a9fe')).toBe(true) // NAT64 of 169.254.169.254
  })

  it('blocks the IPv4 ranges the original regex forgot', () => {
    expect(isPrivateIP('100.64.0.1')).toBe(true) // CGNAT
    expect(isPrivateIP('192.0.0.1')).toBe(true)
    expect(isPrivateIP('198.18.0.1')).toBe(true)
    expect(isPrivateIP('224.0.0.1')).toBe(true) // multicast
    expect(isPrivateIP('255.255.255.255')).toBe(true)
  })

  it('still blocks the classics', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', '::', 'fd00::1', 'fe80::1']) {
      expect(isPrivateIP(ip), ip).toBe(true)
    }
    expect(isPrivateUrl('http://localhost/')).toBe(true)
    expect(isPrivateUrl('http://sub.localhost/')).toBe(true)
  })

  it('keeps public destinations reachable', () => {
    expect(isPrivateIP('93.184.216.34')).toBe(false)
    expect(isPrivateIP('2606:2800:220:1:248:1893:25c8:1946')).toBe(false)
    expect(isPrivateUrl('https://example.com/page')).toBe(false)
    expect(isPrivateUrl('http://example.com:80/')).toBe(false)
    expect(isPrivateUrl('https://example.com:443/')).toBe(false)
  })

  it('refuses non-web ports and non-http schemes (internal port scanning)', () => {
    expect(isPrivateUrl('http://example.com:6379/')).toBe(true)
    expect(isPrivateUrl('http://example.com:22/')).toBe(true)
    expect(isPrivateUrl('file:///etc/passwd')).toBe(true)
    expect(isPrivateUrl('not a url')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SEO-05 — the AI endpoints were an unmetered LLM relay
// ---------------------------------------------------------------------------
describe('SEO-05 — /ai-content-brief', () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  const makeReq = (body: Record<string, unknown>, user: unknown = staff) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ user, json: async () => body, payload: multiAuthPayload }) as any

  it('rejects a front-office customer', async () => {
    const res = await createAiContentBriefHandler()(makeReq({ keyword: 'plombier lyon' }, customer))
    expect(res.status).toBe(401)
  })

  it('rejects an oversized keyword before any call to the model', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await createAiContentBriefHandler()(
      makeReq({ keyword: 'a'.repeat(MAX_KEYWORD_LENGTH + 1) }),
    )
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('keeps a realistic keyword acceptable (fails later, on configuration)', async () => {
    const res = await createAiContentBriefHandler()(makeReq({ keyword: 'plombier lyon urgence' }))
    const body = (await res.json()) as Record<string, unknown>
    expect(body.code).toBe('no_api_key') // got past the length gate
  })
})

// ---------------------------------------------------------------------------
// SEO-06 — the `external` flag was never consumed
// ---------------------------------------------------------------------------
describe('SEO-06 — external redirect destinations are gated', () => {
  it('refuses an absolute destination by default', () => {
    const res = validateRedirectDestination('https://evil.example/login', false)
    expect(res.valid).toBe(false)
    expect(res.reason).toMatch(/allowExternalRedirects/)
  })

  it('accepts it only when the host opted in', () => {
    const res = validateRedirectDestination('https://partner.example/offer', true)
    expect(res.valid).toBe(true)
    expect(res.external).toBe(true)
  })

  it('never blocks same-site paths', () => {
    expect(validateRedirectDestination('/nouvelle-page', false).valid).toBe(true)
    expect(validateRedirectDestination('ancienne-page', false).normalized).toBe('/ancienne-page')
  })

  it('keeps rejecting the historical open-redirect payloads whatever the option', () => {
    for (const allow of [false, true]) {
      expect(validateRedirectDestination('//evil.example', allow).valid).toBe(false)
      expect(validateRedirectDestination('javascript:alert(1)', allow).valid).toBe(false)
      expect(validateRedirectDestination('/\\evil.example', allow).valid).toBe(false)
    }
  })

  it('leaves the low-level validator untouched (it still just reports `external`)', () => {
    const res = validateRedirectTarget('https://partner.example/offer')
    expect(res.valid).toBe(true)
    expect(res.external).toBe(true)
  })

  it('auto-redirect turns a URL-shaped slug into nothing, never into an off-site 301', async () => {
    const create = vi.fn()
    const hook = createAutoRedirectHook('seo-redirects')
    await hook({
      data: { slug: 'https://evil.example' },
      originalDoc: { slug: 'ancienne-page' },
      operation: 'update',
      req: {
        payload: { find: vi.fn(async () => ({ docs: [] })), create, logger: multiAuthPayload.logger },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(create).not.toHaveBeenCalled()
  })

  it('auto-redirect still records an ordinary slug change', async () => {
    const create = vi.fn(async () => ({ id: 1 }))
    const hook = createAutoRedirectHook('seo-redirects')
    await hook({
      data: { slug: 'nouvelle-page' },
      originalDoc: { slug: 'ancienne-page' },
      operation: 'update',
      req: {
        payload: { find: vi.fn(async () => ({ docs: [] })), create, logger: multiAuthPayload.logger },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ from: '/ancienne-page', to: '/nouvelle-page' }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// SEO-07 — `?nocache=1` kept the site-wide rebuild running in a loop
// ---------------------------------------------------------------------------
describe('SEO-07 — manual audit refresh is admin-only', () => {
  const prev = process.env.SEO_REQUIRE_ADMIN_ROLE
  afterEach(() => {
    if (prev === undefined) delete process.env.SEO_REQUIRE_ADMIN_ROLE
    else process.env.SEO_REQUIRE_ADMIN_ROLE = prev
    seoCache.invalidateKey('audit')
  })

  it('serves the cache instead of dropping it when a non-admin asks for nocache=1', async () => {
    process.env.SEO_REQUIRE_ADMIN_ROLE = '1'
    seoCache.set('audit', {
      enrichedResults: [{ id: '1', title: 'Accueil' }],
      stats: { total: 1 },
      capped: false,
    })

    const res = await createAuditHandler(['pages'])({
      user: { id: 2, collection: 'users', role: 'editor' },
      url: 'http://localhost/api/seo-plugin/audit?nocache=1',
      payload: multiAuthPayload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.refreshThrottled).toBe(true)
    expect((body.results as unknown[]).length).toBe(1)
    // The door being reopened would mean the cache was invalidated here.
    expect(seoCache.get('audit')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SEO-08 — sitemap.xml published noindex URLs to anonymous callers
// ---------------------------------------------------------------------------
describe('SEO-08 — sitemap.xml honours noindex', () => {
  function makePayload(docs: Record<string, unknown>[]) {
    return {
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      find: vi.fn(async (args: Record<string, unknown>) => {
        if (args.collection === 'seo-settings') return { docs: [{ sitemap: {} }], hasNextPage: false }
        return { docs, hasNextPage: false, totalDocs: docs.length }
      }),
    }
  }

  it('omits documents flagged noindex (top-level and under meta) but keeps the rest', async () => {
    const payload = makePayload([
      { slug: 'accueil', _status: 'published' },
      { slug: 'merci-achat', _status: 'published', noindex: true },
      { slug: 'tarifs-prives', _status: 'published', meta: { noindex: true } },
      { slug: 'brouillon', _status: 'draft' },
    ])
    const res = await createSitemapHandler(['pages'])({
      payload,
      url: 'http://localhost/api/seo-plugin/sitemap.xml',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const xml = await res.text()

    expect(xml).toContain('/accueil')
    expect(xml).not.toContain('merci-achat')
    expect(xml).not.toContain('tarifs-prives')
    expect(xml).not.toContain('brouillon')
  })
})

// ---------------------------------------------------------------------------
// Hardening regressions — a door closed at the cost of a broken feature is not
// a win: the integrator rolls the plugin back, and the hole comes back with it.
// Each block below pins BOTH sides: the legitimate flow works, the hole stays shut.
// ---------------------------------------------------------------------------

const LEGACY_EXTERNAL = 'https://ancien-domaine.example/page'

function redirectToValidate(allowExternal = false) {
  const collection = createSeoRedirectsCollection('seo-redirects', allowExternal)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const field = (collection.fields as any[]).find((f) => f.name === 'to')
  return field.validate as (
    value: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: Record<string, any>,
  ) => string | true
}

describe('SEO-06 regression — the external gate only fires on a CHANGE', () => {
  it('lets an existing external redirect be saved untouched (301 → 302 stays possible)', () => {
    // Payload revalidates the whole merged document on a partial update: refusing
    // here froze every row stored before `allowExternalRedirects` existed.
    const validate = redirectToValidate()
    expect(
      validate(LEGACY_EXTERNAL, {
        operation: 'update',
        event: 'submit',
        previousValue: LEGACY_EXTERNAL,
      }),
    ).toBe(true)
  })

  it('still refuses pointing an existing row at ANOTHER origin', () => {
    const validate = redirectToValidate()
    const res = validate('https://evil.example/login', {
      operation: 'update',
      event: 'submit',
      previousValue: LEGACY_EXTERNAL,
    })
    expect(typeof res).toBe('string')
    expect(res).toMatch(/allowExternalRedirects/)
  })

  it('still refuses creating an external destination', () => {
    const validate = redirectToValidate()
    expect(typeof validate('https://evil.example/login', { operation: 'create', event: 'submit' })).toBe(
      'string',
    )
  })

  it('still refuses an external destination on a doc that had none', () => {
    const validate = redirectToValidate()
    expect(
      typeof validate('https://evil.example/login', {
        operation: 'update',
        event: 'submit',
        previousValue: '/ancienne-page',
      }),
    ).toBe('string')
  })

  it('keeps same-site paths and the opt-in untouched', () => {
    expect(redirectToValidate()('/nouvelle-page', { operation: 'update', event: 'submit', previousValue: LEGACY_EXTERNAL })).toBe(true)
    expect(redirectToValidate(true)('https://partner.example/offer', { operation: 'create', event: 'submit' })).toBe(true)
  })

  it('never lets the open-redirect payloads through, changed or not', () => {
    const validate = redirectToValidate()
    for (const payload of ['//evil.example', 'javascript:alert(1)', '/\\evil.example']) {
      expect(
        typeof validate(payload, { operation: 'update', event: 'submit', previousValue: payload }),
      ).toBe('string')
    }
  })
})

describe('SEO-06 regression — PATCH /redirects on a legacy external row', () => {
  function makePatchReq(body: Record<string, unknown>, storedTo: string) {
    const update = vi.fn(async (args: Record<string, unknown>) => ({ id: 'r1', ...(args.data as object) }))
    const findByID = vi.fn(async () => ({ id: 'r1', from: '/ancienne-page', to: storedTo, type: '301' }))
    const req = {
      user: staff,
      method: 'PATCH',
      url: 'http://localhost/api/seo-plugin/redirects',
      json: async () => body,
      payload: { ...multiAuthPayload, update, findByID },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
    return { req, update, findByID }
  }

  it('accepts the unchanged destination the Redirect Manager always re-sends, and writes nothing to `to`', async () => {
    const { req, update } = makePatchReq(
      { id: 'r1', from: '/ancienne-page', to: LEGACY_EXTERNAL, type: '302' },
      LEGACY_EXTERNAL,
    )
    const res = await createRedirectsHandler('seo-redirects')(req)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    const data = update.mock.calls[0][0].data as Record<string, unknown>
    expect(data.type).toBe('302')
    expect(data.from).toBe('/ancienne-page')
    expect(data).not.toHaveProperty('to')
  })

  it('refuses a DIFFERENT external destination on the same row', async () => {
    const { req, update } = makePatchReq(
      { id: 'r1', to: 'https://evil.example/login' },
      LEGACY_EXTERNAL,
    )
    const res = await createRedirectsHandler('seo-redirects')(req)
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SEO-05 residue — /ai-rewrite and /ai-optimize were registered with NO limiter
// ---------------------------------------------------------------------------
describe('SEO-05 residue — every LLM endpoint is rate limited', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function pluginEndpoints(): any[] {
    const config = {
      collections: [
        { slug: 'pages', fields: [] },
        { slug: 'users', fields: [], auth: true },
      ],
      globals: [],
      endpoints: [],
      admin: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
    return seoAnalyzerPlugin({ collections: ['pages'] })(config).endpoints || []
  }

  for (const path of ['/seo-plugin/ai-rewrite', '/seo-plugin/ai-optimize']) {
    it(`returns 429 once ${path} is hammered by a single account`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const endpoint = pluginEndpoints().find((e: any) => e.path === path)
      expect(endpoint).toBeTruthy()
      const req = {
        user: staff,
        method: 'POST',
        url: `http://localhost/api${path}`,
        json: async () => ({}),
        payload: multiAuthPayload,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any

      const first = await endpoint.handler(req)
      expect(first.status).not.toBe(429)

      let sawLimit = false
      for (let i = 0; i < 60 && !sawLimit; i++) {
        const res = await endpoint.handler(req)
        if (res.status === 429) sawLimit = true
      }
      expect(sawLimit).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// SEO-07 residue — the other site-wide endpoints honoured `?nocache=1` for anyone
// ---------------------------------------------------------------------------
describe('SEO-07 residue — cache-busting the site-wide endpoints is admin-only', () => {
  const prev = process.env.SEO_REQUIRE_ADMIN_ROLE
  afterEach(() => {
    if (prev === undefined) delete process.env.SEO_REQUIRE_ADMIN_ROLE
    else process.env.SEO_REQUIRE_ADMIN_ROLE = prev
    seoCache.invalidateKey('duplicate-content:default:0.7')
  })

  it('serves the cache to a non-admin panel user instead of recomputing site-wide', async () => {
    process.env.SEO_REQUIRE_ADMIN_ROLE = '1'
    seoCache.set('duplicate-content:default:0.7', { duplicates: [] })
    const find = vi.fn()

    const res = await createDuplicateContentHandler(['pages'])({
      user: { id: 2, collection: 'users', role: 'editor' },
      url: 'http://localhost/api/seo-plugin/duplicate-content?nocache=1',
      payload: { ...multiAuthPayload, find },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    expect(res.status).toBe(200)
    expect((await res.json()).cached).toBe(true)
    expect(find).not.toHaveBeenCalled()
  })

  it('still lets an SEO admin force the recomputation', async () => {
    seoCache.set('duplicate-content:default:0.7', { duplicates: [] })
    const find = vi.fn(async () => ({ docs: [] }))

    await createDuplicateContentHandler(['pages'])({
      user: staff,
      url: 'http://localhost/api/seo-plugin/duplicate-content?nocache=1',
      payload: { ...multiAuthPayload, find },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    expect(find).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SEO-09 — `?locale=` forged the cache key, so the admin gate AND the refresh
// throttle added for SEO-07 were both walked around: an unknown locale is a
// guaranteed cache miss, and a cache miss rebuilds the whole site.
// ---------------------------------------------------------------------------
describe('SEO-09 — the cache scope comes from the host config, not from ?locale=', () => {
  const prevRole = process.env.SEO_REQUIRE_ADMIN_ROLE
  afterEach(() => {
    if (prevRole === undefined) delete process.env.SEO_REQUIRE_ADMIN_ROLE
    else process.env.SEO_REQUIRE_ADMIN_ROLE = prevRole
    seoCache.invalidate()
  })

  const localizedPayload = {
    config: {
      admin: { user: 'users' },
      // `fallback: false` on purpose: Payload's sanitizeLocales() only rewrites an
      // unknown locale when a fallback exists, so even a localized site forwards
      // the raw query string in that case.
      localization: { localeCodes: ['fr', 'en'], defaultLocale: 'fr', fallback: false },
    },
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }

  it('drops a locale the host never declared', () => {
    expect(safeCacheLocale({ locale: 'a1', payload: localizedPayload })).toBeUndefined()
    // No localization block at all → the site has one corpus, hence one key.
    expect(safeCacheLocale({ locale: 'a1', payload: multiAuthPayload })).toBeUndefined()
  })

  it('keeps a declared locale, and Payload cross-locale mode, as distinct scopes', () => {
    expect(safeCacheLocale({ locale: 'en', payload: localizedPayload })).toBe('en')
    expect(safeCacheLocale({ locale: 'all', payload: localizedPayload })).toBe('all')
    expect(safeCacheLocale({ locale: '*', payload: localizedPayload })).toBe('all')
  })

  it('still throttles a non-admin refresh when the locale is forged', async () => {
    process.env.SEO_REQUIRE_ADMIN_ROLE = '1'
    seoCache.set('audit', {
      enrichedResults: [{ id: '1', title: 'Accueil' }],
      stats: { total: 1 },
      capped: false,
    })

    const res = await createAuditHandler(['pages'])({
      user: { id: 2, collection: 'users', role: 'editor' },
      locale: 'a1',
      url: 'http://localhost/api/seo-plugin/audit?nocache=1&locale=a1',
      payload: multiAuthPayload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Before the fix: key `audit:a1` → miss → 202 and a fresh site-wide build,
    // past both the admin gate and the 5-minute throttle.
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.refreshThrottled).toBe(true)
    expect((body.results as unknown[]).length).toBe(1)
    expect(seoCache.get('audit')).not.toBeNull()
  })

  it('serves the cached aggregation instead of recomputing it per forged locale', async () => {
    seoCache.set('duplicate-content:default:0.7', { duplicates: [] })
    const find = vi.fn()

    for (const forged of ['a1', 'a2', 'a3']) {
      const res = await createDuplicateContentHandler(['pages'])({
        user: staff,
        locale: forged,
        url: `http://localhost/api/seo-plugin/duplicate-content?locale=${forged}`,
        payload: { ...multiAuthPayload, find },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      expect((await res.json()).cached).toBe(true)
    }
    expect(find).not.toHaveBeenCalled()
  })

  // The other half of the contract: a real multi-locale site must keep one
  // cache entry per locale, or the fix would serve French results in English.
  it('keeps declared locales isolated from one another', async () => {
    seoCache.set('duplicate-content:fr:0.7', { duplicates: [] })
    const find = vi.fn(async () => ({ docs: [] }))

    const frRes = await createDuplicateContentHandler(['pages'])({
      user: staff,
      locale: 'fr',
      url: 'http://localhost/api/seo-plugin/duplicate-content?locale=fr',
      payload: { ...localizedPayload, find },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect((await frRes.json()).cached).toBe(true)
    expect(find).not.toHaveBeenCalled()

    await createDuplicateContentHandler(['pages'])({
      user: staff,
      locale: 'en',
      url: 'http://localhost/api/seo-plugin/duplicate-content?locale=en',
      payload: { ...localizedPayload, find },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(find).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SEO-10 — sitemap.xml, the only anonymous endpoint, was also the most expensive
// per request: a hard-coded 10 000-doc read on every hit, no cache.
// ---------------------------------------------------------------------------
describe('SEO-10 — the public sitemap is bounded and cached', () => {
  const prevMax = process.env.SEO_FETCH_MAX_DOCS
  const prevSitemapMax = process.env.SEO_SITEMAP_MAX_DOCS
  afterEach(() => {
    if (prevMax === undefined) delete process.env.SEO_FETCH_MAX_DOCS
    else process.env.SEO_FETCH_MAX_DOCS = prevMax
    if (prevSitemapMax === undefined) delete process.env.SEO_SITEMAP_MAX_DOCS
    else process.env.SEO_SITEMAP_MAX_DOCS = prevSitemapMax
    seoCache.invalidateByPrefix(SITEMAP_XML_CACHE_BASE)
    delete process.env.NEXT_PUBLIC_SERVER_URL
  })

  function makePayload(docs: Record<string, unknown>[]) {
    return {
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      find: vi.fn(async (args: Record<string, unknown>) => {
        if (args.collection === 'seo-settings') return { docs: [{ sitemap: {} }], hasNextPage: false }
        return { docs, hasNextPage: false, totalDocs: docs.length }
      }),
    }
  }

  const published = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ slug: `page-${i}`, _status: 'published' }))

  it('honours the documented memory cap instead of the hard-coded 10 000', async () => {
    process.env.SEO_FETCH_MAX_DOCS = '2'
    const payload = makePayload(published(5))

    const xml = await (
      await createSitemapHandler(['seo10-cap'])({
        payload,
        url: 'http://localhost/api/seo-plugin/sitemap.xml',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).text()

    expect((xml.match(/<loc>/g) || []).length).toBe(2)
  })

  it('SEO_SITEMAP_MAX_DOCS wins, so both public sitemaps share one knob', async () => {
    process.env.SEO_FETCH_MAX_DOCS = '5'
    process.env.SEO_SITEMAP_MAX_DOCS = '1'
    const payload = makePayload(published(5))

    const xml = await (
      await createSitemapHandler(['seo10-knob'])({
        payload,
        url: 'http://localhost/api/seo-plugin/sitemap.xml',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).text()

    expect((xml.match(/<loc>/g) || []).length).toBe(1)
  })

  it('rescans only once, then serves the rendered XML from the cache', async () => {
    const payload = makePayload(published(3))
    const handler = createSitemapHandler(['seo10-cache'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = { payload, url: 'http://localhost/api/seo-plugin/sitemap.xml' } as any

    const first = await (await handler(req)).text()
    const callsAfterFirst = payload.find.mock.calls.length
    const second = await (await handler(req)).text()

    expect(second).toBe(first)
    expect(payload.find.mock.calls.length).toBe(callsAfterFirst)
    // The response is rebuilt from the cached string, headers included.
    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('application/xml')

    // …and a publish still shows up: the afterChange invalidation clears this key.
    seoCache.invalidateByPrefix(SITEMAP_XML_CACHE_BASE)
    await handler(req)
    expect(payload.find.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})

// ---------------------------------------------------------------------------
// SEO-11 — POST /seo-logs stored the visitor's Referer / User-Agent unbounded
// ---------------------------------------------------------------------------
describe('SEO-11 — visitor-supplied log fields are length-capped', () => {
  function makeLogsReq(body: Record<string, unknown>, create: ReturnType<typeof vi.fn>) {
    return {
      user: staff,
      method: 'POST',
      headers: new Headers({ 'x-forwarded-for': '203.0.113.7' }),
      url: 'http://localhost/api/seo-plugin/seo-logs',
      json: async () => body,
      payload: {
        ...multiAuthPayload,
        find: vi.fn(async () => ({ docs: [] })),
        create,
        update: vi.fn(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('truncates referrer and userAgent instead of storing a multi-kilobyte header', async () => {
    const create = vi.fn(async () => ({ id: '1' }))
    const res = await createSeoLogsHandler()(
      makeLogsReq(
        {
          url: '/page-absente',
          referrer: 'https://evil.example/?p=' + 'A'.repeat(200_000),
          userAgent: 'B'.repeat(200_000),
        },
        create,
      ),
    )

    expect(res.status).toBe(200)
    const data = create.mock.calls[0][0].data as Record<string, string>
    expect(data.referrer.length).toBe(MAX_LOG_TEXT_LENGTH)
    expect(data.userAgent.length).toBe(MAX_LOG_TEXT_LENGTH)
  })

  it('leaves a normal referrer and user agent untouched', async () => {
    const create = vi.fn(async () => ({ id: '1' }))
    const referrer = 'https://www.google.com/search?q=consilioweb'
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

    await createSeoLogsHandler()(makeLogsReq({ url: '/autre-page', referrer, userAgent }, create))

    const data = create.mock.calls[0][0].data as Record<string, string>
    expect(data.referrer).toBe(referrer)
    expect(data.userAgent).toBe(userAgent)
  })

  it('caps the increment path too — the row is upserted on every hit', async () => {
    const update = vi.fn(async () => ({ id: '1' }))
    const req = {
      user: staff,
      method: 'POST',
      headers: new Headers({ 'x-forwarded-for': '203.0.113.8' }),
      url: 'http://localhost/api/seo-plugin/seo-logs',
      json: async () => ({ url: '/page-absente', referrer: 'C'.repeat(200_000) }),
      payload: {
        ...multiAuthPayload,
        find: vi.fn(async () => ({ docs: [{ id: '1', count: 3 }] })),
        update,
        create: vi.fn(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await createSeoLogsHandler()(req)
    const data = update.mock.calls[0][0].data as Record<string, string>
    expect(data.referrer.length).toBe(MAX_LOG_TEXT_LENGTH)
  })
})

// ---------------------------------------------------------------------------
// SEO-12 — /sitemap-news.xml, /sitemap-images.xml and /sitemap-video.xml are
// anonymous like /sitemap.xml, cost MORE than it (depth 1 + a recursive media walk),
// and had neither the cache that bounds it nor a cap that actually stops the scan.
// ---------------------------------------------------------------------------
describe('SEO-12 — the public sitemap extensions are cached and really bounded', () => {
  const prevMax = process.env.SEO_SITEMAP_MAX_DOCS
  const prevBatch = process.env.SEO_SITEMAP_BATCH_SIZE

  afterEach(() => {
    if (prevMax === undefined) delete process.env.SEO_SITEMAP_MAX_DOCS
    else process.env.SEO_SITEMAP_MAX_DOCS = prevMax
    if (prevBatch === undefined) delete process.env.SEO_SITEMAP_BATCH_SIZE
    else process.env.SEO_SITEMAP_BATCH_SIZE = prevBatch
    for (const base of [SITEMAP_NEWS_CACHE_BASE, SITEMAP_IMAGES_CACHE_BASE, SITEMAP_VIDEO_CACHE_BASE]) {
      seoCache.invalidateByPrefix(base)
    }
  })

  /** A corpus that paginates: `pages` batches, all identical. */
  function makePayload(docs: Record<string, unknown>[], pages = 1) {
    let page = 0
    return {
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      find: vi.fn(async () => {
        page += 1
        return { docs, hasNextPage: page < pages, totalDocs: docs.length * pages }
      }),
    }
  }

  const drafts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ slug: `draft-${i}`, _status: 'draft' }))

  const withImage = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      slug: `page-${i}`,
      _status: 'published',
      meta: { image: { mimeType: 'image/png', url: '/media/a.png' } },
    }))

  it('rescans only once, then serves the rendered XML from the cache', async () => {
    const payload = makePayload(withImage(3))
    const handler = createImageSitemapHandler(['seo12-cache'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = { payload, url: 'http://localhost/api/seo-plugin/sitemap-images.xml' } as any

    const first = await (await handler(req)).text()
    const callsAfterFirst = payload.find.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    const second = await (await handler(req)).text()
    expect(second).toBe(first)
    expect(payload.find.mock.calls.length).toBe(callsAfterFirst)

    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('application/xml')

    // …and a publish still shows up: the afterChange invalidation clears this key.
    seoCache.invalidateByPrefix(SITEMAP_IMAGES_CACHE_BASE)
    await handler(req)
    expect(payload.find.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('caches the news sitemap too', async () => {
    const payload = makePayload([
      { slug: 'fresh', _status: 'published', title: 'Fresh', publishedAt: new Date().toISOString() },
    ])
    const handler = createNewsSitemapHandler(['seo12-news-cache'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = { payload, url: 'http://localhost/api/seo-plugin/sitemap-news.xml' } as any

    const first = await (await handler(req)).text()
    const calls = payload.find.mock.calls.length
    expect(await (await handler(req)).text()).toBe(first)
    expect(payload.find.mock.calls.length).toBe(calls)
  })

  it('counts every document READ against the cap, drafts included', async () => {
    // 20 pages of 50 drafts. The cap is 100 documents, so the scan must stop after
    // 3 reads — not walk the whole collection at depth 1 because nothing was emitted.
    process.env.SEO_SITEMAP_MAX_DOCS = '100'
    process.env.SEO_SITEMAP_BATCH_SIZE = '50'
    const payload = makePayload(drafts(50), 20)

    await createImageSitemapHandler(['seo12-cap'])({
      payload,
      url: 'http://localhost/api/seo-plugin/sitemap-images.xml',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    expect(payload.find.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('still emits up to the cap when the documents are publishable', async () => {
    process.env.SEO_SITEMAP_MAX_DOCS = '2'
    process.env.SEO_SITEMAP_BATCH_SIZE = '50'
    const payload = makePayload(withImage(5))

    const xml = await (
      await createImageSitemapHandler(['seo12-emit'])({
        payload,
        url: 'http://localhost/api/seo-plugin/sitemap-images.xml',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).text()

    expect((xml.match(/<loc>/g) || []).length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// SEO-13 — the 9 admin views only checked `!!req.user`. Declaring a custom view
// with a non-root path takes the route OUT of Payload's canAccessAdmin redirect,
// so that check was the only thing between a front-office account and the admin
// shell (full clientConfig serialized to their browser).
// ---------------------------------------------------------------------------
describe('SEO-13 — the admin views require an admin-panel session', () => {
  it('turns a front-office customer away, exactly as Payload would have', () => {
    expect(seoViewRedirectTarget({ req: { user: customer, payload: multiAuthPayload } })).toBe(
      '/admin/unauthorized',
    )
  })

  it('sends an anonymous visitor to the login screen', () => {
    expect(seoViewRedirectTarget({ req: { payload: multiAuthPayload } })).toBe('/admin/login')
    expect(seoViewRedirectTarget(undefined)).toBe('/admin/login')
  })

  it('lets the admin-panel user render the view', () => {
    expect(seoViewRedirectTarget({ req: { user: staff, payload: multiAuthPayload } })).toBeNull()
  })

  it('follows a host that renamed its admin route', () => {
    const payload = { config: { admin: { user: 'users' }, routes: { admin: '/back-office' } } }
    expect(seoViewRedirectTarget({ req: { user: customer, payload } })).toBe(
      '/back-office/unauthorized',
    )
  })

  it('never builds a protocol-relative target out of the host config', () => {
    const payload = { config: { admin: { user: 'users' }, routes: { admin: '/' } } }
    const target = seoViewRedirectTarget({ req: { user: customer, payload } })
    expect(target?.startsWith('//')).toBe(false)
  })

  it('every view goes through the shared gate, none keeps a bare `req.user` check', () => {
    const views = readdirSync(VIEWS_DIR).filter((f) => f.endsWith('View.tsx'))
    expect(views.length).toBeGreaterThanOrEqual(9)
    const offenders = views.filter((file) => {
      const code = readFileSync(join(VIEWS_DIR, file), 'utf8')
      return !code.includes('seoViewRedirectTarget') || /if \(!initPageResult\?\.req\?\.user\)/.test(code)
    })
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// SEO-14 — the RBAC fail-open tested the SHAPE of the role field
// (`typeof user.role !== 'string'`) instead of its ABSENCE, so a `role`
// relationship (a number at auth depth 0) or a single-value `roles` select
// promoted every editor to SEO admin.
// ---------------------------------------------------------------------------
describe('SEO-14 — the fail-open needs an absent role field, not a non-string one', () => {
  it('does not promote a role the host models as a relationship', () => {
    expect(isSeoAdmin({ role: 3 })).toBe(false)
    expect(isSeoAdmin({ role: { id: 3, name: 'editor' } })).toBe(false)
    expect(isSeoAdmin({ roles: [{ id: 3, name: 'editor' }] })).toBe(false)
  })

  it('does not promote a single-value `roles` select', () => {
    expect(isSeoAdmin({ roles: 'editor' })).toBe(false)
  })

  it('closes the endpoint gate for that same editor', () => {
    expect(
      isSeoAdminRequest({ user: { id: 2, collection: 'users', role: 3 }, payload: multiAuthPayload }),
    ).toBe(false)
    expect(
      isSeoAdminRequest({
        user: { id: 2, collection: 'users', roles: 'editor' },
        payload: multiAuthPayload,
      }),
    ).toBe(false)
  })

  it('still recognises the real admin behind those very shapes', () => {
    expect(isSeoAdmin({ role: 'admin' })).toBe(true)
    expect(isSeoAdmin({ roles: ['admin'] })).toBe(true)
    expect(isSeoAdmin({ roles: 'admin' })).toBe(true)
    expect(isSeoAdmin({ role: { id: 1, name: 'admin' } })).toBe(true)
    expect(isSeoAdmin({ roles: [{ slug: 'admin' }] })).toBe(true)
  })

  it('keeps failing open only when the host models no role at all', () => {
    expect(isSeoAdmin({ id: 1, email: 'a@b.c' })).toBe(true)
    expect(isSeoAdmin({ id: 1, role: undefined, roles: null })).toBe(true)
  })

  it('tells the operator when a role field carries no readable name', () => {
    const warn = vi.fn()
    const payload = { config: { admin: { user: 'seo14-opaque' } }, logger: { warn } }
    isSeoAdminRequest({ user: { id: 2, collection: 'seo14-opaque', role: 7 }, payload })
    expect(warn).toHaveBeenCalledTimes(1)
    // …once per boot, not once per request.
    isSeoAdminRequest({ user: { id: 3, collection: 'seo14-opaque', role: 8 }, payload })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// SEO-15 — POST /seo-logs wrote a collection whose ACL is `create: isSeoAdminRequest`,
// behind a panel-session-only gate and a limiter keyed on a spoofable header.
// ---------------------------------------------------------------------------
describe('SEO-15 — POST /seo-logs is admin-gated and its bucket is not spoofable', () => {
  const prevRows = process.env.SEO_LOGS_MAX_ROWS
  afterEach(() => {
    if (prevRows === undefined) delete process.env.SEO_LOGS_MAX_ROWS
    else process.env.SEO_LOGS_MAX_ROWS = prevRows
  })

  const editor = { id: 2, collection: 'users', role: 'editor' }
  const admin = { id: 1, collection: 'users', role: 'admin' }

  function makeReq(
    user: Record<string, unknown> | undefined,
    forwardedFor: string,
    hooks: { create?: ReturnType<typeof vi.fn>; count?: ReturnType<typeof vi.fn> } = {},
    url = '/page-absente',
  ) {
    return {
      user,
      method: 'POST',
      headers: new Headers({ 'x-forwarded-for': forwardedFor }),
      url: 'http://localhost/api/seo-plugin/seo-logs',
      json: async () => ({ url }),
      payload: {
        ...multiAuthPayload,
        find: vi.fn(async () => ({ docs: [] })),
        create: hooks.create ?? vi.fn(async () => ({ id: '1' })),
        update: vi.fn(),
        count: hooks.count ?? vi.fn(async () => ({ totalDocs: 0 })),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('refuses a panel editor — the collection ACL refuses them too', async () => {
    const create = vi.fn()
    const res = await createSeoLogsHandler()(makeReq(editor, '203.0.113.1', { create }))
    expect(res.status).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })

  it('refuses a front-office customer outright', async () => {
    const create = vi.fn()
    const res = await createSeoLogsHandler()(makeReq(customer, '203.0.113.2', { create }))
    expect(res.status).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })

  it('still accepts the SEO admin, and a role-less panel user (fail-open setups)', async () => {
    expect((await createSeoLogsHandler()(makeReq(admin, '203.0.113.3'))).status).toBe(200)
    expect((await createSeoLogsHandler()(makeReq(staff, '203.0.113.4'))).status).toBe(200)
  })

  it('keys the POST bucket by user, so varying X-Forwarded-For no longer resets it', async () => {
    const handler = createSeoLogsHandler()
    let last: Response | undefined
    for (let i = 0; i < 31; i++) {
      // Proxy-append shape: the attacker's value stays first, which is what getClientIp reads.
      last = await handler(makeReq(admin, `203.0.113.${i}, 10.0.0.1`, {}, `/absente-${i}`))
    }
    expect(last?.status).toBe(429)
  })

  it('stops creating rows past SEO_LOGS_MAX_ROWS instead of growing forever', async () => {
    process.env.SEO_LOGS_MAX_ROWS = '10'
    const create = vi.fn()
    const count = vi.fn(async () => ({ totalDocs: 10 }))
    const res = await createSeoLogsHandler()(makeReq(admin, '203.0.113.9', { create, count }))
    expect(await res.json()).toEqual({ success: false, action: 'capped' })
    expect(create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SEO-16 — the dashboard CSV exports wrote editor-controlled text verbatim into
// cells an admin later opens in a spreadsheet (CWE-1236).
// ---------------------------------------------------------------------------
describe('SEO-16 — no export builds a CSV cell by hand any more', () => {
  it('every component goes through the shared serializer', () => {
    const offenders = readdirSync(COMPONENTS_DIR)
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .filter((file) => /replace\(\/"\/g, '""'\)/.test(readFileSync(join(COMPONENTS_DIR, file), 'utf8')))
    expect(offenders).toEqual([])
  })
})
