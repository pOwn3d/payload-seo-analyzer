/**
 * SEO Plugin — Lightweight i18n translation system.
 * Provides French (default) and English translations for all plugin views.
 * No external dependencies.
 */

export type SeoLocale = 'fr' | 'en'

// Translation keys organized by view/section
export interface SeoTranslations {
  // Common
  common: {
    loading: string
    error: string
    save: string
    cancel: string
    refresh: string
    export: string
    exportCsv: string
    search: string
    noResults: string
    total: string
    actions: string
    edit: string
    delete: string
    add: string
    close: string
    copy: string
    copied: string
    confirm: string
    back: string
  }
  // Nav
  nav: {
    seoGroup: string
    dashboard: string
    sitemapAudit: string
    redirects: string
    cannibalization: string
    configuration: string
    schemaBuilder: string
    performance: string
    keywordResearch: string
    linkGraph: string
  }
  // Dashboard
  dashboard: {
    title: string
    totalPages: string
    avgScore: string
    good: string
    needsWork: string
    critical: string
    noKeyword: string
    exportPdf: string
    filters: { noMeta: string; noH1: string; lowReadability: string }
  }
  // Link graph
  linkGraph: {
    title: string
    subtitle: string
    nodes: string
    edges: string
    orphanNodes: string
    hubNodes: string
    zoomIn: string
    zoomOut: string
    resetView: string
    showLabels: string
    hideLabels: string
    filterByCollection: string
    all: string
    clickToOpen: string
    incomingLinks: string
    outgoingLinks: string
  }
  // Schema builder
  schemaBuilder: {
    title: string
    selectType: string
    preview: string
    copyJsonLd: string
    copyScript: string
  }
  // Performance
  performance: {
    title: string
    period7d: string
    period30d: string
    period90d: string
    totalClicks: string
    totalImpressions: string
    avgCtr: string
    avgPosition: string
    topPages: string
    topQueries: string
    importData: string
    importCsv: string
    noData: string
  }
  // Keyword research
  keywordResearch: {
    title: string
    unused: string
    related: string
    trending: string
    longTail: string
    suggestedFor: string
    usedBy: string
    frequency: string
    score: string
  }
}

// ---------------------------------------------------------------------------
// French translations (default)
// ---------------------------------------------------------------------------

const fr: SeoTranslations = {
  common: {
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
    save: 'Sauvegarder',
    cancel: 'Annuler',
    refresh: 'Rafraichir',
    export: 'Exporter',
    exportCsv: 'Exporter CSV',
    search: 'Rechercher...',
    noResults: 'Aucun resultat',
    total: 'Total',
    actions: 'Actions',
    edit: 'Editer',
    delete: 'Supprimer',
    add: 'Ajouter',
    close: 'Fermer',
    copy: 'Copier',
    copied: 'Copie !',
    confirm: 'Confirmer',
    back: 'Retour',
  },
  nav: {
    seoGroup: 'SEO',
    dashboard: 'Dashboard SEO',
    sitemapAudit: 'Audit Sitemap',
    redirects: 'Redirections',
    cannibalization: 'Cannibalisation',
    configuration: 'Configuration',
    schemaBuilder: 'Schema Builder',
    performance: 'Performance',
    keywordResearch: 'Recherche mots-cles',
    linkGraph: 'Graphe de liens',
  },
  dashboard: {
    title: 'Dashboard SEO',
    totalPages: 'Pages totales',
    avgScore: 'Score moyen',
    good: 'Bonnes',
    needsWork: 'A ameliorer',
    critical: 'Critiques',
    noKeyword: 'Sans mot-cle',
    exportPdf: 'Exporter PDF',
    filters: {
      noMeta: 'Sans meta',
      noH1: 'Sans H1',
      lowReadability: 'Lisib. faible',
    },
  },
  linkGraph: {
    title: 'Graphe de liens internes',
    subtitle: 'Visualisation de la structure de liens',
    nodes: 'Pages',
    edges: 'Liens',
    orphanNodes: 'Orphelines',
    hubNodes: 'Hubs',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom -',
    resetView: 'Reinitialiser',
    showLabels: 'Afficher les labels',
    hideLabels: 'Masquer les labels',
    filterByCollection: 'Filtrer par collection',
    all: 'Toutes',
    clickToOpen: 'Cliquer pour ouvrir',
    incomingLinks: 'Liens entrants',
    outgoingLinks: 'Liens sortants',
  },
  schemaBuilder: {
    title: 'Schema.org Builder',
    selectType: 'Choisir un type de schema',
    preview: 'Apercu JSON-LD',
    copyJsonLd: 'Copier le JSON-LD',
    copyScript: 'Copier la balise script',
  },
  performance: {
    title: 'Performance SEO',
    period7d: '7 jours',
    period30d: '30 jours',
    period90d: '90 jours',
    totalClicks: 'Clics',
    totalImpressions: 'Impressions',
    avgCtr: 'CTR moyen',
    avgPosition: 'Position moy.',
    topPages: 'Top pages',
    topQueries: 'Top requetes',
    importData: 'Importer des donnees',
    importCsv: 'Importer CSV',
    noData: 'Aucune donnee. Importez vos donnees Google Search Console.',
  },
  keywordResearch: {
    title: 'Recherche de mots-cles',
    unused: 'Non utilise',
    related: 'Associe',
    trending: 'Tendance',
    longTail: 'Longue traine',
    suggestedFor: 'Suggere pour',
    usedBy: 'Utilise par',
    frequency: 'Frequence',
    score: 'Score',
  },
}

