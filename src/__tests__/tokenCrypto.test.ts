import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken, isEncryptedToken, safeEqual } from '../helpers/tokenCrypto'

const SECRET = 'test-secret-please-ignore-0123456789abcdef'

describe('tokenCrypto (GSC refresh-token at rest)', () => {
  it('round-trips a token and never stores it in plaintext', () => {
    const enc = encryptToken('refresh-abc-123', SECRET)
    expect(enc).not.toContain('refresh-abc-123')
    expect(isEncryptedToken(enc)).toBe(true)
    expect(decryptToken(enc, SECRET)).toBe('refresh-abc-123')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptToken('x', SECRET)).not.toBe(encryptToken('x', SECRET))
  })

  it('fails to decrypt with the wrong secret', () => {
    const enc = encryptToken('secret-token', SECRET)
    expect(() => decryptToken(enc, 'a-completely-different-secret')).toThrow()
  })

  it('detects tampering via the GCM auth tag', () => {
    const enc = encryptToken('secret-token', SECRET)
    const parts = enc.split(':')
    const swapped = parts[3][0] === 'A' ? 'B' : 'A'
    const tampered = [parts[0], parts[1], parts[2], swapped + parts[3].slice(1)].join(':')
    expect(() => decryptToken(tampered, SECRET)).toThrow()
  })

  it('rejects a malformed payload', () => {
    expect(() => decryptToken('not-a-valid-payload', SECRET)).toThrow()
    expect(isEncryptedToken('nope')).toBe(false)
  })

  it('safeEqual is correct for equal, different, and different-length inputs', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})
