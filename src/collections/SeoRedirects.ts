/**
 * SEO Redirects collection — auto-created by the plugin.
 * Stores 301/302 redirects managed via the Redirect Manager view.
 * Slug: 'seo-redirects' (default, configurable via redirectsCollection).
 */

import type { CollectionConfig } from 'payload'
import { validateRedirectTarget, normalizeFromPath } from '../helpers/redirectSafety.js'

export function createSeoRedirectsCollection(slug: string = 'seo-redirects'): CollectionConfig {
  return {
    slug,
    admin: {
      custom: { navHidden: true },
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
        // Defense-in-depth: reject absolute / protocol-relative sources even on
        // direct admin-UI edits (which bypass the redirect endpoints).
        validate: (value: unknown) => {
          if (value == null || value === '') return true
          return normalizeFromPath(value) ? true : 'Invalid source path (no absolute or protocol-relative URLs)'
        },
      },
      {
        name: 'to',
        type: 'text',
        required: true,
        label: 'Destination URL',
        // Defense-in-depth against open redirects (`//evil.com`, `javascript:` …).
        validate: (value: unknown) => {
          if (value == null || value === '') return true
          const res = validateRedirectTarget(value)
          return res.valid ? true : (res.reason || 'Invalid destination URL')
        },
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
