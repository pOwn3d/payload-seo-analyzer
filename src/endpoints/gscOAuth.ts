/**
 * Google Search Console (GSC) OAuth2 integration (SEO 2026) — OPT-IN (`features.gscApi`).
 *
 * Flow:
 *   GET  /gsc/status      → connection + configuration status (no secrets)
 *   GET  /gsc/auth        → returns the Google consent URL (admin) with a CSRF state
 *   GET  /gsc/callback    → exchanges the code for tokens, ENCRYPTS + stores the refresh token
 *   GET  /gsc/data        → queries Search Analytics using the stored token (admin)
 *   POST /gsc/disconnect  → clears the stored token (admin)
 *
 * Security:
 *   - Refresh token is encrypted at rest (AES-256-GCM, helpers/tokenCrypto.ts) and stored
 *     in the `seo-gsc-auth` collection whose token field has `read: () => false`.
 *   - CSRF: a random `state` is stored server-side and verified (timing-safe) on callback.
 *   - OAuth client credentials come from env (GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET),
 *     never hardcoded; tokens are never logged or returned to the client.
 *   - All write/data operations require an admin user.
 *
 * Host setup required (cannot be automated): create a Google Cloud OAuth client, enable the
 * Search Console API, and register the redirect URI `<siteUrl>/api<basePath>/gsc/callback`.
 */
import type { PayloadHandler } from 'payload'
import { randomBytes } from 'crypto'
import type { SeoConfig } from '../types.js'
import { encryptToken, safeEqual } from '../helpers/tokenCrypto.js'
import {
  GSC_AUTH_COLLECTION as AUTH_COLLECTION,
  GSC_SCOPES as SCOPES,
  isGscAdmin as isAdmin,
  getGscOAuthConfig as getOAuthConfig,
  getOrCreateGscAuthDoc as getOrCreateAuthDoc,
  gscTokenRequest as tokenRequest,
  getGscAccessToken,
  queryGscSearchAnalytics,
} from '../helpers/gscClient.js'

// ---------------------------------------------------------------------------
// GET /gsc/status
// ---------------------------------------------------------------------------
export function createGscStatusHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const cfg = getOAuthConfig(basePath, seoConfig)
      const doc = await getOrCreateAuthDoc(req.payload)
      return Response.json(
        {
          configured: !!cfg,
          connected: !!doc.refreshTokenEnc,
          connectedEmail: doc.connectedEmail || null,
          connectedAt: doc.connectedAt || null,
          propertyUrl: doc.propertyUrl || cfg?.siteUrl || null,
          redirectUri: cfg?.redirectUri || null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] gsc-status error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// GET /gsc/auth — returns the consent URL (admin)
// ---------------------------------------------------------------------------
export function createGscAuthStartHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const cfg = getOAuthConfig(basePath, seoConfig)
      if (!cfg) {
        return Response.json(
          { error: 'GSC OAuth not configured. Set GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET and siteUrl.' },
          { status: 400 },
        )
      }

      const state = randomBytes(24).toString('hex')
      const doc = await getOrCreateAuthDoc(req.payload)
      await req.payload.update({
        collection: AUTH_COLLECTION,
        id: doc.id,
        data: { pendingState: state },
        overrideAccess: true,
      })

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', cfg.clientId)
      authUrl.searchParams.set('redirect_uri', cfg.redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', state)

      return Response.json({ authUrl: authUrl.toString() }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] gsc-auth error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// GET /gsc/callback — token exchange + encrypted storage
// ---------------------------------------------------------------------------
export function createGscCallbackHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    const htmlPage = (title: string, body: string) =>
      new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;max-width:40rem;margin:auto"><h1>${title}</h1><p>${body}</p><p><a href="/admin/performance">← Back to the SEO dashboard</a></p></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
      )
    try {
      // The callback is hit by a browser redirect; require an authenticated admin session.
      if (!isAdmin(req.user)) {
        return htmlPage('Connection failed', 'You must be signed in as an admin to connect Google Search Console.')
      }
      const cfg = getOAuthConfig(basePath, seoConfig)
      if (!cfg) return htmlPage('Connection failed', 'GSC OAuth is not configured on the server.')

      const url = new URL(req.url as string)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const oauthError = url.searchParams.get('error')
      if (oauthError) return htmlPage('Connection cancelled', `Google returned: ${oauthError}`)
      if (!code || !state) return htmlPage('Connection failed', 'Missing code or state.')

      const doc = await getOrCreateAuthDoc(req.payload)
      if (!doc.pendingState || !safeEqual(state, doc.pendingState as string)) {
        return htmlPage('Connection failed', 'Invalid state (possible CSRF). Please restart the connection.')
      }

      const tokens = await tokenRequest(cfg, {
        code,
        redirect_uri: cfg.redirectUri,
        grant_type: 'authorization_code',
      })
      const refreshToken = tokens.refresh_token as string | undefined
      const accessToken = tokens.access_token as string | undefined
      if (!refreshToken) {
        return htmlPage(
          'Connection failed',
          'Google did not return a refresh token. Revoke the app access in your Google account and try again (the consent screen must show).',
        )
      }

      // Best-effort: fetch the connected account email.
      let email: string | null = null
      if (accessToken) {
        try {
          const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { authorization: `Bearer ${accessToken}` },
          })
          if (ui.ok) email = ((await ui.json()) as Record<string, unknown>).email as string
        } catch {
          // non-fatal
        }
      }

      const secret = (req.payload as unknown as { secret?: string }).secret || ''
      const refreshTokenEnc = encryptToken(refreshToken, secret)

      await req.payload.update({
        collection: AUTH_COLLECTION,
        id: doc.id,
        data: {
          refreshTokenEnc,
          pendingState: null,
          connectedEmail: email,
          connectedAt: new Date().toISOString(),
          scope: (tokens.scope as string) || SCOPES,
          propertyUrl: doc.propertyUrl || cfg.siteUrl,
        },
        overrideAccess: true,
      })

      return htmlPage('Google Search Console connected ✅', 'You can close this tab and return to the SEO dashboard.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] gsc-callback error: ${message}`)
      return htmlPage('Connection failed', 'An unexpected error occurred. Check the server logs.')
    }
  }
}

