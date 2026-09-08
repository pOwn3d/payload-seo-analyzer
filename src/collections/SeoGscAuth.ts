/**
 * SEO GSC Auth — stores the (encrypted) Google Search Console OAuth refresh token.
 *
 * Singleton-style collection (one row). The refresh token blob is encrypted at rest
 * (AES-256-GCM, see helpers/tokenCrypto.ts) AND has field-level `read: () => false`, so
 * it is NEVER returned through the Payload API — only read server-side with overrideAccess.
 *
 * Only created when `features.gscApi` is enabled (opt-in).
 */
import type { CollectionConfig } from 'payload'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'

export function createSeoGscAuthCollection(): CollectionConfig {
  return {
    slug: 'seo-gsc-auth',
    admin: {
      hidden: true,
      custom: { navHidden: true },
    },
    // `read` stays open to any authenticated user: the admin views and the
    // plugin endpoints both surface this data to editors. Writes are restricted
    // to SEO admins, mirroring the gate the endpoints already enforce
    // (`isSeoAdmin` in settings.ts / redirects.ts). Without this, an editor
    // could bypass those endpoints through the REST collection API — writing
    // `robotsCustomRules`, neutralising `disabledRules`, creating a redirect or
    // overwriting the OAuth CSRF state.
    access: {
      read: ({ req }) => isSeoPanelUser(req),
      create: ({ req }) => isSeoAdminRequest(req),
      update: ({ req }) => isSeoAdminRequest(req),
      delete: ({ req }) => isSeoAdminRequest(req),
    },
    fields: [
      {
        name: 'refreshTokenEnc',
        type: 'text',
        // The encrypted refresh-token blob must never leave the server.
        access: {
          read: () => false,
          create: () => false,
          update: () => false,
        },
        admin: { hidden: true },
      },
      {
        name: 'pendingState',
        type: 'text',
        // CSRF state for the in-flight OAuth handshake — also server-only.
        access: {
          read: () => false,
          create: () => false,
          update: () => false,
        },
        admin: { hidden: true },
      },
      { name: 'connectedEmail', type: 'text', admin: { readOnly: true } },
      { name: 'connectedAt', type: 'date', admin: { readOnly: true } },
      {
        name: 'propertyUrl',
        type: 'text',
        admin: { description: 'GSC property (e.g. sc-domain:example.com or https://example.com/)' },
      },
      { name: 'scope', type: 'text', admin: { readOnly: true } },
    ],
  }
}
