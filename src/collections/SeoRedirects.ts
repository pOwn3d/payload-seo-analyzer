/**
 * SEO Redirects collection — auto-created by the plugin.
 * Stores 301/302 redirects managed via the Redirect Manager view.
 * Slug: 'seo-redirects' (default, configurable via redirectsCollection).
 */

import type { CollectionConfig } from 'payload'
import { validateRedirectDestinationChange, normalizeFromPath } from '../helpers/redirectSafety.js'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'

export function createSeoRedirectsCollection(
  slug: string = 'seo-redirects',
  allowExternalRedirects = false,
): CollectionConfig {
  return {
    slug,
    admin: {
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
        // Defense-in-depth against open redirects (`//evil.com`, `javascript:` …)
        // and, when `allowExternalRedirects` is off, against off-site destinations.
        //
        // The external gate only fires when the destination CHANGES: Payload
        // revalidates the merged document on every write, so refusing it outright
        // would make a row stored before the option existed impossible to edit at
        // all — not even to flip its 301/302 type. See
        // validateRedirectDestinationChange().
        validate: (
          value: unknown,
          options?: { event?: string; operation?: string; previousValue?: unknown },
        ) => {
          if (value == null || value === '') return true
          const res = validateRedirectDestinationChange(value, allowExternalRedirects, options ?? {})
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
