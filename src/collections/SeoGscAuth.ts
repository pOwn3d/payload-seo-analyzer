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

export function createSeoGscAuthCollection(): CollectionConfig {
  return {
    slug: 'seo-gsc-auth',
    admin: {
      hidden: true,
      custom: { navHidden: true },
    },
    access: {
      read: ({ req }) => !!req.user,
      update: ({ req }) => !!req.user,
      create: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
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