// ---------------------------------------------------------------------------
// GET /gsc/data — query Search Analytics
// ---------------------------------------------------------------------------
export function createGscDataHandler(basePath: string, seoConfig?: SeoConfig): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const cfg = getOAuthConfig(basePath, seoConfig)
      if (!cfg) return Response.json({ error: 'GSC OAuth not configured.' }, { status: 400 })

      const doc = await getOrCreateAuthDoc(req.payload)
      if (!doc.refreshTokenEnc) {
        return Response.json({ error: 'Not connected to Google Search Console.' }, { status: 409 })
      }

      let accessToken: string
      try {
        accessToken = await getGscAccessToken(req.payload, cfg, doc)
      } catch (e) {
        const code = e instanceof Error ? e.message : 'refresh_failed'
        if (code === 'decrypt_failed') {
          return Response.json(
            { error: 'Stored token could not be decrypted (encryption key changed?). Reconnect GSC.' },
            { status: 409 },
          )
        }
        return Response.json({ error: 'Could not refresh access token.' }, { status: 502 })
      }

      const url = new URL(req.url as string)
      const today = new Date()
      const defaultEnd = today.toISOString().slice(0, 10)
      const defaultStart = new Date(today.getTime() - 28 * 86_400_000).toISOString().slice(0, 10)
      const startDate = url.searchParams.get('startDate') || defaultStart
      const endDate = url.searchParams.get('endDate') || defaultEnd
      const dimension = url.searchParams.get('dimension') === 'page' ? 'page' : 'query'
      const rowLimit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('rowLimit') || '100', 10)))
      const property = (doc.propertyUrl as string) || cfg.siteUrl

      let rows
      try {
        rows = await queryGscSearchAnalytics(accessToken, property, {
          startDate,
          endDate,
          dimensions: [dimension],
          rowLimit,
        })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'GSC query failed' }, { status: 502 })
      }

      return Response.json(
        { property, startDate, endDate, dimension, rows },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] gsc-data error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

// ---------------------------------------------------------------------------
// POST /gsc/disconnect — clear stored token
// ---------------------------------------------------------------------------
export function createGscDisconnectHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!isAdmin(req.user)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const doc = await getOrCreateAuthDoc(req.payload)
      await req.payload.update({
        collection: AUTH_COLLECTION,
        id: doc.id,
        data: { refreshTokenEnc: null, pendingState: null, connectedEmail: null, connectedAt: null, scope: null },
        overrideAccess: true,
      })
      return Response.json({ disconnected: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] gsc-disconnect error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
