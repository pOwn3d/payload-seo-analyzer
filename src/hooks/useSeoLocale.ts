'use client'

import { useLocale, useTranslation } from '@payloadcms/ui'
import type { SeoLocale } from '../i18n.js'

/**
 * Returns the current locale mapped to a SeoLocale ('fr' | 'en').
 * The content locale takes precedence; when it is unset (mono-locale
 * projects), the admin UI language is used instead. French is returned only
 * for an explicit French locale — every other locale falls back to English.
 */
export function useSeoLocale(): SeoLocale {
  const locale = useLocale()
  const { i18n } = useTranslation()
  const code = (typeof locale === 'string' ? locale : locale?.code) || i18n?.language
  if (code && (code === 'fr' || code.startsWith('fr-') || code.startsWith('fr_'))) {
    return 'fr'
  }
  return 'en'
}
