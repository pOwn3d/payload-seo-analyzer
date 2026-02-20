/**
 * SEO Redirects collection — auto-created by the plugin.
 * Stores 301/302 redirects managed via the Redirect Manager view.
 * Slug: 'seo-redirects' (default, configurable via redirectsCollection).
 */

import type { CollectionConfig } from 'payload'

export function createSeoRedirectsCollection(slug: string = 'seo-redirects'): CollectionConfig {
  return {
    slug,
    admin: {
      hidden: true,
    },
    access: {
      read: ({ req }) => !!req.user,
      create: ({ req }) => !!req.user,
      update: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
    },
    fields: [
      {
        name: 'from',
        type: 'text',
        required: true,
        label: 'Source URL',
        index: true,
      },
      {
        name: 'to',
        type: 'text',
        required: true,
        label: 'Destination URL',
      },
      {
        name: 'type',
        type: 'select',
        defaultValue: '301',
        options: [
          { label: '301 — Permanent', value: '301' },
          { label: '302 — Temporary', value: '302' },
        ],
      },
    ],
  }
}
