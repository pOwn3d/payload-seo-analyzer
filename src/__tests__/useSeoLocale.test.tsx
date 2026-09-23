// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'

// @payloadcms/ui is a peer dependency whose entry point imports CSS, which the
// node/jsdom loader cannot parse. `contentLocale` stands in for useLocale()
// (`{}` on mono-locale projects) and `uiLanguage` for the admin UI language
// exposed by useTranslation().
let contentLocale: { code?: string } = {}
let uiLanguage: string | undefined
// useConfig() has no default context: undefined outside the admin provider tree.
let configContext: { config: { admin?: { custom?: Record<string, unknown> } } } | undefined

vi.mock('@payloadcms/ui', () => ({
  useLocale: () => contentLocale,
  useTranslation: () => ({ i18n: { language: uiLanguage } }),
  useConfig: () => configContext,
}))

import {
  useDashboardT,
  useSeoAnalysisLocale,
  useSeoLocale,
  type SeoAnalysisLocaleOptions,
} from '../hooks/useSeoLocale.js'
import { getDashboardT, resolveDashboardT } from '../dashboard-i18n.js'

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

describe('useDashboardT — dashboard strings', () => {
  const czech = { common: { loading: 'Načítání...' } }

  function dashboardT(uiLang: string | undefined, customTranslations?: Record<string, unknown>) {
    uiLanguage = uiLang
    configContext = customTranslations
      ? { config: { admin: { custom: { seoAnalyzer: { customTranslations } } } } }
      : { config: {} }
    return renderHook(() => useDashboardT()).result.current
  }

  it('serves a language added through customTranslations, forwarded in admin.custom', () => {
    const t = dashboardT('cs', { cs: czech })
    expect(t.common.loading).toBe('Načítání...')
    // Keys the custom entry leaves out fall back to English.
    expect(t.common.save).toBe(getDashboardT('en').common.save)
  })

  it('keeps the built-in French and English otherwise', () => {
    expect(dashboardT('fr')).toBe(getDashboardT('fr'))
    expect(dashboardT('de', { cs: czech })).toBe(getDashboardT('en'))
  })

  it('does not throw outside the admin provider tree', () => {
    uiLanguage = 'fr'
    configContext = undefined
    expect(renderHook(() => useDashboardT()).result.current).toBe(getDashboardT('fr'))
  })
})

describe('resolveDashboardT', () => {
  it('falls back from a region to its base language', () => {
    expect(resolveDashboardT('pt-BR', { pt: { common: { loading: 'Carregando...' } } }).common.loading).toBe(
      'Carregando...',
    )
  })

  it('layers a French override over the built-in French, not over English', () => {
    const t = resolveDashboardT('fr', { fr: { common: { loading: 'Patientez…' } } })
    expect(t.common.loading).toBe('Patientez…')
    expect(t.common.save).toBe(getDashboardT('fr').common.save)
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
