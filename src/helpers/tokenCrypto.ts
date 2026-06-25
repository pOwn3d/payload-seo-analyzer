/**
 * Token-at-rest encryption for OAuth refresh tokens (GSC integration).
 *
 * AES-256-GCM (authenticated encryption) with a random 12-byte IV per encryption.
 * Serialized as `v1:<iv b64>:<authTag b64>:<ciphertext b64>` so the format is versioned
 * and the auth tag is verified on decrypt (tampering → throw).
 *
 * Key resolution (in order):
 *   1. `SEO_GSC_ENCRYPTION_KEY` env — 32 raw bytes as hex(64) or base64(44). RECOMMENDED.
 *   2. Otherwise, derived from the provided `secret` (typically Payload's `secret`) via
 *      scrypt with a fixed namespace salt. Convenient, but rotating Payload's secret then
 *      invalidates stored tokens (the user must reconnect GSC).
 *
 * SECURITY: never log the plaintext token, the derived key, or the encrypted payload.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_NAMESPACE = 'seo-analyzer:gsc:v1'
const FORMAT_VERSION = 'v1'

function deriveKey(secret: string): Buffer {
  const explicit = process.env.SEO_GSC_ENCRYPTION_KEY
  if (explicit) {
    const buf =
      explicit.length === 64
        ? Buffer.from(explicit, 'hex')
        : Buffer.from(explicit, 'base64')
    if (buf.length === 32) return buf
    throw new Error('SEO_GSC_ENCRYPTION_KEY must decode to exactly 32 bytes (hex64 or base64).')
  }
  if (!secret) {
    throw new Error('No encryption secret available (set SEO_GSC_ENCRYPTION_KEY or Payload secret).')
  }
  return scryptSync(secret, KEY_NAMESPACE, 32)
}

export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decryptToken(payload: string, secret: string): string {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error('Invalid encrypted token format.')
  }
  const key = deriveKey(secret)
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const enc = Buffer.from(parts[3], 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

/** True if a string looks like our encrypted payload (does not validate decryptability). */
export function isEncryptedToken(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${FORMAT_VERSION}:`) && value.split(':').length === 4
}

/** Constant-time string comparison (for OAuth state / CSRF checks). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
