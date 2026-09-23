// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, cleanup } from '@testing-library/react'

// @payloadcms/ui is a peer dependency whose entry point imports CSS, which the
// node/jsdom loader cannot parse. `contentLocale` stands in for useLocale()
// (undefined on mono-locale projects) and `uiLanguage` for the admin UI
// language exposed by useTranslation().
let contentLocale: { code: string } | undefined
let uiLanguage: string | undefined

vi.mock('@payloadcms/ui', () => ({
  useLocale: () => contentLocale,
  useTranslation: () => ({ i18n: { language: uiLanguage } }),
}))

import { useSeoLocale } from '../hooks/useSeoLocale.js'

function resolved(contentCode: string | undefined, uiLang: string | undefined) {
  contentLocale = contentCode ? { code: contentCode } : undefined
  uiLanguage = uiLang
  return renderHook(() => useSeoLocale()).result.current
}

afterEach(cleanup)

describe('useSeoLocale', () => {
  it('returns fr for an explicit French content locale', () => {
    expect(resolved('fr', 'en')).toBe('fr')
    expect(resolved('fr-FR', 'en')).toBe('fr')
    expect(resolved('fr_CA', undefined)).toBe('fr')
  })

  it('returns en for an English content locale', () => {
    expect(resolved('en', undefined)).toBe('en')
    expect(resolved('en-US', 'fr')).toBe('en')
  })

  it('returns en for any other content locale instead of falling back to fr', () => {
    expect(resolved('de', 'de')).toBe('en')
    expect(resolved('es-ES', 'es')).toBe('en')
  })

  it('falls back to the admin UI language when the content locale is unset', () => {
    expect(resolved(undefined, 'fr')).toBe('fr')
    expect(resolved(undefined, 'en')).toBe('en')
    expect(resolved(undefined, 'de')).toBe('en')
  })

  it('defaults to en when neither locale is set', () => {
    expect(resolved(undefined, undefined)).toBe('en')
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
