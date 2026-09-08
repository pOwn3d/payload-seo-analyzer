#!/usr/bin/env node

// Cleanup script for this package.
// Removes all imports and plugin calls from source files before uninstalling it.
// Usage: npx seo-analyzer-uninstall

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SELF_PATH = fileURLToPath(import.meta.url)

/**
 * The package name is read from our own package.json rather than hardcoded.
 * It used to be hardcoded as `@consilioweb/seo-analyzer` while the package is
 * actually published as `@consilioweb/payload-seo-analyzer`: no import matched,
 * the removal command removed nothing, and the script still printed
 * "Uninstall complete". A hardcoded name cannot drift here.
 */
function readPackageName() {
  const pkgPath = path.join(path.dirname(SELF_PATH), '..', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  if (!pkg.name) throw new Error(`No "name" field in ${pkgPath}`)
  return pkg.name
}

export const PACKAGE_NAME = readPackageName()

/** Escape a string so it can be embedded literally in a RegExp. */
function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PKG_RE_SOURCE = escapeRe(PACKAGE_NAME)

// Regex to match any import line from this package (value + type imports)
const IMPORT_RE = new RegExp(
  `^\\s*import\\s+(?:type\\s+)?(?:\\{[^}]*\\}|[\\w]+)\\s+from\\s+['"]${PKG_RE_SOURCE}(?:\\/[^'"]*)?['"]\\s*;?\\s*$`,
  'gm',
)

/**
 * Extract imported names from a file that come from this package.
 * Returns the list of identifiers (after "as" renaming if any).
 * e.g. `import { seoPlugin as myPlugin, seoFields } from '...'` → ['myPlugin', 'seoFields']
 */
export function extractImportedNames(content) {
  const names = []
  const re = new RegExp(
    `^\\s*import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"]${PKG_RE_SOURCE}(?:\\/[^'"]*)?['"]\\s*;?\\s*$`,
    'gm',
  )
  let match
  while ((match = re.exec(content)) !== null) {
    const specifiers = match[1]
    for (const spec of specifiers.split(',')) {
      const trimmed = spec.trim()
      if (!trimmed) continue
      // Handle `foo as bar` → use bar (local name)
      const asParts = trimmed.split(/\s+as\s+/)
      names.push(asParts.length > 1 ? asParts[1].trim() : trimmed)
    }
  }
  return names
}

/**
 * Recursively find all .ts and .tsx files in a directory
 */
function findSourceFiles(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      results.push(...findSourceFiles(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Remove a plugin call like `seoAnalyzerPlugin({ ... })` from a plugins array.
 * Only removes calls for function names that were actually imported from our package.
 * Handles nested braces/parens across multiple lines.
 */
function removePluginCalls(content, callNames) {
  let modified = content

  for (const fnName of callNames) {
    let searchFrom = 0
    while (true) {
      const callIndex = modified.indexOf(`${fnName}(`, searchFrom)
      if (callIndex === -1) break

      // Verify this is actually our function call (not something like "mySeoAnalyzerPlugin")
      if (callIndex > 0 && /[\w$]/.test(modified[callIndex - 1])) {
        searchFrom = callIndex + fnName.length
        continue
      }

      // Also check the char after fnName( isn't making a different identifier
      // (already handled by the `(` in the search string)

      // Find the start of this expression line
      let lineStart = callIndex
      while (lineStart > 0 && modified[lineStart - 1] !== '\n') {
        lineStart--
      }

      // Find the matching closing paren for the function call
      const openParen = callIndex + fnName.length
      let depth = 0
      let endIndex = openParen
      for (let i = openParen; i < modified.length; i++) {
        if (modified[i] === '(') depth++
        else if (modified[i] === ')') {
          depth--
          if (depth === 0) {
            endIndex = i + 1
            break
          }
        }
      }

      // Check for trailing comma and whitespace
      let removeEnd = endIndex
      const afterCall = modified.slice(endIndex)
      const trailingMatch = afterCall.match(/^\s*,/)
      if (trailingMatch) {
        removeEnd = endIndex + trailingMatch[0].length
      }

      // Determine the full range to remove
      let removeStart = lineStart
      // Include the newline before this line
      if (removeStart > 0 && modified[removeStart - 1] === '\n') {
        removeStart--
      }

      // If no trailing comma, remove a leading comma instead
      if (!trailingMatch) {
        let lookBack = removeStart
        while (lookBack > 0 && /[\s\n]/.test(modified[lookBack - 1])) {
          lookBack--
        }
        if (lookBack > 0 && modified[lookBack - 1] === ',') {
          removeStart = lookBack - 1
        }
      }

      // Remove the block
      modified = modified.slice(0, removeStart) + modified.slice(removeEnd)
      // Don't advance searchFrom since content shifted
    }
  }

  return modified
}

/**
 * Clean up consecutive empty lines (max 1 empty line between content)
 */
function cleanEmptyLines(content) {
  return content.replace(/\n{3,}/g, '\n\n')
}

/**
 * Clean orphan trailing commas before closing brackets/parens
 * e.g., `,\n]` becomes `\n]`
 */
function cleanOrphanCommas(content) {
  return content.replace(/,(\s*\n\s*[)\]])/g, '$1')
}

/**
 * Process a single file: remove imports and plugin calls
 */
export function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf-8')

  // Check if this file references the package at all
  if (!original.includes(PACKAGE_NAME)) {
    return null
  }

  let content = original

  // 1. Extract the names actually imported from our package (before removing imports)
  const importedNames = extractImportedNames(content)

  // 2. Remove import lines
  content = content.replace(IMPORT_RE, '')

  // 3. Remove plugin calls only for names imported from our package
  if (importedNames.length > 0) {
    content = removePluginCalls(content, importedNames)
  }

  // 4. Clean up
  content = cleanOrphanCommas(content)
  content = cleanEmptyLines(content)

  if (content === original) {
    return null
  }

  return content
}

// ── Helpers ───────────────────────────────────────────────

/**
 * Detect which package manager is being used in the project
 */
function detectPackageManager(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(projectDir, 'bun.lockb')) || fs.existsSync(path.join(projectDir, 'bun.lock'))) return 'bun'
  return 'npm'
}

