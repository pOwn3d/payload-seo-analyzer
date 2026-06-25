import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'
import sharp from 'sharp'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3456'

/**
 * Payload config for the browser-driven admin e2e harness.
 *
 * Mirrors the integration harness (`../payload.config.mjs`) but is wired into a
 * real Next.js app so the plugin's **admin views** actually mount in a browser.
 * Every view-backed feature is left enabled so all nine admin views register:
 * seo, performance, link-graph, sitemap-audit, schema-builder, cannibalization,
 * keyword-research, redirects, seo-config.
 */
export default buildConfig({
  serverURL,
  secret: process.env.PAYLOAD_SECRET || 'e2e-ui-secret-please-ignore',
  admin: {
    user: 'users',
  },
  editor: lexicalEditor(),
  db: sqliteAdapter({
    // Mirrors the integration harness: relative `file:` URL resolved against the
    // app cwd (e2e/ui/). Overridable via DATABASE_URI.
    client: { url: process.env.DATABASE_URI || 'file:./e2e-ui.db' },
    // SQLITE_BUSY guard — the dev server and any seed run share one file.
    busyTimeout: 10000,
  }),
  collections: [
    { slug: 'users', auth: true, admin: { useAsTitle: 'email' }, fields: [] },
    {
      slug: 'pages',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'slug', type: 'text' },
      ],
    },
    {
      slug: 'posts',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'slug', type: 'text' },
        { name: 'content', type: 'richText' },
      ],
    },
    { slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }] },
  ],
  plugins: [
    seoAnalyzerPlugin({
      collections: ['pages', 'posts'],
      siteName: 'E2E UI Harness',
      siteUrl: serverURL,
    }),
  ],
  sharp,
  typescript: { outputFile: false },
})
