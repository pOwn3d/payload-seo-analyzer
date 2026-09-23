import { describe, it, expect, vi } from 'vitest'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'
import { createTrackSeoScoreHook } from '../hooks/trackSeoScore.js'
import { buildSeoInputFromDoc } from '../endpoints/validate.js'
import { analyzeSeo } from '../index.js'

// Minimal Payload stand-in: `seo-settings` returns the given settings, every
// other collection is empty, and `create` records what the hook writes.
function fakePayload(settings?: Record<string, unknown>) {
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'seo-settings' && settings ? [settings] : [],
    })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return data
    }),
    logger: { error: vi.fn() },
  }
  return { payload, created }
}

describe('loadMergedConfig — analysis locale', () => {
  it('applies the plugin localeMapping to the request locale', async () => {
    const { payload } = fakePayload()
    const { config } = await loadMergedConfig(payload, { localeMapping: { de: 'en' } }, { reqLocale: 'de' })
    expect(config.locale).toBe('en')
  })

  it('lets an explicit mapping win over the plugin one', async () => {
    const { payload } = fakePayload()
    const { config } = await loadMergedConfig(
      payload,
      { localeMapping: { de: 'en' } },
      { reqLocale: 'de', localeMapping: { de: 'fr' } },
    )
    expect(config.locale).toBe('fr')
  })

  it('keeps the plugin locale above the mapping, as documented', async () => {
    const { payload } = fakePayload()
    const { config } = await loadMergedConfig(payload, { locale: 'fr', localeMapping: { de: 'en' } }, { reqLocale: 'de' })
    expect(config.locale).toBe('fr')
  })

  it('keeps the fr default on a mono-locale site', async () => {
    const { payload } = fakePayload()
    const { config } = await loadMergedConfig(payload, { localeMapping: { de: 'en' } })
    expect(config.locale).toBe('fr')
  })
})

describe('trackSeoScore — the history uses the dashboard config', () => {
  const doc = {
    id: 1,
    slug: 'agence-web',
    title: 'Agence web',
    meta: {
      title: 'Agence web à Limoges : création de sites performants',
      description:
        "Découvrez notre agence web : création de sites sur mesure, référencement naturel et accompagnement personnalisé.",
    },
  }

  it('scores the snapshot with SeoSettings merged in and the request locale resolved', async () => {
    const settings = { disabledRules: ['readability', 'content'] }
    const { payload, created } = fakePayload(settings)
    const seoConfig = { localeMapping: { de: 'en' as const } }

    const hook = createTrackSeoScoreHook(seoConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await hook({ doc, collection: { slug: 'pages' }, req: { payload, locale: 'de' } } as any)
    await vi.waitFor(() => expect(created).toHaveLength(1))

    const input = buildSeoInputFromDoc(doc, 'pages')
    const expected = analyzeSeo(input, { ...seoConfig, locale: 'en', disabledRules: ['readability', 'content'] })
    expect(created[0].score).toBe(expected.score)
    // Guard against a vacuous pass: the settings must actually move the score.
    expect(analyzeSeo(input, seoConfig).score).not.toBe(expected.score)
  })
})
