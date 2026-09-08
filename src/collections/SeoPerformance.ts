/**
 * SEO Performance collection.
 * Stores Google Search Console performance data imported via CSV or API.
 * Each row represents one URL+query combination for a given date.
 *
 * Usage (in plugin.ts):
 *   config.collections = [
 *     ...(config.collections || []),
 *     createSeoPerformanceCollection(),
 *   ]
 */

import type { CollectionConfig } from 'payload'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'

export function createSeoPerformanceCollection(): CollectionConfig {
  return {
    slug: 'seo-performance',
    admin: {
      custom: { navHidden: true },
    },
    access: {
      // `read` stays open to any admin-panel user (the SEO views surface this
      // data to editors); writes are SEO-admin only. `!!req.user` was not enough:
      // a session on ANOTHER auth collection (front-office customers, members…)
      // satisfies it and could wipe/forge this history through the REST API.
      read: ({ req }) => isSeoPanelUser(req),
      create: ({ req }) => isSeoAdminRequest(req),
      update: ({ req }) => isSeoAdminRequest(req),
      delete: ({ req }) => isSeoAdminRequest(req),
    },
    timestamps: false,
    fields: [
      {
        name: 'url',
        type: 'text',
        required: true,
        index: true,
        admin: {
          description: 'Page URL (relative or absolute)',
        },
      },
      {
        name: 'query',
        type: 'text',
        index: true,
        admin: {
          description: 'Search query that triggered the impression',
        },
      },
      {
        name: 'clicks',
        type: 'number',
        defaultValue: 0,
        admin: {
          description: 'Number of clicks from search results',
        },
      },
      {
        name: 'impressions',
        type: 'number',
        defaultValue: 0,
        admin: {
          description: 'Number of times this URL appeared in search results',
        },
      },
      {
        name: 'ctr',
        type: 'number',
        defaultValue: 0,
        admin: {
          description: 'Click-through rate (0-100)',
        },
      },
      {
        name: 'position',
        type: 'number',
        defaultValue: 0,
        admin: {
          description: 'Average position in search results',
        },
      },
      {
        name: 'date',
        type: 'date',
        required: true,
        index: true,
        admin: {
          description: 'Date of the performance data',
        },
      },
      {
        name: 'source',
        type: 'select',
        defaultValue: 'manual',
        options: [
          { label: 'Import CSV', value: 'csv' },
          { label: 'API', value: 'api' },
          { label: 'Manuel', value: 'manual' },
        ],
        admin: {
          description: 'Data source (csv, api, or manual)',
        },
      },
    ],
  }
}
