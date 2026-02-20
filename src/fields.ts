/**
 * SEO fields added automatically to collections by the plugin.
 * Includes: focusKeyword, focusKeywords array, isCornerstone, and the SeoAnalyzer UI.
 */

import type { Field } from 'payload'

export function seoFields(): Field[] {
  return [
    {
      name: 'isCornerstone',
      type: 'checkbox',
      defaultValue: false,
      label: 'Contenu pilier (Cornerstone)',
      admin: {
        description:
          'Les contenus piliers sont les pages les plus importantes du site et doivent être bien maillées.',
        position: 'sidebar',
      },
    },
    {
      name: 'focusKeyword',
      type: 'text',
      label: 'Mot-clé SEO principal',
      admin: {
        position: 'sidebar',
        description: "Mot-clé cible pour l'analyse SEO",
      },
    },
    {
      name: 'seoAnalyzer',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@consilioweb/seo-analyzer/client#SeoAnalyzerField',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Mots-clés secondaires (SEO)',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'focusKeywords',
          type: 'array',
          maxRows: 3,
          admin: {
            description: 'Mots-clés secondaires (en plus du mot-clé principal)',
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
