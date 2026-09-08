import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf-8')

/**
 * Payload mounts every one of these components itself, from the import map.
 * The plugin never owns their parent, so the boundary has to live INSIDE the
 * module — a wrapper around an inner component. If a future edit exports the
 * inner component directly, the boundary silently disappears and a single
 * render error takes the admin down again. These tests are that guard.
 */

describe('error boundary — the components Payload mounts from the import map', () => {
  const registered: Array<[string, string]> = [
    ['components/SeoNavLink.tsx', 'SeoNavLink'],
    ['components/SeoAnalyzer.tsx', 'SeoAnalyzerField'],
    ['components/MetaTitleField.tsx', 'MetaTitleField'],
    ['components/MetaDescriptionField.tsx', 'MetaDescriptionField'],
    ['components/MetaImageField.tsx', 'MetaImageField'],
    ['components/OverviewField.tsx', 'OverviewField'],
    ['components/SerpPreview.tsx', 'SerpPreview'],
  ]

  it.each(registered)('%s wraps its implementation', (file, viewName) => {
    const source = read(file)
    expect(source).toContain("withSeoErrorBoundary")
    expect(source).toContain(`viewName: '${viewName}'`)
    // The inner component must not itself be the export Payload sees.
    expect(source).toMatch(/function \w+Inner\b|const \w+Inner\b/)
  })

  it('the sidebar nav link degrades silently rather than showing a panel on every page', () => {
    const source = read('components/SeoNavLink.tsx')
    // It renders on EVERY admin screen: a visible error box there would follow
    // the user everywhere.
    expect(source).toContain('fallback: null')
  })

  it('the field components keep a visible, retryable notice', () => {
    for (const file of [
      'components/MetaTitleField.tsx',
      'components/MetaDescriptionField.tsx',
      'components/OverviewField.tsx',
    ]) {
      expect(read(file)).not.toContain('fallback: null')
    }
  })
})

describe('error boundary — the nine admin views', () => {
  const views = fs
    .readdirSync(path.join(SRC, 'views'))
    .filter((f) => f.endsWith('View.tsx'))

  it('there are nine of them', () => {
    expect(views).toHaveLength(9)
  })

  it.each(views)('%s wraps its client body', (file) => {
    const source = read(path.join('views', file))
    expect(source).toContain('<ViewErrorBoundary')
    expect(source).toContain("from './ErrorBoundaryClient.js'")
  })

  it('the boundary reaches the server views through the client entry, not by import', () => {
    // A class component with state cannot be bundled into the `views` entry:
    // that bundle carries no "use client" banner. It must cross the RSC
    // boundary the same way the view bodies do — through the package's own
    // client export, which tsup keeps external.
    const bridge = read('views/ErrorBoundaryClient.tsx')
    expect(bridge).toContain("'use client'")
    expect(bridge).toContain("@consilioweb/payload-seo-analyzer/client")

    for (const file of fs.readdirSync(path.join(SRC, 'views')).filter((f) => f.endsWith('View.tsx'))) {
      const source = read(path.join('views', file))
      expect(source).not.toContain("from '../components/ErrorBoundary.js'")
    }
  })

  it('the client entry exports what that bridge re-exports', () => {
    const client = read('client.ts')
    expect(client).toContain('LocalizedSeoErrorBoundary')
    expect(client).toContain('SeoErrorBoundary')
  })
})
