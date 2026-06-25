import { describe, it, expect } from 'vitest'
import { validateRedirectTarget, normalizeFromPath } from '../helpers/redirectSafety.js'

describe('validateRedirectTarget — open redirect protection', () => {
  it('accepts a same-site relative path', () => {
    const r = validateRedirectTarget('/blog/post')
    expect(r.valid).toBe(true)
    expect(r.normalized).toBe('/blog/post')
    expect(r.external).toBe(false)
  })

  it('prefixes a bare path with a single slash', () => {
    const r = validateRedirectTarget('blog/post')
    expect(r.valid).toBe(true)
    expect(r.normalized).toBe('/blog/post')
  })

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(validateRedirectTarget('//evil.com').valid).toBe(false)
    expect(validateRedirectTarget('  //evil.com  ').valid).toBe(false)
  })

  it('rejects backslash tricks (/\\evil.com)', () => {
    expect(validateRedirectTarget('/\\evil.com').valid).toBe(false)
    expect(validateRedirectTarget('\\evil.com').valid).toBe(false)
  })

  it('rejects dangerous schemes', () => {
    expect(validateRedirectTarget('javascript:alert(1)').valid).toBe(false)
    expect(validateRedirectTarget('data:text/html,<script>').valid).toBe(false)
    expect(validateRedirectTarget('vbscript:msgbox').valid).toBe(false)
    expect(validateRedirectTarget('file:///etc/passwd').valid).toBe(false)
  })

  it('rejects embedded control chars / CRLF', () => {
    expect(validateRedirectTarget('/foo\r\nLocation: //evil.com').valid).toBe(false)
    expect(validateRedirectTarget('/\tevil').valid).toBe(false)
  })

  it('allows explicit external http(s) URLs but flags them external', () => {
    const r = validateRedirectTarget('https://example.com/new')
    expect(r.valid).toBe(true)
    expect(r.external).toBe(true)
  })

  it('rejects non-string / empty input', () => {
    expect(validateRedirectTarget(null).valid).toBe(false)
    expect(validateRedirectTarget('').valid).toBe(false)
    expect(validateRedirectTarget('   ').valid).toBe(false)
  })
})

describe('normalizeFromPath — clean same-site source', () => {
  it('normalizes a bare path', () => {
    expect(normalizeFromPath('old-slug')).toBe('/old-slug')
    expect(normalizeFromPath('/old-slug')).toBe('/old-slug')
  })

  it('rejects absolute and protocol-relative sources', () => {
    expect(normalizeFromPath('https://evil.com')).toBeNull()
    expect(normalizeFromPath('//evil.com')).toBeNull()
    expect(normalizeFromPath('\\evil')).toBeNull()
  })

  it('rejects empty / non-string', () => {
    expect(normalizeFromPath('')).toBeNull()
    expect(normalizeFromPath(undefined)).toBeNull()
  })
})
