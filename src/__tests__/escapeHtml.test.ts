import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escapeHtml } from '../helpers/escapeHtml.js'
import { deliverAlertDigest, type AlertConfig, type AlertDigest } from '../endpoints/alerts.js'
import { createGscCallbackHandler } from '../endpoints/gscOAuth.js'

describe('escapeHtml', () => {
  it('neutralises tag delimiters, quotes and ampersands', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    )
  })

  it('escapes & first so entities are not double-escaped', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;')
  })
})

// Reflected XSS regression: /gsc/callback is the only text/html response of the
// plugin and used to interpolate Google's `error` query param raw, executing
// with the victim admin's session.
describe('GSC OAuth callback page', () => {
  // The handler short-circuits before reflecting anything when OAuth is not
  // configured, so the guard has to be satisfied to reach the reflected branch.
  beforeEach(() => {
    process.env.GSC_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GSC_OAUTH_CLIENT_SECRET = 'test-client-secret'
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://site.example'
  })
  afterEach(() => {
    delete process.env.GSC_OAUTH_CLIENT_ID
    delete process.env.GSC_OAUTH_CLIENT_SECRET
    delete process.env.NEXT_PUBLIC_SERVER_URL
  })

  function makeReq(url: string) {
    return {
      user: { id: 1 },
      url,
      payload: { logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('escapes the OAuth error reflected from Google', async () => {
    const payload = '<script>alert(document.cookie)</script>'
    const res = await createGscCallbackHandler('/api/seo-plugin')(
      makeReq(`http://localhost/api/seo-plugin/gsc/callback?error=${encodeURIComponent(payload)}`),
    )
    const html = await res.text()

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('forbids script execution on that page via CSP', async () => {
    const res = await createGscCallbackHandler('/api/seo-plugin')(
      makeReq('http://localhost/api/seo-plugin/gsc/callback?error=access_denied'),
    )
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

// HTML-injection regression in the digest email: 404 paths are logged from
// anonymous visitors, so a crafted URL could smuggle a phishing link into a
// mail sent by the CMS to its administrators.
describe('alert digest email', () => {
  const cfg: AlertConfig = {
    webhookUrl: '',
    emails: ['admin@example.com'],
    scoreDrop: 10,
    positionDrop: 5,
    windowHours: 24,
  }

  it('escapes untrusted 404 URLs, queries and document ids', async () => {
    const digest: AlertDigest = {
      since: new Date('2026-01-01').toISOString(),
      generatedAt: new Date('2026-01-02').toISOString(),
      scoreRegressions: [
        { collection: '<i>pages</i>', documentId: '1"><b>x', from: 90, to: 40, drop: 50 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      newNotFound: [
        { url: '</code><a href="https://evil.example">click me</a>', count: 3 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      rankDrops: [
        { query: '<img src=x onerror=alert(1)>', from: 3, to: 20, drop: 17 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      totalIssues: 3,
    }

    let html = ''
    const payload = {
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      sendEmail: async (opts: { html: string }) => {
        html = opts.html
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const result = await deliverAlertDigest(payload, digest, cfg, 'https://site.example')

    expect(result.channels.email).toBe(true)
    expect(html).not.toContain('<a href="https://evil.example">')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<i>pages</i>')
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;')
  })
})
