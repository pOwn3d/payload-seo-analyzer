/**
 * SEO Logs collection — tracks 404 errors from visitors.
 * When a visitor hits a non-existent page, the middleware logs it here.
 * Admins can then create 301 redirects from the most frequent 404s.
 */

import type { CollectionConfig } from 'payload'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'

export function createSeoLogsCollection(): CollectionConfig {
  return {
    slug: 'seo-logs',
    labels: {
      singular: 'Log SEO',
      plural: 'Logs SEO',
    },
    admin: {
      custom: { navHidden: true },
      group: 'SEO',
    },
    access: {
      // `read` stays open to any admin-panel user (the SEO views surface 404 logs
      // to editors); writes are SEO-admin only. `!!req.user` was not enough: a
      // session on ANOTHER auth collection (front-office customers, members…)
      // satisfies it, and these rows carry visitor referrers / user-agents.
      // Middleware-driven inserts go through the seoLogs endpoint, which writes
      // with overrideAccess: true — they are unaffected by this gate.
      read: ({ req }) => isSeoPanelUser(req),
      create: ({ req }) => isSeoAdminRequest(req),
      update: ({ req }) => isSeoAdminRequest(req),
      delete: ({ req }) => isSeoAdminRequest(req),
    },
    fields: [
      {
        name: 'url',
        type: 'text',
        required: true,
        index: true,
      },
      {
        name: 'type',
        type: 'select',
        defaultValue: '404',
        options: [
          { label: '404 Not Found', value: '404' },
          { label: 'Redirect', value: 'redirect' },
          { label: 'Error', value: 'error' },
        ],
      },
      {
        name: 'count',
        type: 'number',
        defaultValue: 1,
      },
      {
        name: 'lastSeen',
        type: 'date',
      },
      {
        name: 'referrer',
        type: 'text',
      },
      {
        name: 'userAgent',
        type: 'text',
      },
      {
        name: 'ignored',
        type: 'checkbox',
        defaultValue: false,
      },
    ],
    timestamps: true,
  }
}
