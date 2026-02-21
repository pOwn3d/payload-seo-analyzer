#!/usr/bin/env node

// Cleanup script for @consilioweb/seo-analyzer
// Removes all imports and plugin calls from source files before uninstalling the package.
// Usage: npx seo-analyzer-uninstall

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const PACKAGE_NAME = '@consilioweb/seo-analyzer'

// Regex to match any import line from @consilioweb/seo-analyzer (value + type imports)
const IMPORT_RE = /^\s*import\s+(?:type\s+)?(?:\{[^}]*\}|[\w]+)\s+from\s+['"]@consilioweb\/seo-analyzer(?:\/[^'"]*)?['"]\s*;?\s*$/gm

/**
 * Extract imported names from a file that come from @consilioweb/seo-analyzer.
 * Returns the list of identifiers (after "as" renaming if any).
 * e.g. `import { seoPlugin as myPlugin, seoFields } from '...'` → ['myPlugin', 'seoFields']
 */
function extractImportedNames(content) {
  const names = []
  const re = /^\s*import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@consilioweb\/seo-analyzer(?:\/[^'"]*)?['"]\s*;?\s*$/gm
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
function processFile(filePath) {
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
 * Run a shell command, print output, swallow errors
 */
function run(cmd, cwd) {
  console.log(`  \x1b[90m$ ${cmd}\x1b[0m`)
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

// ── Main ──────────────────────────────────────────────────

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
  run(`${removeCmd} ${PACKAGE_NAME}`, projectDir)

  console.log('')

  // ── Step 3: Regenerate importmap ──
  console.log('  \x1b[36m[3/3]\x1b[0m Regenerating importmap...')
  const importmapCmd = pm === 'npm' ? 'npx' : pm === 'yarn' ? 'yarn' : pm
  run(`${importmapCmd} generate:importmap`, projectDir)

  console.log('')

  // ── Done ──
  console.log('  \x1b[32m✓ Uninstall complete!\x1b[0m')
  console.log('')
  console.log('  \x1b[36mOptional:\x1b[0m Drop plugin collections from your database:')
  console.log('  \x1b[90m  - seo-score-history')
  console.log('    - seo-settings')
  console.log('    - seo-redirects')
  console.log('    - seo-performance')
  console.log('    - seo-logs\x1b[0m')
  console.log('')
}

main()
