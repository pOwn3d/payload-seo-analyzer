'use client'

import { useLocale } from '@payloadcms/ui'
import type { SeoLocale } from '../i18n.js'

/**
 * Returns the current Payload admin locale mapped to a SeoLocale ('fr' | 'en').
 * Falls back to 'fr' for any non-English locale.
 */
export function useSeoLocale(): SeoLocale {
  const locale = useLocale()
  const code = typeof locale === 'string' ? locale : locale?.code
  if (code && (code === 'en' || code.startsWith('en-') || code.startsWith('en_'))) {
    return 'en'
  }
  return 'fr'
}
