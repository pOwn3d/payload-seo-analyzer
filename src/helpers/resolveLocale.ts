/**
 * Resolve the effective analysis locale from multiple sources.
 *
 * Cascade order:
 *   1. Explicit pluginLocale override (from SeoPluginConfig.locale)
 *   2. Custom mapping (pluginConfig.localeMapping) applied to reqLocale
 *   3. Auto-detect from reqLocale (req.locale from Payload's i18n)
 *   4. Fallback → 'fr'
 *
 * Mapping logic: 'fr*' → 'fr', 'en*' → 'en', anything else → fallback
 */

import type { SeoLocale } from '../i18n.js'

export interface ResolveLocaleArgs {
  /** req.locale from Payload (e.g. 'fr', 'en', 'en-US', 'fr-FR') */
  reqLocale?: string
  /** Static locale from SeoPluginConfig.locale — overrides everything */
  pluginLocale?: 'fr' | 'en'
  /** Custom mapping from Payload locale → analysis locale */
  customMapping?: Record<string, 'fr' | 'en'>
}

/**
 * Resolve the effective locale for SEO analysis.
 * Returns 'fr' or 'en'.
 */
export function resolveAnalysisLocale(args: ResolveLocaleArgs): SeoLocale {
  const { reqLocale, pluginLocale, customMapping } = args

  // 1. Static override from plugin config takes precedence
  if (pluginLocale) return pluginLocale

  // 2. Custom mapping (if provided and reqLocale matches)
  if (customMapping && reqLocale && customMapping[reqLocale]) {
    return customMapping[reqLocale]
  }

  // 3. Auto-detect from Payload's req.locale
  if (reqLocale) {
    if (reqLocale.startsWith('en')) return 'en'
    if (reqLocale.startsWith('fr')) return 'fr'

    // Check custom mapping keys by prefix
    if (customMapping) {
      for (const [key, value] of Object.entries(customMapping)) {
        if (reqLocale.startsWith(key)) return value
      }
    }
  }

  // 4. Fallback
  return 'fr'
}
