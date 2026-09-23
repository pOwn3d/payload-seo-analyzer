/**
 * SEO Settings singleton collection.
 * Stores site-wide SEO configuration (site name, ignored slugs, disabled rules, thresholds).
 * Managed via the admin Configuration SEO view.
 *
 * Usage (in plugin.ts):
 *   config.collections = [
 *     ...(config.collections || []),
 *     createSeoSettingsCollection(),
 *   ]
 */

import type { CollectionConfig } from 'payload'
import { isSeoAdminRequest, isSeoPanelUser } from '../helpers/isAdmin.js'

export function createSeoSettingsCollection(): CollectionConfig {
  return {
    slug: 'seo-settings',
    admin: {
      custom: { navHidden: true },
    },
    // `read` stays open to any authenticated user: the admin views and the
    // plugin endpoints both surface this data to editors. Writes are restricted
    // to SEO admins, mirroring the gate the endpoints already enforce
    // (`isSeoAdmin` in settings.ts / redirects.ts). Without this, an editor
    // could bypass those endpoints through the REST collection API — writing
    // `robotsCustomRules`, neutralising `disabledRules`, creating a redirect or
    // overwriting the OAuth CSRF state.
    access: {
      read: ({ req }) => isSeoPanelUser(req),
      create: ({ req }) => isSeoAdminRequest(req),
      update: ({ req }) => isSeoAdminRequest(req),
      delete: ({ req }) => isSeoAdminRequest(req),
    },
    fields: [
      {
        name: 'siteName',
        type: 'text',
        label: { en: 'Site name', fr: 'Nom du site' },
        admin: {
          description: {
            en: 'Used for the brand check in titles',
            fr: 'Utilisé pour la vérification de marque dans les titres',
          },
        },
      },
      {
        name: 'ignoredSlugs',
        type: 'array',
        label: { en: 'Ignored slugs', fr: 'Slugs ignorés' },
        admin: {
          description: {
            en: 'Pages excluded from the SEO audit (e.g. legal-notice, terms)',
            fr: "Pages exclues de l'audit SEO (ex: mentions-legales, cgv)",
          },
        },
        fields: [
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
        ],
      },
      {
        name: 'disabledRules',
        type: 'select',
        hasMany: true,
        label: { en: 'Disabled rules', fr: 'Règles désactivées' },
        admin: {
          description: {
            en: 'Rule groups to ignore during analysis',
            fr: "Groupes de règles à ignorer lors de l'analyse",
          },
        },
        options: [
          { label: { en: 'Title', fr: 'Titre' }, value: 'title' },
          { label: 'Meta description', value: 'meta-description' },
          { label: 'URL / Slug', value: 'url' },
          { label: { en: 'H1–H6 headings', fr: 'Titres H1-H6' }, value: 'headings' },
          { label: { en: 'Content', fr: 'Contenu' }, value: 'content' },
          { label: 'Images', value: 'images' },
          { label: { en: 'Links', fr: 'Liens' }, value: 'linking' },
          { label: { en: 'Social networks', fr: 'Réseaux sociaux' }, value: 'social' },
          { label: { en: 'Structured data', fr: 'Données structurées' }, value: 'schema' },
          { label: { en: 'Readability', fr: 'Lisibilité' }, value: 'readability' },
          { label: { en: 'Quality', fr: 'Qualité' }, value: 'quality' },
          { label: { en: 'Secondary keywords', fr: 'Mots-clés secondaires' }, value: 'secondary-keywords' },
          { label: { en: 'Cornerstone content', fr: 'Contenu pilier' }, value: 'cornerstone' },
          { label: { en: 'Freshness', fr: 'Fraîcheur' }, value: 'freshness' },
          { label: { en: 'Technical', fr: 'Technique' }, value: 'technical' },
          { label: { en: 'Accessibility', fr: 'Accessibilité' }, value: 'accessibility' },
          { label: 'E-commerce', value: 'ecommerce' },
        ],
      },
      {
        name: 'thresholds',
        type: 'group',
        label: { en: 'Custom thresholds', fr: 'Seuils personnalisés' },
        admin: {
          description: {
            en: 'Leave empty to use the default values',
            fr: 'Laissez vide pour utiliser les valeurs par défaut',
          },
        },
        fields: [
          { name: 'titleLengthMin', type: 'number', label: { en: 'Title — min length', fr: 'Titre — longueur min' }, admin: { description: { en: 'Default: 30', fr: 'Défaut : 30' } } },
          { name: 'titleLengthMax', type: 'number', label: { en: 'Title — max length', fr: 'Titre — longueur max' }, admin: { description: { en: 'Default: 60', fr: 'Défaut : 60' } } },
          { name: 'metaDescLengthMin', type: 'number', label: { en: 'Meta desc — min length', fr: 'Meta desc — longueur min' }, admin: { description: { en: 'Default: 120', fr: 'Défaut : 120' } } },
          { name: 'metaDescLengthMax', type: 'number', label: { en: 'Meta desc — max length', fr: 'Meta desc — longueur max' }, admin: { description: { en: 'Default: 160', fr: 'Défaut : 160' } } },
          { name: 'minWordsGeneric', type: 'number', label: { en: 'Min words (pages)', fr: 'Mots min (pages)' }, admin: { description: { en: 'Default: 300', fr: 'Défaut : 300' } } },
          { name: 'minWordsPost', type: 'number', label: { en: 'Min words (posts)', fr: 'Mots min (articles)' }, admin: { description: { en: 'Default: 800', fr: 'Défaut : 800' } } },
          { name: 'keywordDensityMin', type: 'number', label: { en: 'Min keyword density (%)', fr: 'Densité mot-clé min (%)' }, admin: { description: { en: 'Default: 0.5', fr: 'Défaut : 0.5' } } },
          { name: 'keywordDensityMax', type: 'number', label: { en: 'Max keyword density (%)', fr: 'Densité mot-clé max (%)' }, admin: { description: { en: 'Default: 3', fr: 'Défaut : 3' } } },
          { name: 'fleschScorePass', type: 'number', label: { en: 'Min Flesch score', fr: 'Score Flesch min' }, admin: { description: { en: 'Default: 40', fr: 'Défaut : 40' } } },
          { name: 'slugMaxLength', type: 'number', label: { en: 'Max slug length', fr: 'Longueur max slug' }, admin: { description: { en: 'Default: 75', fr: 'Défaut : 75' } } },
        ],
      },
      {
        name: 'sitemap',
        type: 'group',
        label: { en: 'Sitemap configuration', fr: 'Configuration Sitemap' },
        fields: [
          {
            name: 'excludedSlugs',
            type: 'array',
            label: { en: 'Slugs excluded from the sitemap', fr: 'Slugs exclus du sitemap' },
            admin: {
              description: {
                en: 'Pages to exclude from sitemap generation',
                fr: 'Pages à exclure de la génération du sitemap',
              },
            },
            fields: [{ name: 'slug', type: 'text', required: true }],
          },
          {
            name: 'defaultChangefreq',
            type: 'select',
            label: { en: 'Default frequency', fr: 'Fréquence par défaut' },
            defaultValue: 'weekly',
            options: [
              { label: { en: 'Daily', fr: 'Quotidien' }, value: 'daily' },
              { label: { en: 'Weekly', fr: 'Hebdomadaire' }, value: 'weekly' },
              { label: { en: 'Monthly', fr: 'Mensuel' }, value: 'monthly' },
              { label: { en: 'Yearly', fr: 'Annuel' }, value: 'yearly' },
            ],
          },
          {
            name: 'defaultPriority',
            type: 'number',
            label: { en: 'Default priority', fr: 'Priorité par défaut' },
            min: 0,
            max: 1,
            admin: {
              step: 0.1,
              description: { en: 'Value between 0 and 1 (default: 0.5)', fr: 'Valeur entre 0 et 1 (défaut : 0.5)' },
            },
          },
          {
            name: 'priorityOverrides',
            type: 'array',
            label: { en: 'Custom priorities', fr: 'Priorités personnalisées' },
            admin: {
              description: {
                en: 'Set the priority for specific slug patterns',
                fr: 'Définir la priorité pour des patterns de slugs spécifiques',
              },
            },
            fields: [
              { name: 'slugPattern', type: 'text', required: true, admin: { description: { en: 'Pattern (e.g. home, blog/*, services/*)', fr: 'Pattern (ex: home, blog/*, services/*)' } } },
              { name: 'priority', type: 'number', required: true, min: 0, max: 1, admin: { step: 0.1 } },
              {
                name: 'changefreq',
                type: 'select',
                options: [
                  { label: { en: 'Daily', fr: 'Quotidien' }, value: 'daily' },
                  { label: { en: 'Weekly', fr: 'Hebdomadaire' }, value: 'weekly' },
                  { label: { en: 'Monthly', fr: 'Mensuel' }, value: 'monthly' },
                  { label: { en: 'Yearly', fr: 'Annuel' }, value: 'yearly' },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'robotsCustomRules',
        type: 'textarea',
        label: 'Custom robots.txt rules',
        admin: {
          description:
            'Additional rules to include in robots.txt (one per line). Example: Disallow: /private/',
        },
      },
      {
        name: 'breadcrumb',
        type: 'group',
        label: { en: 'Breadcrumb configuration', fr: 'Configuration Breadcrumb' },
        fields: [
          {
            name: 'enabled',
            type: 'checkbox',
            label: { en: 'Enable breadcrumbs', fr: 'Activer les breadcrumbs' },
            defaultValue: true,
          },
          {
            name: 'homeLabel',
            type: 'text',
            label: { en: 'Home page label', fr: "Label page d'accueil" },
            defaultValue: 'Accueil',
          },
          {
            name: 'separator',
            type: 'select',
            label: { en: 'Separator', fr: 'Séparateur' },
            defaultValue: '>',
            options: [
              { label: '>', value: '>' },
              { label: '/', value: '/' },
              { label: '\u00BB', value: '\u00BB' },
              { label: '\u2192', value: '\u2192' },
            ],
          },
          {
            name: 'showOnHome',
            type: 'checkbox',
            label: { en: 'Show on the home page', fr: "Afficher sur la page d'accueil" },
            defaultValue: false,
          },
        ],
      },
    ],
  }
}
