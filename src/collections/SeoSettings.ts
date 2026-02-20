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

export function createSeoSettingsCollection(): CollectionConfig {
  return {
    slug: 'seo-settings',
    admin: {
      hidden: true,
    },
    access: {
      read: ({ req }) => !!req.user,
      update: ({ req }) => !!req.user,
      create: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
    },
    fields: [
      {
        name: 'siteName',
        type: 'text',
        label: 'Nom du site',
        admin: {
          description: "Utilise pour la verification de marque dans les titres",
        },
      },
      {
        name: 'ignoredSlugs',
        type: 'array',
        label: 'Slugs ignores',
        admin: {
          description: "Pages exclues de l'audit SEO (ex: mentions-legales, cgv)",
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
        label: 'Regles desactivees',
        admin: {
          description: "Groupes de regles a ignorer lors de l'analyse",
        },
        options: [
          { label: 'Titre', value: 'title' },
          { label: 'Meta description', value: 'meta-description' },
          { label: 'URL / Slug', value: 'url' },
          { label: 'Titres H1-H6', value: 'headings' },
          { label: 'Contenu', value: 'content' },
          { label: 'Images', value: 'images' },
          { label: 'Liens', value: 'linking' },
          { label: 'Reseaux sociaux', value: 'social' },
          { label: 'Donnees structurees', value: 'schema' },
          { label: 'Lisibilite', value: 'readability' },
          { label: 'Qualite', value: 'quality' },
          { label: 'Mots-cles secondaires', value: 'secondary-keywords' },
          { label: 'Contenu pilier', value: 'cornerstone' },
          { label: 'Fraicheur', value: 'freshness' },
          { label: 'Technique', value: 'technical' },
          { label: 'Accessibilite', value: 'accessibility' },
          { label: 'E-commerce', value: 'ecommerce' },
        ],
      },
      {
        name: 'thresholds',
        type: 'group',
        label: 'Seuils personnalises',
        admin: {
          description: 'Laissez vide pour utiliser les valeurs par defaut',
        },
        fields: [
          { name: 'titleLengthMin', type: 'number', label: 'Titre — longueur min', admin: { description: 'Defaut: 30' } },
          { name: 'titleLengthMax', type: 'number', label: 'Titre — longueur max', admin: { description: 'Defaut: 60' } },
          { name: 'metaDescLengthMin', type: 'number', label: 'Meta desc — longueur min', admin: { description: 'Defaut: 120' } },
          { name: 'metaDescLengthMax', type: 'number', label: 'Meta desc — longueur max', admin: { description: 'Defaut: 160' } },
          { name: 'minWordsGeneric', type: 'number', label: 'Mots min (pages)', admin: { description: 'Defaut: 300' } },
          { name: 'minWordsPost', type: 'number', label: 'Mots min (articles)', admin: { description: 'Defaut: 800' } },
          { name: 'keywordDensityMin', type: 'number', label: 'Densite mot-cle min (%)', admin: { description: 'Defaut: 0.5' } },
          { name: 'keywordDensityMax', type: 'number', label: 'Densite mot-cle max (%)', admin: { description: 'Defaut: 3' } },
          { name: 'fleschScorePass', type: 'number', label: 'Score Flesch min', admin: { description: 'Defaut: 40' } },
          { name: 'slugMaxLength', type: 'number', label: 'Longueur max slug', admin: { description: 'Defaut: 75' } },
        ],
      },
      {
        name: 'sitemap',
        type: 'group',
        label: 'Configuration Sitemap',
        fields: [
          {
            name: 'excludedSlugs',
            type: 'array',
            label: 'Slugs exclus du sitemap',
            admin: { description: 'Pages a exclure de la generation du sitemap' },
            fields: [{ name: 'slug', type: 'text', required: true }],
          },
          {
            name: 'defaultChangefreq',
            type: 'select',
            label: 'Frequence par defaut',
            defaultValue: 'weekly',
            options: [
              { label: 'Quotidien', value: 'daily' },
              { label: 'Hebdomadaire', value: 'weekly' },
              { label: 'Mensuel', value: 'monthly' },
              { label: 'Annuel', value: 'yearly' },
            ],
          },
          {
            name: 'defaultPriority',
            type: 'number',
            label: 'Priorite par defaut',
            min: 0,
            max: 1,
            admin: { step: 0.1, description: 'Valeur entre 0 et 1 (defaut: 0.5)' },
          },
          {
            name: 'priorityOverrides',
            type: 'array',
            label: 'Priorites personnalisees',
            admin: { description: 'Definir la priorite pour des patterns de slugs specifiques' },
            fields: [
              { name: 'slugPattern', type: 'text', required: true, admin: { description: 'Pattern (ex: home, blog/*, services/*)' } },
              { name: 'priority', type: 'number', required: true, min: 0, max: 1, admin: { step: 0.1 } },
              {
                name: 'changefreq',
                type: 'select',
                options: [
                  { label: 'Quotidien', value: 'daily' },
                  { label: 'Hebdomadaire', value: 'weekly' },
                  { label: 'Mensuel', value: 'monthly' },
                  { label: 'Annuel', value: 'yearly' },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'breadcrumb',
        type: 'group',
        label: 'Configuration Breadcrumb',
        fields: [
          {
            name: 'enabled',
            type: 'checkbox',
            label: 'Activer les breadcrumbs',
            defaultValue: true,
          },
          {
            name: 'homeLabel',
            type: 'text',
            label: "Label page d'accueil",
            defaultValue: 'Accueil',
          },
          {
            name: 'separator',
            type: 'select',
            label: 'Separateur',
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
            label: "Afficher sur la page d'accueil",
            defaultValue: false,
          },
        ],
      },
    ],
  }
}
