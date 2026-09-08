import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PACKAGE_NAME, extractImportedNames, processFile, leftoverNotice } from '../uninstall.mjs'

// Regression guard: PACKAGE_NAME used to be hardcoded to `@consilioweb/seo-analyzer`
// while the package ships as `@consilioweb/payload-seo-analyzer`. Nothing matched,
// nothing was removed, and the script still announced "Uninstall complete".
describe('uninstall script — package identity', () => {
  it('reads its own published name from package.json', () => {
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
    )
    expect(PACKAGE_NAME).toBe(pkg.name)
    expect(PACKAGE_NAME).toBe('@consilioweb/payload-seo-analyzer')
  })
})

describe('uninstall script — import detection', () => {
  it('extracts names from a real import of this package', () => {
    const source = `import { seoAnalyzerPlugin, seoFields } from '${PACKAGE_NAME}'\n`
    expect(extractImportedNames(source)).toEqual(['seoAnalyzerPlugin', 'seoFields'])
  })

  it('extracts names from a subpath import', () => {
    const source = `import { SeoView } from '${PACKAGE_NAME}/views'\n`
    expect(extractImportedNames(source)).toEqual(['SeoView'])
  })

  it('honours `as` renaming', () => {
    const source = `import { seoAnalyzerPlugin as seo } from '${PACKAGE_NAME}'\n`
    expect(extractImportedNames(source)).toEqual(['seo'])
  })

  it('ignores imports from another package', () => {
    const source = `import { somethingElse } from '@consilioweb/payload-support'\n`
    expect(extractImportedNames(source)).toEqual([])
  })
})

describe('uninstall script — source cleanup', () => {
  it('removes the import and the plugin call from a payload config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-uninstall-'))
    const file = path.join(dir, 'payload.config.ts')
    fs.writeFileSync(
      file,
      [
        `import { buildConfig } from 'payload'`,
        `import { seoAnalyzerPlugin } from '${PACKAGE_NAME}'`,
        ``,
        `export default buildConfig({`,
        `  plugins: [`,
        `    seoAnalyzerPlugin({ targetCollections: ['pages'] }),`,
        `  ],`,
        `})`,
        ``,
      ].join('\n'),
      'utf-8',
    )

    const cleaned = processFile(file)
    expect(cleaned).not.toBeNull()
    expect(cleaned).not.toContain(PACKAGE_NAME)
    expect(cleaned).not.toContain('seoAnalyzerPlugin')
    expect(cleaned).toContain(`import { buildConfig } from 'payload'`)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('leaves a file that does not reference the package untouched', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-uninstall-'))
    const file = path.join(dir, 'other.ts')
    fs.writeFileSync(file, `export const x = 1\n`, 'utf-8')
    expect(processFile(file)).toBeNull()
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

// The uninstall script removes the package but never touches the database. What
// it PRINTS is therefore the only warning a user gets about what survives —
// including a live Google OAuth refresh token.
describe('uninstall script — what it leaves behind', () => {
  it('names the seven plugin collections', () => {
    const text = leftoverNotice().join('\n')
    for (const slug of [
      'seo-gsc-auth',
      'seo-settings',
      'seo-redirects',
      'seo-score-history',
      'seo-performance',
      'seo-logs',
      'seo-rank-history',
    ]) {
      expect(text).toContain(slug)
    }
  })

  it('puts seo-gsc-auth FIRST and calls its content a credential', () => {
    const lines = leftoverNotice()
    const slugLine = (slug) => lines.findIndex((l) => l.includes(slug))
    // It holds an encrypted refresh token: it must not be the last one dropped.
    expect(slugLine('seo-gsc-auth')).toBeLessThan(slugLine('seo-settings'))
    expect(slugLine('seo-gsc-auth')).toBeLessThan(slugLine('seo-logs'))

    const text = lines.join('\n')
    expect(text).toMatch(/OAUTH/i)
    expect(text).toMatch(/REFRESH TOKEN/i)
    // Dropping the table does not revoke the grant — say where to do that.
    expect(text).toContain('myaccount.google.com/permissions')
  })

  it('warns about the fields injected into the HOST collections, meta included', () => {
    const text = leftoverNotice().join('\n')
    expect(text).toContain('isCornerstone')
    expect(text).toContain('focusKeyword')
    expect(text).toContain('focusKeywords')
    expect(text).toContain('meta.title')
    expect(text).toContain('meta.description')
    // meta may belong to @payloadcms/plugin-seo, and it is editorial content
    // either way: dropping it deletes what editors wrote.
    expect(text).toContain('@payloadcms/plugin-seo')
    expect(text).toMatch(/EDITORIAL CONTENT/i)
  })

  it('says removing those fields is a schema change, and how to apply it', () => {
    const text = leftoverNotice().join('\n')
    expect(text).toContain('payload migrate:create')
    expect(text).toContain('payload migrate')
    expect(text).toMatch(/Never `push`/)
  })

  it('mentions that seo-logs holds visitor referrer / user-agent, and no IP', () => {
    const text = leftoverNotice().join('\n')
    expect(text).toMatch(/referrer/i)
    expect(text).toMatch(/user-agent/i)
    expect(text).toMatch(/no IP/i)
  })

  it('returns plain lines with no ANSI escapes, so the wording stays greppable', () => {
    for (const line of leftoverNotice()) {
      expect(typeof line).toBe('string')
      // eslint-disable-next-line no-control-regex
      expect(line).not.toMatch(/\x1b\[/)
    }
  })
})
