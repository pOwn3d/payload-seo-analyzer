/**
 * CSV serialization for the dashboard exports.
 *
 * Every export in this plugin ships content the plugin does not control: a page
 * title, a meta description, a focus keyword, a 404 path recorded from an
 * anonymous visitor. Any of those can be written by a low-privileged editor and
 * is later opened, by an admin, in Excel or LibreOffice.
 *
 * Quoting alone does not protect that reader. A spreadsheet strips the surrounding
 * quotes BEFORE deciding whether the cell is a formula, so a value starting with
 * `=`, `+`, `-`, `@`, a tab or a CR is evaluated — `=HYPERLINK(...)` exfiltrates the
 * rest of the report to a domain the editor chose, a DDE payload runs a command on
 * an unhardened Excel (CWE-1236, "CSV injection"). The exports used to double the
 * double-quotes and nothing else.
 *
 * The fix is the standard one: prefix the dangerous cell with a single quote, which
 * every spreadsheet reads as "this is text". Plain numbers are left alone so a
 * negative metric stays a number rather than becoming a string.
 */

/** Leading characters a spreadsheet treats as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/

/** A cell that is just a number — `-3`, `1.5`, `2,5` — must stay numeric. */
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/

/**
 * Serialize one value as a CSV field: formula-neutralized, quoted, quotes doubled.
 * `null` / `undefined` become an empty field.
 */
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const safe = FORMULA_LEAD.test(raw) && !PLAIN_NUMBER.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

/** Serialize a full table (header row included) into a CSV document. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}
