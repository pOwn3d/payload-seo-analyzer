/**
 * Escape a string for interpolation into HTML text or a double-quoted attribute.
 *
 * Shared by everything in the plugin that builds HTML by string concatenation:
 * the printable SEO report, the GSC OAuth callback page and the alert-digest
 * email. Those templates interpolate values the plugin does not control — an
 * OAuth error reflected from Google, a 404 path recorded from an anonymous
 * visitor, a search query — so each one must go through here.
 *
 * `&` is replaced first, otherwise it would double-escape the entities
 * introduced by the later replacements.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
