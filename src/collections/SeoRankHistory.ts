/**
 * SEO Rank History collection.
 * Stores daily Google Search Console position snapshots per query, so the plugin can show
 * SERP position trends over time and movement alerts ("#4 → #9") — the data GSC itself only
 * keeps for ~16 months and never as a clean per-day series.
 *
 * Populated by the rank-tracking job (`endpoints/rankTracking.ts`), gated behind
 * `features.gscApi` (requires a connected Google Search Console account).
 */

import type { CollectionConfig } from 'payload'

export function createSeoRankHistoryCollection(): CollectionConfig {
  return {
    slug: 'seo-rank-history',
    admin: {
      custom: { navHidden: true },
    },
    access: {
      read: ({ req }) => !!req.user,
      create: ({ req }) => req.user?.role === 'admin',
      update: ({ req }) => req.user?.role === 'admin',
      delete: ({ req }) => req.user?.role === 'admin',
    },
    timestamps: false,
    fields: [
      {
        name: 'query',
        type: 'text',
        required: true,
        index: true,
        admin: { description: 'Search query (keyword) tracked' },
      },
      {
        name: 'page',
        type: 'text',
        admin: { description: 'Landing page URL (when tracked by page)' },
      },
      {
        name: 'position',
        type: 'number',
        required: true,
        admin: { description: 'Average SERP position over the snapshot window (lower is better)' },
      },
      {
        name: 'clicks',
        type: 'number',
        admin: { description: 'Clicks over the snapshot window' },
      },
      {
        name: 'impressions',
        type: 'number',
        admin: { description: 'Impressions over the snapshot window' },
      },
      {
        name: 'ctr',
        type: 'number',
        admin: { description: 'Click-through rate (0-1) over the snapshot window' },
      },
      {
        name: 'property',
        type: 'text',
        admin: { description: 'GSC property the snapshot was taken from' },
      },
      {
        // YYYY-MM-DD — used to deduplicate one snapshot per query per day.
        name: 'dateKey',
        type: 'text',
        required: true,
        index: true,
        admin: { description: 'Snapshot day (YYYY-MM-DD), one snapshot per query per day' },
      },
      {
        name: 'snapshotDate',
        type: 'date',
        required: true,
        index: true,
        admin: { description: 'Exact timestamp of the snapshot' },
      },
    ],
  }
}
