/**
 * Auto-created meta fields definition.
 * Generates a "meta" group field with title, description, image, overview, and preview sub-fields.
 * These fields mirror @payloadcms/plugin-seo's field structure for compatibility.
 *
 * Usage:
 *   import { metaFields } from '@consilioweb/seo-analyzer'
 *   // ...fields: [...metaFields({ uploadsCollection: 'media', hasGenerateTitle: true })]
 */

import type { Field } from 'payload'

export interface MetaFieldsConfig {
  /** Collection slug for image uploads (default: 'media') */
  uploadsCollection?: string
  /** Custom TypeScript interface name for the meta group (for generated types) */
  interfaceName?: string
  /** Whether a generateTitle function is configured */
  hasGenerateTitle?: boolean
  /** Whether a generateDescription function is configured */
  hasGenerateDescription?: boolean
  /** Whether a generateImage function is configured */
  hasGenerateImage?: boolean
  /** Base API path for the generate endpoint (default: '/api/seo-plugin') */
  basePath?: string
}

/**
 * Generate the meta field group (title, description, image, overview, preview).
 * Compatible with @payloadcms/plugin-seo's field naming for easy migration.
 */
export function metaFields(config: MetaFieldsConfig = {}): Field[] {
  const {
    uploadsCollection = 'media',
    interfaceName,
    hasGenerateTitle = false,
    hasGenerateDescription = false,
    hasGenerateImage = false,
    basePath = '/api/seo-plugin',
  } = config

  return [
    {
      name: 'meta',
      type: 'group',
      label: 'SEO Meta',
      ...(interfaceName && { interfaceName }),
      admin: {
        description: 'Meta tags for search engines and social sharing.',
      },
      fields: [
        // Overview UI field (completeness indicator)
        {
          name: '_overview',
          type: 'ui',
          admin: {
            components: {
              Field: '@consilioweb/seo-analyzer/client#OverviewField',
            },
          },
        },
        // Meta title
        {
          name: 'title',
          type: 'text',
          localized: true,
          label: 'Meta Title',
          admin: {
            components: {
              Field: '@consilioweb/seo-analyzer/client#MetaTitleField',
            },
            custom: {
              hasGenerateFn: hasGenerateTitle,
              basePath,
            },
          },
        },
        // Meta description
        {
          name: 'description',
          type: 'textarea',
          localized: true,
          label: 'Meta Description',
          admin: {
            components: {
              Field: '@consilioweb/seo-analyzer/client#MetaDescriptionField',
            },
            custom: {
              hasGenerateFn: hasGenerateDescription,
              basePath,
            },
          },
        },
        // Meta image (upload)
        {
          name: 'image',
          type: 'upload',
          localized: true,
          relationTo: uploadsCollection,
          label: 'Meta Image',
          admin: {
            description: 'Image for social sharing (Facebook, Twitter, LinkedIn).',
            components: {
              Field: hasGenerateImage
                ? '@consilioweb/seo-analyzer/client#MetaImageField'
                : undefined,
            },
            custom: {
              hasGenerateFn: hasGenerateImage,
              basePath,
            },
          },
        },
        // SERP Preview UI field
        {
          name: '_preview',
          type: 'ui',
          admin: {
            components: {
              Field: '@consilioweb/seo-analyzer/client#SerpPreviewField',
            },
          },
        },
      ],
    },
  ]
}
