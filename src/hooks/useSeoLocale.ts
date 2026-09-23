'use client'

import { useLocale, useTranslation } from '@payloadcms/ui'
import type { SeoLocale } from '../i18n.js'
import { resolveAnalysisLocale } from '../helpers/resolveLocale.js'

const isFrench = (code: string | undefined): boolean =>
  !!code && (code === 'fr' || code.startsWith('fr-') || code.startsWith('fr_'))

/**
 * Language of the plugin's own UI strings ('fr' | 'en').
 *
 * Follows the admin UI language, like Payload's own chrome and the field
 * labels it resolves from `{ en, fr }` records, so a screen never mixes two
 * languages. French only for an explicit French language, English otherwise.
 * The content locale is deliberately ignored: it drives the analysis (see
 * `useSeoAnalysisLocale`), not the interface.
 */
export function useSeoLocale(): SeoLocale {
  const { i18n } = useTranslation()
  return isFrench(i18n?.language) ? 'fr' : 'en'
}

/** Analysis locale options forwarded from `SeoPluginConfig` to the sidebar field. */
export interface SeoAnalysisLocaleOptions {
  /** `SeoPluginConfig.locale` — overrides everything, as on the server. */
  locale?: SeoLocale
  /** `SeoPluginConfig.localeMapping` — Payload locale code → analysis locale. */
  localeMapping?: Record<string, SeoLocale>
}

/**
 * Language of the analysis run in the editor sidebar: readability formula,
 * stop words, power words, transition words and the check messages.
 *
 * Resolved with the same cascade as the server endpoints, so the sidebar score
 * matches the dashboard: plugin `locale`, then `localeMapping`, then the
 * document's content locale, then 'fr'. Never the admin UI language — an
 * English-speaking admin editing a French site must still get the French
 * analysis.
 */
export function useSeoAnalysisLocale(options: SeoAnalysisLocaleOptions = {}): SeoLocale {
  const locale = useLocale()
  const code = typeof locale === 'string' ? locale : locale?.code
  return resolveAnalysisLocale({
    reqLocale: code,
    pluginLocale: options.locale,
    customMapping: options.localeMapping,
  })
}
