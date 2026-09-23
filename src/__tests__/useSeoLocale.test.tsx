// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'

// @payloadcms/ui is a peer dependency whose entry point imports CSS, which the
// node/jsdom loader cannot parse. `contentLocale` stands in for useLocale()
// (`{}` on mono-locale projects) and `uiLanguage` for the admin UI language
// exposed by useTranslation().
let contentLocale: { code?: string } = {}
let uiLanguage: string | undefined

vi.mock('@payloadcms/ui', () => ({
  useLocale: () => contentLocale,
  useTranslation: () => ({ i18n: { language: uiLanguage } }),
}))

import { useSeoAnalysisLocale, useSeoLocale, type SeoAnalysisLocaleOptions } from '../hooks/useSeoLocale.js'

function setLocales(contentCode: string | undefined, uiLang: string | undefined) {
  contentLocale = contentCode ? { code: contentCode } : {}
  uiLanguage = uiLang
}

function uiLocale(contentCode: string | undefined, uiLang: string | undefined) {
  setLocales(contentCode, uiLang)
  return renderHook(() => useSeoLocale()).result.current
}

function analysisLocale(
  contentCode: string | undefined,
  uiLang: string | undefined,
  options?: SeoAnalysisLocaleOptions,
) {
  setLocales(contentCode, uiLang)
  return renderHook(() => useSeoAnalysisLocale(options)).result.current
}

afterEach(cleanup)

describe('useSeoLocale — UI language', () => {
  it('follows the admin UI language, not the content locale', () => {
    expect(uiLocale('en', 'fr')).toBe('fr')
    expect(uiLocale('fr', 'en')).toBe('en')
  })

  it('returns fr only for an explicit French admin language', () => {
    expect(uiLocale(undefined, 'fr')).toBe('fr')
    expect(uiLocale(undefined, 'fr-FR')).toBe('fr')
    expect(uiLocale(undefined, 'fr_CA')).toBe('fr')
  })

  it('falls back to en for any other or missing admin language', () => {
    expect(uiLocale(undefined, 'en')).toBe('en')
    expect(uiLocale(undefined, 'de')).toBe('en')
    expect(uiLocale(undefined, 'frisian')).toBe('en')
    expect(uiLocale(undefined, undefined)).toBe('en')
  })
})

describe('useSeoAnalysisLocale — sidebar analysis language', () => {
  it('never follows the admin UI language: a mono-locale site keeps the fr default', () => {
    // English admin, no localization, no plugin locale: the server audit
    // analyses in French, so the sidebar must too.
    expect(analysisLocale(undefined, 'en')).toBe('fr')
    expect(analysisLocale(undefined, 'de')).toBe('fr')
  })

  it('honours the plugin locale over everything, as the server does', () => {
    expect(analysisLocale(undefined, 'fr', { locale: 'en' })).toBe('en')
    expect(analysisLocale('fr', 'fr', { locale: 'en' })).toBe('en')
    expect(analysisLocale('en', 'en', { locale: 'fr' })).toBe('fr')
  })

  it('follows the content locale when no plugin locale is set', () => {
    expect(analysisLocale('en', 'fr')).toBe('en')
    expect(analysisLocale('en-US', 'fr')).toBe('en')
    expect(analysisLocale('fr', 'en')).toBe('fr')
  })

  it('applies localeMapping to the content locale', () => {
    expect(analysisLocale('de', 'en', { localeMapping: { de: 'en' } })).toBe('en')
    expect(analysisLocale('de', 'en')).toBe('fr')
  })
})

describe('getTranslations', () => {
  it('falls back to English for unknown or unset locales', async () => {
    const { getTranslations } = await import('../i18n.js')
    expect(getTranslations('en')).toBe(getTranslations('en-US'))
    expect(getTranslations('de')).toEqual(getTranslations('en'))
    expect(getTranslations(undefined)).toEqual(getTranslations('en'))
    expect(getTranslations('fr')).not.toEqual(getTranslations('en'))
  })
})
