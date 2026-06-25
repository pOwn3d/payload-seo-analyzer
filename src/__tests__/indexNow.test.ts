import { describe, it, expect } from 'vitest'
import { docToUrl, submitToIndexNow } from '../endpoints/indexNow.js'

describe('indexNow — docToUrl', () => {
  it('maps a slug to a full URL', () => {
    expect(docToUrl('a-propos', 'https://example.com')).toBe('https://example.com/a-propos')
  })
  it('maps home/empty to the site root', () => {
    expect(docToUrl('home', 'https://example.com')).toBe('https://example.com')
    expect(docToUrl('', 'https://example.com')).toBe('https://example.com')
  })
  it('handles a trailing slash on siteUrl', () => {
    expect(docToUrl('x', 'https://example.com/')).toBe('https://example.com/x')
  })
})

describe('indexNow — submitToIndexNow guards', () => {
  it('no-ops without a key or urls (no network)', async () => {
    expect(await submitToIndexNow('https://example.com', '', 'k', ['u'])).toEqual({ ok: false, reason: 'no_key_or_urls' })
    expect(await submitToIndexNow('https://example.com', 'key', 'k', [])).toEqual({ ok: false, reason: 'no_key_or_urls' })
  })
  it('rejects a bad site URL', async () => {
    const r = await submitToIndexNow('not a url', 'key', 'k', ['u'])
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('bad_site_url')
  })
})
