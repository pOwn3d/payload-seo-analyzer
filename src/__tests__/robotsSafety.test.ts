import { describe, it, expect } from 'vitest'
import { sanitizeRobotsRules } from '../helpers/robotsSafety.js'

describe('sanitizeRobotsRules', () => {
  it('keeps valid directive lines and comments', () => {
    const input = 'User-agent: Googlebot\nDisallow: /private\n# a comment\nAllow: /public'
    expect(sanitizeRobotsRules(input)).toBe(
      'User-agent: Googlebot\nDisallow: /private\n# a comment\nAllow: /public',
    )
  })

  it('drops non-directive / injected garbage lines', () => {
    const input = 'Disallow: /admin\n<script>alert(1)</script>\nrandom text without colon\nEvil-Directive: boom'
    expect(sanitizeRobotsRules(input)).toBe('Disallow: /admin')
  })

  it('strips control chars / CRLF injection', () => {
    const input = 'Disallow: /a\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200'
    // Only the valid first directive survives; the injected HTTP line has no allowed directive.
    expect(sanitizeRobotsRules(input)).toBe('Disallow: /a')
  })

  it('handles non-string / empty input', () => {
    expect(sanitizeRobotsRules(undefined)).toBe('')
    expect(sanitizeRobotsRules('')).toBe('')
    expect(sanitizeRobotsRules(42)).toBe('')
  })

  it('is case-insensitive on directive names', () => {
    expect(sanitizeRobotsRules('disallow: /x\nSITEMAP: https://x/sitemap.xml')).toBe(
      'disallow: /x\nSITEMAP: https://x/sitemap.xml',
    )
  })
})
