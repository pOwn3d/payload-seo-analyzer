/**
 * Google Search Console — shared low-level client primitives.
 *
 * Single source of truth for the GSC OAuth config, token refresh (from the encrypted refresh
 * token at rest) and Search Analytics queries. Used by both the OAuth HTTP handlers
 * (`endpoints/gscOAuth.ts`) and the rank-tracking job (`endpoints/rankTracking.ts`) so the
 * security-sensitive token handling lives in exactly one place.
 */
import type { Payload } from 'payload'
import type { SeoConfig } from '../types.js'
import { decryptToken } from './tokenCrypto.js'
import { isSeoAdmin } from './isAdmin.js'

export const GSC_AUTH_COLLECTION = 'seo-gsc-auth'
export const GSC_SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly openid email'

/** Admin gate for GSC endpoints — delegates to the shared SEO admin gate. */
export const isGscAdmin = isSeoAdmin

export function resolveGscSiteUrl(seoConfig?: SeoConfig): string | undefined {
  return (
    seoConfig?.siteUrl ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    undefined
  )?.replace(/\/$/, '')
}

export interface GscOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  siteUrl: string
}

export function getGscOAuthConfig(basePath: string, seoConfig?: SeoConfig): GscOAuthConfig | null {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID || ''
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET || ''
  const siteUrl = resolveGscSiteUrl(seoConfig)
  if (!clientId || !clientSecret || !siteUrl) return null
  return { clientId, clientSecret, siteUrl, redirectUri: `${siteUrl}/api${basePath}/gsc/callback` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrCreateGscAuthDoc(payload: Payload): Promise<any> {
  const found = await payload.find({ collection: GSC_AUTH_COLLECTION, limit: 1, overrideAccess: true })
  if (found.docs.length > 0) return found.docs[0]
  return payload.create({ collection: GSC_AUTH_COLLECTION, data: {}, overrideAccess: true })
}

/** Exchange an authorization code or refresh token for a fresh access token. */
export async function gscTokenRequest(
  cfg: GscOAuthConfig,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...body,
    }).toString(),
  })
  const json = (await resp.json()) as Record<string, unknown>
  if (!resp.ok) {
    throw new Error(`Token endpoint error: ${resp.status} ${(json.error as string) || ''}`)
  }
  return json
}

/**
 * Refresh and return a usable access token from the stored encrypted refresh token.
 * Throws a coded Error ('not_connected' | 'decrypt_failed' | 'refresh_failed') on problems.
 */
export async function getGscAccessToken(
  payload: Payload,
  cfg: GscOAuthConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authDoc: any,
): Promise<string> {
  if (!authDoc?.refreshTokenEnc) throw new Error('not_connected')
  const secret = (payload as unknown as { secret?: string }).secret || ''
  let refreshToken: string
  try {
    refreshToken = decryptToken(authDoc.refreshTokenEnc as string, secret)
  } catch {
    throw new Error('decrypt_failed')
  }
  const tokens = await gscTokenRequest(cfg, { refresh_token: refreshToken, grant_type: 'refresh_token' })
  const accessToken = tokens.access_token as string | undefined
  if (!accessToken) throw new Error('refresh_failed')
  return accessToken
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/** Query the Search Analytics API. Throws on a non-OK response. */
export async function queryGscSearchAnalytics(
  accessToken: string,
  property: string,
  body: { startDate: string; endDate: string; dimensions: string[]; rowLimit?: number },
): Promise<GscRow[]> {
  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const json = (await resp.json()) as Record<string, unknown>
  if (!resp.ok) {
    const err = (json.error as Record<string, unknown>)?.message || resp.status
    throw new Error(`GSC query failed: ${err}`)
  }
  return (json.rows as GscRow[]) || []
}
