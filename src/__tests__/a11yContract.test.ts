import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      tsxFiles(full, acc)
    } else if (entry.name.endsWith('.tsx')) {
      acc.push(full)
    }
  }
  return acc
}

const FILES = tsxFiles(SRC)
const rel = (f: string) => path.relative(SRC, f)

/**
 * Source with every comment removed — `//`, `/* *\/` and JSX `{/* *\/}`.
 * These files document their own markup ("a real <button>, not a div"), so a
 * comment left in would both satisfy and trip the assertions below.
 */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf-8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
}

/**
 * Reads the opening tag of every `<tag` occurrence, brace-aware so that a JSX
 * expression containing a `>` (an arrow function, a comparison) does not end it
 * early.
 */
function openingTags(source: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length
    let depth = 0
    while (i < source.length) {
      const c = source[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      i++
    }
    out.push(source.slice(m.index, i))
  }
  return out
}

describe('a11y contract — focus visibility', () => {
  it('no component suppresses the browser focus ring', () => {
    // MetaTitleField and MetaDescriptionField render on every page and post edit
    // screen and drew no focus indicator of their own, so `outline: 'none'` left
    // keyboard users with nothing at all (WCAG 2.4.7).
    const offenders = FILES.filter((f) => /outline:\s*['"]none['"]/.test(code(f))).map(rel)
    expect(offenders).toEqual([])
  })
})

describe('a11y contract — every form control has an accessible name', () => {
  it('no <input>, <select> or <textarea> is anonymous', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const source = code(file)
      const lines = source.split('\n')
      for (const tag of ['input', 'select', 'textarea']) {
        for (const head of openingTags(source, tag)) {
          // Named by a <label htmlFor>, by aria-label(ledby), or wrapped in a
          // <label> (implicit association — still valid).
          if (/\bid=|aria-label=|aria-labelledby=/.test(head)) continue
          const index = source.indexOf(head)
          const before = source.slice(Math.max(0, index - 1200), index)
          const lastLabelOpen = before.lastIndexOf('<label')
          const lastLabelClose = before.lastIndexOf('</label>')
          if (lastLabelOpen > lastLabelClose) continue // inside a <label>
          const line = source.slice(0, index).split('\n').length
          offenders.push(`${rel(file)}:${line} ${lines[line - 1].trim().slice(0, 50)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every <label htmlFor> points at an id that the same file produces', () => {
    for (const file of FILES) {
      const source = code(file)
      for (const head of openingTags(source, 'label')) {
        const match = head.match(/htmlFor=\{([^}]+)\}/)
        if (!match) continue
        const expr = match[1].trim()
        // The same expression must appear as an `id={…}` somewhere in the file.
        expect(source, `${rel(file)} — htmlFor={${expr}} has no matching id`).toContain(
          `id={${expr}}`,
        )
      }
    }
  })

  it('ids are generated with useId(), never written as literals', () => {
    // Several of these components are mounted more than once on one page:
    // MetaTitleField once per locale tab, SerpPreview and SeoSocialPreview
    // inside every document editor. Duplicate ids break the association they
    // were added to create.
    const offenders: string[] = []
    for (const file of FILES) {
      const source = code(file)
      for (const tag of ['input', 'select', 'textarea', 'label']) {
        for (const head of openingTags(source, tag)) {
          const literal = head.match(/\sid="([^"]+)"/)
          if (literal) offenders.push(`${rel(file)} id="${literal[1]}"`)
        }
      }
      if (/\bid=\{/.test(source) && !/useId/.test(source)) {
        // An id built from data (a slug, a filename) is fine as long as it is
        // scoped by a useId() base.
        const dynamic = source.match(/\sid=\{[^}]+\}/g) || []
        if (dynamic.length) offenders.push(`${rel(file)} uses id={…} without useId()`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('a11y contract — buttons', () => {
  it('every <button> declares its type', () => {
    // The field components render inside Payload's document <form>: an untyped
    // button defaults to type="submit" and saves the document on click.
    const offenders: string[] = []
    for (const file of FILES) {
      const source = code(file)
      for (const head of openingTags(source, 'button')) {
        if (!/\btype=/.test(head)) {
          const index = source.indexOf(head)
          offenders.push(`${rel(file)}:${source.slice(0, index).split('\n').length}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no <div> or <span> carries a click handler without keyboard support', () => {
    // The fix is a real <button> or <a>, not role + tabIndex + onKeyDown — with
    // one documented exception: an SVG node, where HTML interactive elements are
    // not valid children.
    const offenders: string[] = []
    for (const file of FILES) {
      const source = code(file)
      for (const tag of ['div', 'span']) {
        for (const head of openingTags(source, tag)) {
          if (!/\bonClick=/.test(head)) continue
          // Stopping propagation is not a control: it makes a wrapper inert for
          // the mouse, and adds nothing for the keyboard.
          if (/onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(head)) continue
          if (/\brole=|\bonKeyDown=/.test(head)) continue
          // Keyed by the handler rather than by a line number: stripping the
          // comments above shifts line numbers, and this list must stay stable.
          const from = head.indexOf('onClick=')
          const handler = head.slice(from, from + 90).replace(/\s+/g, ' ')
          offenders.push(`${rel(file)} ${handler.trim()}`)
        }
      }
    }
    // Two documented exceptions remain, both pure mouse conveniences that
    // duplicate a real control rather than being the only way in:
    //  - the audit table row, whose expand/collapse is also on the title
    //    <button> next to it (that button is what the keyboard uses);
    //  - the bulk-preview modal overlay, where click-to-dismiss belongs to the
    //    dialog work (focus trap, Escape) rather than to this pass.
    expect(offenders).toEqual([
      'components/SeoView.tsx onClick={(e) => { const target = e.target as HTMLElement if (target.tagNa',
      'components/SeoView.tsx onClick={() => { if (!bulkApplying) setBulkPreview(null) }}',
    ])
  })
})
