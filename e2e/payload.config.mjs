import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'

export default buildConfig({
  secret: 'e2e-secret-please-ignore',
  editor: lexicalEditor(),
  db: sqliteAdapter({ client: { url: 'file:./e2e.db' } }),
  collections: [
    { slug: 'users', auth: true, fields: [] },
    { slug: 'pages', fields: [{ name: 'title', type: 'text' }, { name: 'slug', type: 'text' }] },
    { slug: 'posts', fields: [{ name: 'title', type: 'text' }, { name: 'slug', type: 'text' }, { name: 'content', type: 'richText' }] },
    { slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }] },
  ],
  plugins: [seoAnalyzerPlugin({ collections: ['pages', 'posts'] })],
  typescript: { outputFile: false },
})