/**
 * Run a shell command and print its output. Returns false on failure instead of
 * throwing, so the caller can report it — the failure must never be silent:
 * announcing "Uninstall complete" over a package that is still installed is
 * worse than no script at all.
 */
function run(cmd, cwd) {
  console.log(`  \x1b[90m$ ${cmd}\x1b[0m`)
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m  Command failed: ${err?.message ?? err}`)
    return false
  }
}

// ── Main ──────────────────────────────────────────────────

/**
 * What an uninstall LEAVES BEHIND, as plain printable lines.
 *
 * Exported and pure on purpose: this text is the only place a user is told that a
 * live Google OAuth refresh token survives the uninstall, and that the `meta` group
 * may be editorial content owned by another plugin. Both are easy to get wrong in a
 * hurry, so the wording is under test (scripts/__tests__/uninstall.test.mjs).
 *
 * The script itself never touches the database — everything below is manual.
 */
export function leftoverNotice() {
  return [
    'Left behind \u2014 this script never touches your database.',
    '',
    '1. Plugin tables you may drop (nothing outside the plugin reads them):',
    '     - seo-gsc-auth      \u2190 DROP THIS ONE FIRST. It stores an ENCRYPTED GOOGLE OAUTH',
    '                           REFRESH TOKEN plus the connected account email. Removing the',
    '                           package does not revoke it. Revoke the grant as well at',
    '                           https://myaccount.google.com/permissions',
    '     - seo-settings',
    '     - seo-redirects     \u2190 your 301/302 rules stop being served once it is gone',
    '     - seo-score-history',
    '     - seo-performance',
    '     - seo-logs          \u2190 holds visitor referrer and user-agent strings (no IP addresses)',
    '     - seo-rank-history',
    '',
    '2. Fields the plugin injected into YOUR collections \u2014 do NOT drop them blindly.',
    '   They are columns in your own tables:',
    '     - isCornerstone, focusKeyword, focusKeywords (its own array table): plugin data,',
    '       safe to drop once you no longer want it.',
    '     - the meta group (meta.title, meta.description, meta.image): EDITORIAL CONTENT.',
    '       Dropping it deletes the meta titles and descriptions your editors wrote, and it',
    '       may not even be ours \u2014 when @payloadcms/plugin-seo (or your own meta group) is',
    '       present the plugin detects it and never creates one. Keep it unless you are sure.',
    '',
    '   Removing any of those fields is a schema change: run `payload migrate:create`,',
    '   then `payload migrate` in production. Never `push`.',
  ]
}

function main() {
  // Determine project root
  const projectDir = process.env.INIT_CWD || process.cwd()
  const srcDir = path.join(projectDir, 'src')
  const pm = detectPackageManager(projectDir)

  console.log('')
  console.log('  \x1b[36m@consilioweb/seo-analyzer\x1b[0m — Full Uninstall')
  console.log('  ─────────────────────────────────────────────')
  console.log(`  Project: \x1b[33m${projectDir}\x1b[0m`)
  console.log(`  Package manager: \x1b[33m${pm}\x1b[0m`)
  console.log('')

  // ── Step 1: Clean source files ──
  console.log('  \x1b[36m[1/3]\x1b[0m Cleaning source files...')

  if (!fs.existsSync(srcDir)) {
    console.log('  \x1b[33m⚠\x1b[0m  No src/ directory found. Skipping code cleanup.')
  } else {
    const files = findSourceFiles(srcDir)
    const modified = []

    for (const filePath of files) {
      const result = processFile(filePath)
      if (result !== null) {
        fs.writeFileSync(filePath, result, 'utf-8')
        const rel = path.relative(projectDir, filePath)
        modified.push(rel)
        console.log(`  \x1b[32m✓\x1b[0m  Cleaned: ${rel}`)
      }
    }

    if (modified.length === 0) {
      console.log('  \x1b[32m✓\x1b[0m  No references found in source files.')
    } else {
      console.log(`  \x1b[32m✓\x1b[0m  ${modified.length} file(s) cleaned.`)
    }
  }

  console.log('')

  // ── Step 2: Remove the package ──
  console.log('  \x1b[36m[2/3]\x1b[0m Removing package...')
  const removeCmd = pm === 'npm' ? 'npm uninstall' : `${pm} remove`
  const failures = []
  if (!run(`${removeCmd} ${PACKAGE_NAME}`, projectDir)) {
    failures.push(`${removeCmd} ${PACKAGE_NAME}`)
  }

  console.log('')

  // ── Step 3: Regenerate importmap ──
  console.log('  \x1b[36m[3/3]\x1b[0m Regenerating importmap...')
  const importmapCmd = pm === 'npm' ? 'npx' : pm === 'yarn' ? 'yarn' : pm
  if (!run(`${importmapCmd} generate:importmap`, projectDir)) {
    failures.push(`${importmapCmd} generate:importmap`)
  }

  console.log('')

  // ── Done ──
  if (failures.length > 0) {
    console.log('  \x1b[31m✗ Uninstall incomplete.\x1b[0m')
    console.log('  The following command(s) failed — finish them by hand:')
    for (const cmd of failures) console.log(`  \x1b[90m  - ${cmd}\x1b[0m`)
    console.log('')
    return 1
  }

  console.log('  \x1b[32m✓ Uninstall complete!\x1b[0m')
  console.log('')
  for (const line of leftoverNotice()) {
    console.log(line === '' ? '' : `  ${line}`)
  }
  console.log('')
  return 0
}

/**
 * Only run when invoked as the CLI, so the pure helpers above stay importable
 * from tests. `realpathSync` is required because package managers expose the
 * bin through a symlink in node_modules/.bin.
 */
function isDirectRun() {
  if (!process.argv[1]) return false
  try {
    return fs.realpathSync(process.argv[1]) === SELF_PATH
  } catch {
    return false
  }
}

if (isDirectRun()) {
  process.exitCode = main()
}
