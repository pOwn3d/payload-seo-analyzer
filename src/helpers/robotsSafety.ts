/**
 * Sanitize admin-supplied robots.txt custom rules before they reach the public
 * robots.txt. Keeps only well-formed directive lines / comments / blank lines and
 * drops everything else, so the field can't inject arbitrary content or break the
 * file structure (CRLF tricks, HTML, etc.). Applied on read (defense-in-depth) and
 * on write.
 */

const ALLOWED_DIRECTIVES = new Set([
  'user-agent',
  'allow',
  'disallow',
  'sitemap',
  'crawl-delay',
  'host',
  'clean-param',
  'noindex',
])

/** Strip control characters (incl. CR/LF/tab/DEL) from a single line. */
function stripControl(line: string): string {
  let out = ''
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i)
    if (code >= 0x20 && code !== 0x7f) out += line[i]
  }
  return out
}

export function sanitizeRobotsRules(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return ''
  const out: string[] = []

  for (const rawLine of raw.split(/\r\n|\r|\n/)) {
    const line = stripControl(rawLine).trim()
    if (line === '') {
      out.push('')
      continue
    }
    if (line.startsWith('#')) {
      out.push(line)
      continue
    }
    const colon = line.indexOf(':')
    if (colon <= 0) continue // not a `Directive: value` line → drop
    const directive = line.slice(0, colon).trim().toLowerCase()
    if (!ALLOWED_DIRECTIVES.has(directive)) continue
    out.push(line)
  }

  return out.join('\n').trim()
}