// ---------------------------------------------------------------------------
// English translations
// ---------------------------------------------------------------------------

const en: SeoTranslations = {
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    save: 'Save',
    cancel: 'Cancel',
    refresh: 'Refresh',
    export: 'Export',
    exportCsv: 'Export CSV',
    search: 'Search...',
    noResults: 'No results',
    total: 'Total',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied!',
    confirm: 'Confirm',
    back: 'Back',
  },
  nav: {
    seoGroup: 'SEO',
    dashboard: 'SEO Dashboard',
    sitemapAudit: 'Sitemap Audit',
    redirects: 'Redirects',
    cannibalization: 'Cannibalization',
    configuration: 'Configuration',
    schemaBuilder: 'Schema Builder',
    performance: 'Performance',
    keywordResearch: 'Keyword Research',
    linkGraph: 'Link Graph',
  },
  dashboard: {
    title: 'SEO Dashboard',
    totalPages: 'Total pages',
    avgScore: 'Average score',
    good: 'Good',
    needsWork: 'Needs work',
    critical: 'Critical',
    noKeyword: 'No keyword',
    exportPdf: 'Export PDF',
    filters: {
      noMeta: 'No meta',
      noH1: 'No H1',
      lowReadability: 'Low readability',
    },
  },
  linkGraph: {
    title: 'Internal Link Graph',
    subtitle: 'Link structure visualization',
    nodes: 'Pages',
    edges: 'Links',
    orphanNodes: 'Orphan',
    hubNodes: 'Hubs',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetView: 'Reset view',
    showLabels: 'Show labels',
    hideLabels: 'Hide labels',
    filterByCollection: 'Filter by collection',
    all: 'All',
    clickToOpen: 'Click to open',
    incomingLinks: 'Incoming links',
    outgoingLinks: 'Outgoing links',
  },
  schemaBuilder: {
    title: 'Schema.org Builder',
    selectType: 'Select a schema type',
    preview: 'JSON-LD Preview',
    copyJsonLd: 'Copy JSON-LD',
    copyScript: 'Copy script tag',
  },
  performance: {
    title: 'SEO Performance',
    period7d: '7 days',
    period30d: '30 days',
    period90d: '90 days',
    totalClicks: 'Clicks',
    totalImpressions: 'Impressions',
    avgCtr: 'Avg CTR',
    avgPosition: 'Avg position',
    topPages: 'Top pages',
    topQueries: 'Top queries',
    importData: 'Import data',
    importCsv: 'Import CSV',
    noData: 'No data. Import your Google Search Console data.',
  },
  keywordResearch: {
    title: 'Keyword Research',
    unused: 'Unused',
    related: 'Related',
    trending: 'Trending',
    longTail: 'Long-tail',
    suggestedFor: 'Suggested for',
    usedBy: 'Used by',
    frequency: 'Frequency',
    score: 'Score',
  },
}

// ---------------------------------------------------------------------------
// Translation registry and accessors
// ---------------------------------------------------------------------------

const translations: Record<SeoLocale, SeoTranslations> = { fr, en }

/** Get translations for a locale. Falls back to French. */
export function getTranslations(locale?: string): SeoTranslations {
  const key = (locale?.startsWith('en') ? 'en' : 'fr') as SeoLocale
  return translations[key] || translations.fr
}

/** Shorthand: get a translation value by dot-path */
export function t(locale: string | undefined, path: string): string {
  const trans = getTranslations(locale)
  const keys = path.split('.')
  let result: unknown = trans
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return path // fallback: return the key path
    }
  }
  return typeof result === 'string' ? result : path
}
