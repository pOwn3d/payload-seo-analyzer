/**
 * SEO Logs collection — tracks 404 errors from visitors.
 * When a visitor hits a non-existent page, the middleware logs it here.
 * Admins can then create 301 redirects from the most frequent 404s.
 */

import type { CollectionConfig } from 'payload'

export function createSeoLogsCollection(): CollectionConfig {
  return {
    slug: 'seo-logs',
    labels: {
      singular: 'Log SEO',
      plural: 'Logs SEO',
    },
    admin: {
      hidden: true,
      group: 'SEO',
    },
    access: {
      read: ({ req }) => !!req.user,
      // Require authentication for creating log entries.
      // Use overrideAccess: true in the seoLogs endpoint handler for middleware-driven inserts.
      create: ({ req }) => !!req.user,
      update: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
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
          { label: '500 Server Error', value: '500' },
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
