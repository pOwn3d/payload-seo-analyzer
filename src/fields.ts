/**
 * SEO fields added automatically to collections by the plugin.
 * Includes: focusKeyword, focusKeywords array, isCornerstone, and the SeoAnalyzer UI.
 */

import type { Field } from 'payload'
import type { SeoAnalysisLocaleOptions } from './hooks/useSeoLocale.js'

/**
 * @param options - `locale` and `localeMapping` from the plugin config, forwarded
 * to the sidebar analyzer through `admin.custom` so it resolves the analysis
 * locale exactly like the server endpoints do.
 */
export function seoFields(options: SeoAnalysisLocaleOptions = {}): Field[] {
  // Defined keys only: an explicit `undefined` would be serialised to the client.
  const analyzerCustom: SeoAnalysisLocaleOptions = {
    ...(options.locale && { locale: options.locale }),
    ...(options.localeMapping && { localeMapping: options.localeMapping }),
  }

  return [
    {
      name: 'isCornerstone',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Cornerstone content', fr: 'Contenu pilier (Cornerstone)' },
      admin: {
        description: {
          en: 'Cornerstone content is the most important content on your site and should be well linked.',
          fr: 'Les contenus piliers sont les pages les plus importantes du site et doivent être bien maillées.',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'focusKeyword',
      type: 'text',
      label: { en: 'Primary SEO keyword', fr: 'Mot-clé SEO principal' },
      admin: {
        position: 'sidebar',
        description: { en: 'Target keyword for SEO analysis', fr: "Mot-clé cible pour l'analyse SEO" },
      },
    },
    {
      name: 'seoAnalyzer',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@consilioweb/payload-seo-analyzer/client#SeoAnalyzerField',
        },
        custom: analyzerCustom,
      },
    },
    {
      type: 'collapsible',
      label: { en: 'Secondary keywords (SEO)', fr: 'Mots-clés secondaires (SEO)' },
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'focusKeywords',
          type: 'array',
          maxRows: 3,
          admin: {
            description: {
              en: 'Secondary keywords (in addition to the primary keyword)',
              fr: 'Mots-clés secondaires (en plus du mot-clé principal)',
            },
          },
          fields: [
            {
              name: 'keyword',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
  ]
}
