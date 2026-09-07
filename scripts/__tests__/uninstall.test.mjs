import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PACKAGE_NAME, extractImportedNames, processFile } from '../uninstall.mjs'

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
