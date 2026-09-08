#!/usr/bin/env node
/**
 * Every relative import in `dist/` must resolve to a file that is actually there.
 *
 * This catches one specific, silent failure mode of a multi-pass tsup build.
 * The `bundle: false` pass preserves the source tree and rewrites nothing, so a
 * relative import survives into the emitted file. If the target module is not
 * itself in that pass's `entry` list, it is never emitted as a standalone file —
 * it only exists inlined inside the bundled `dist/index.js`. The import then
 * points at nothing.
 *
 * Nothing in the normal toolchain sees it. `tsc` type-checks the SOURCE tree,
 * where the module exists. Vitest imports from `src/`, same thing. The build
 * itself succeeds — tsup has no reason to object. The failure surfaces only when
 * the HOST application's bundler resolves the published package, which is to say
 * after publication, in someone else's build.
 *
 * `import type` is invisible here on purpose: TypeScript erases it, so it leaves
 * no trace in the emitted file and cannot break anything. Only value imports do.
 * That is why the defect hid for two releases in this package — every other
 * importer of the same module used `import type`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')

if (!existsSync(DIST)) {
  console.error('verify-dist-imports: dist/ is missing — run the build first.')
  process.exit(1)
}

/** Every emitted JavaScript file, at any depth. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.(js|cjs|mjs)$/.test(entry.name) ? [path] : []
  })
}

/**
 * Relative specifiers only. Bare specifiers are the consumer's dependency
 * problem, not ours, and `node:` builtins always resolve.
 */
const SPECIFIER =
  /(?:^|[\s;{(])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]|require\(\s*['"](\.[^'"]+)['"]\s*\)|import\(\s*['"](\.[^'"]+)['"]\s*\)/g

/** Resolve the way Node and a bundler would: as written, then the usual suffixes. */
function resolves(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.js`, `${base}.cjs`, `${base}.mjs`,
    join(base, 'index.js'), join(base, 'index.cjs'), join(base, 'index.mjs'),
  ]
  return candidates.some((c) => existsSync(c) && statSync(c).isFile())
}

const broken = []
for (const file of walk(DIST)) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(SPECIFIER)) {
    const specifier = match[1] || match[2] || match[3]
    if (!specifier || resolves(file, specifier)) continue
    broken.push({ file: file.replace(`${process.cwd()}/`, ''), specifier })
  }
}

if (broken.length === 0) {
  console.log('verify-dist-imports: every relative import in dist/ resolves.')
  process.exit(0)
}

console.error(`verify-dist-imports: ${broken.length} unresolved relative import(s) in dist/.\n`)
for (const { file, specifier } of broken) {
  console.error(`  ${file}\n    imports '${specifier}' — not emitted`)
}
console.error(
  '\nThe target is almost certainly missing from the `entry` list of the\n' +
    '`bundle: false` pass in tsup.config.ts. Add it there, or move the value\n' +
    'being imported into a module that pass already emits.',
)
process.exit(1)
