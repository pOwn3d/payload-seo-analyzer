'use client'

import { useMemo } from 'react'
import { useConfig, useLocale, useTranslation } from '@payloadcms/ui'
import type { SeoLocale } from '../i18n.js'
import type { SeoFeatures } from '../types.js'
import { resolveAnalysisLocale } from '../helpers/resolveLocale.js'
import { resolveDashboardT, type DashboardTranslations } from '../dashboard-i18n.js'

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

/** What the plugin forwards to the browser in `admin.custom` (see plugin.ts). */
interface SeoAdminCustom {
  seoAnalyzer?: {
    features?: Partial<Record<keyof SeoFeatures, boolean>>
    customTranslations?: Record<string, Partial<DashboardTranslations>>
  }
}

// No default context: `useConfig()` is undefined outside the admin provider
// tree, and the error boundary that reads it must never throw.
function useSeoAdminCustom(): SeoAdminCustom['seoAnalyzer'] {
  return (useConfig()?.config?.admin?.custom as SeoAdminCustom | undefined)?.seoAnalyzer
}

/**
 * Whether a plugin feature is on, from the flags forwarded in `admin.custom`.
 * `undefined` when the flags are unavailable (component mounted outside the
 * plugin's config): callers then fall back to probing the endpoint.
 */
export function useSeoFeature(name: keyof SeoFeatures): boolean | undefined {
  return useSeoAdminCustom()?.features?.[name]
}

/**
 * Dashboard strings in the admin UI language, including the languages added
 * through `customTranslations` (forwarded in `admin.custom`: the plugin's own
 * registry lives on the server and never reaches the browser).
 */
export function useDashboardT(): DashboardTranslations {
  const { i18n } = useTranslation()
  const custom = useSeoAdminCustom()?.customTranslations
  const language = i18n?.language
  return useMemo(() => resolveDashboardT(language, custom), [language, custom])
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
