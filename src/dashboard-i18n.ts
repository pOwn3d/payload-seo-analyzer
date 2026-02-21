/**
 * Dashboard i18n — FR/EN translations for all dashboard UI components.
 * Provides a simple, pragmatic translation system for the SEO Analyzer dashboard.
 */

export type DashboardLocale = 'fr' | 'en'

export interface DashboardTranslations {
  common: {
    loading: string
    loadingError: string
    retry: string
    save: string
    saving: string
    cancel: string
    refresh: string
    exportCsv: string
    exportJson: string
    exportPdf: string
    edit: string
    delete: string
    add: string
    noResults: string
    previous: string
    next: string
    page: string
    selected: string
    deselectAll: string
    characters: string
    generate: string
    generating: string
    copy: string
    serverError: string
    networkError: string
    noTitle: string
    none: string
    article: string
    ok: string
    modify: string
  }
  nav: {
    dashboard: string
    sitemapAudit: string
    redirects: string
    cannibalization: string
    performance: string
    keywords: string
    schemaOrg: string
    linkGraph: string
    settings: string
    seo: string
  }
  seoView: {
    loadingAudit: string
    errorSaving: string
    auditTitle: string
    pagesAnalyzed: string
    markCornerstone: string
    unmarkCornerstone: string
    searchPlaceholder: string
    allCollections: string
    allScores: string
    goodScores: string
    needsWork: string
    criticalScores: string
    missingMeta: string
    missingH1: string
    lowReadability: string
    averageScore: string
    goodLabel: string
    needsWorkLabel: string
    criticalLabel: string
    noKeyword: string
    wordsAvg: string
    metaTitle: string
    metaDesc: string
    cornerstone: string
    collection: string
    score: string
    keyword: string
    h1: string
    og: string
    internal: string
    external: string
    words: string
    readability: string
    updated: string
    seoReport: string
    overview: string
    missingMetaTitle: string
    missingMetaDescription: string
    missingKeyword: string
    shortContent: string
    lowReadabilityIssue: string
    missingOgImage: string
    noInternalLinks: string
    lowOverallScore: string
    shortMetaTitle: string
    longMetaTitle: string
    shortMetaDesc: string
    longMetaDesc: string
    top5PriorityActions: string
    perPageDetails: string
    title: string
    slug: string
    issues: string
    identifiedIssues: string
    scoreDistribution: string
    good: string
    critical: string
    generatedBy: string
    resultsDisplayed: string
    noKeywordLabel: string
    wordsAverage: string
    readabilityAvg: string
    noTitleDesc: string
    previousLabel: string
  }
  sitemapAudit: {
    loading404: string
    title: string
    totalPages: string
    internalLinks: string
    linksPerPage: string
    average: string
    orphaned: string
    fragile: string
    brokenLinks: string
    searchPlaceholder: string
    orphanedPages: string
    fragilePages: string
    linkHubs: string
    logs404: string
    externalLinks: string
    noOrphanedPages: string
    orphanedPagesDesc: string
    zeroIncomingLinks: string
    noFragilePages: string
    fragilePagesDesc: string
    oneIncomingLink: string
    from: string
    anchor: string
    noLinkHubs: string
    linkHubsDesc: string
    links: string
    brokenLinksDesc: string
    created: string
    errors: string
    selectedItems: string
    selectAll: string
    suggestion: string
    targetSlug: string
    createdLabel: string
    no404Errors: string
    pages404Desc: string
    last: string
    ref: string
    ignore: string
    checkExternalLinksDesc: string
    scanExternalLinks: string
    verificationInProgress: string
    noBrokenLinks: string
    noExternalLinks: string
    total: string
    broken: string
    timeout: string
    all: string
    brokenLabel: string
    rescan: string
    forceNewVerification: string
    analyzingInternal: string
    brokenLinkTo: string
    linkFrom: string
  }
  seoConfig: {
    loading: string
    title: string
    subtitle: string
    saved: string
    siteName: string
    siteNameDesc: string
    ignoredPages: string
    ignoredPagesDesc: string
    pageSlugPlaceholder: string
    noIgnoredSlugs: string
    disabledRules: string
    disabledRulesDesc: string
    customThresholds: string
    customThresholdsDesc: string
    defaultLabel: string
    ruleGroupTitle: string
    ruleGroupMetaDescription: string
    ruleGroupUrlSlug: string
    ruleGroupHeadings: string
    ruleGroupContent: string
    ruleGroupImages: string
    ruleGroupLinks: string
    ruleGroupSocial: string
    ruleGroupStructuredData: string
    ruleGroupReadability: string
    ruleGroupQuality: string
    ruleGroupSecondaryKeywords: string
    ruleGroupCornerstone: string
    ruleGroupFreshness: string
    ruleGroupTechnical: string
    ruleGroupAccessibility: string
    ruleGroupEcommerce: string
    thresholdTitleMin: string
    thresholdTitleMax: string
    thresholdMetaDescMin: string
    thresholdMetaDescMax: string
    thresholdMinWordsPages: string
    thresholdMinWordsPosts: string
    thresholdKeywordDensityMin: string
    thresholdKeywordDensityMax: string
    thresholdFleschMin: string
    thresholdSlugMaxLength: string
    sitemapConfig: string
    sitemapExcludedSlugs: string
    slugToExcludePlaceholder: string
    noExcludedSlugs: string
    defaultChangeFrequency: string
    daily: string
    weekly: string
    monthly: string
    yearly: string
    defaultPriority: string
    defaultPriorityDesc: string
    priorityOverrides: string
    priorityOverridesDesc: string
    patternPlaceholder: string
    priority: string
    defaultShort: string
    addOverride: string
    sitemapPreview: string
    viewPreview: string
    refreshPreview: string
    pages: string
    included: string
    excluded: string
    url: string
    lastModified: string
    frequency: string
    breadcrumbConfig: string
    breadcrumbConfigDesc: string
    enableBreadcrumbs: string
    homePageLabel: string
    separator: string
    separatorDesc: string
    showOnHomePage: string
    showOnHomePageDesc: string
    preview: string
    websiteCreation: string
  }
  redirectManager: {
    loading: string
    title: string
    totalRedirects: string
    importCsv: string
    total: string
    permanent301: string
    temporary302: string
    addRedirect: string
    sourceUrl: string
    sourceUrlPlaceholder: string
    destinationUrl: string
    destinationUrlPlaceholder: string
    type: string
    adding: string
    searchPlaceholder: string
    urlToTestPlaceholder: string
    test: string
    noMatch: string
    sourceFrom: string
    destinationTo: string
    date: string
    actions: string
    noMatchingRedirects: string
    noRedirects: string
    redirectCreated: string
    redirectDeleted: string
    redirectsDeleted: string
    redirectModified: string
    noValidCsvRedirects: string
    redirectsExported: string
    exportError: string
    createdCount: string
    duplicatesCount: string
    errorsCount: string
  }
  performance: {
    days7: string
    days30: string
    days90: string
    loading: string
    title: string
    subtitle: string
    closeImport: string
    import: string
    importGscData: string
    fileType: string
    pasteJsonHint: string
    importing: string
    importedCount: string
    updatedCount: string
    noData: string
    noDataDesc: string
    importData: string
    totalClicks: string
    totalImpressions: string
    averageCtr: string
    averagePosition: string
    topPages: string
    clicks: string
    impressions: string
    ctrPercent: string
    position: string
    topQueries: string
    query: string
    xlsxEntriesLoaded: string
    pages: string
    queries: string
  }
  schemaBuilder: {
    localBusiness: string
    article: string
    product: string
    faq: string
    howTo: string
    organization: string
    event: string
    choose: string
    jsonLdPreview: string
    liveUpdate: string
    copyJsonLd: string
    copyScriptTag: string
    copied: string
    copyError: string
    tip: string
    beforeDeploying: string
    visualGeneratorDesc: string
    addButton: string
    name: string
    description: string
    address: string
    city: string
    postalCode: string
    country: string
    phone: string
    email: string
    openingHours: string
    latitude: string
    longitude: string
    website: string
    contactEmail: string
    socialMediaUrls: string
    startDate: string
    endDate: string
    location: string
    locationAddress: string
    ticketUrl: string
    title: string
    author: string
    publisher: string
    imageUrl: string
    publicationDate: string
    sku: string
    brand: string
    price: string
    currency: string
    availability: string
    inStock: string
    outOfStock: string
    preOrder: string
    madeToOrder: string
    questionsAnswers: string
    question: string
    answer: string
    steps: string
    stepTitle: string
    stepDescription: string
    priceRange: string
    modificationDate: string
    publisherName: string
    publisherLogo: string
    productName: string
    reviewCount: string
    ratingValue: string
    guideTitle: string
    logoUrl: string
    imageLabel: string
    urlLabel: string
    validateOnRichResults: string
  }
  keywordResearch: {
    loading: string
    title: string
    subtitle: string
    activeKeywords: string
    uniqueTerms: string
    suggestions: string
    searchPlaceholder: string
    noSuggestions: string
    noSuggestionsDesc: string
    noMatchingSuggestions: string
    unused: string
    associated: string
    trending: string
    longTail: string
    all: string
    unusedPlural: string
    associatedPlural: string
    trendingPlural: string
    keyword: string
    freq: string
    seeLess: string
    type: string
    score: string
    frequency: string
    usedBy: string
    suggestedFor: string
  }
  cannibalization: {
    loading: string
    title: string
    subtitle: string
    conflicts: string
    affectedPages: string
    searchPlaceholder: string
    noCannibalization: string
    noCannibalizationDesc: string
    noMatchingConflicts: string
    highRisk: string
    warning: string
    pages: string
  }
  seoAnalyzer: {
    groupTitle: string
    groupDescription: string
    groupUrlSlug: string
    groupHeadings: string
    groupContent: string
    groupImages: string
    groupLinks: string
    groupSocial: string
    groupStructuredData: string
    groupReadability: string
    groupQuality: string
    groupSecondaryKeywords: string
    groupCornerstone: string
    groupFreshness: string
    groupTechnical: string
    groupAccessibility: string
    groupEcommerce: string
    levelExcellent: string
    levelGood: string
    levelFair: string
    levelNeedsImprovement: string
    categoryCritical: string
    categoryImportant: string
    categoryBonus: string
    seoScore: string
    outOf100: string
    cornerstoneLabel: string
    checksPassed: string
    errorsCount: string
    warningsCount: string
    improvementSuggestions: string
    adjustTitle: string
    currently: string
    titleCharactersIdeal: string
    writeMetaDesc: string
    enrichContent: string
    includeKeywordInTitle: string
    includeKeywordInDesc: string
    addAltText: string
    addInternalLinks: string
    seoCannibalization: string
    highRisk: string
    duplicationHarmsRanking: string
    diluteRanking: string
    viewPages: string
    uniqueKeywordAdvice: string
    suggestedInternalLinks: string
    analyzingContent: string
    readingTime: string
    wordsLabel: string
    secondaryKeywords: string
    generateMeta: string
    metaTitle: string
    metaDescription: string
    emptyValue: string
  }
  scoreHistory: {
    loading: string
    loadingError: string
    noHistory: string
    noHistoryDesc: string
    improving: string
    declining: string
    stable: string
    scoreEvolution: string
    measures: string
    latestScore: string
  }
  contentDecay: {
    title: string
    lessThan3Months: string
    months3to6: string
    months6to12: string
    moreThan12Months: string
    description: string
    lastUpdate: string
    lastReview: string
    ageDays: string
    action: string
    reviewed: string
    markReviewed: string
    noData: string
  }
  socialPreview: {
    title: string
    facebook: string
    twitter: string
    ogImage: string
    cardImage: string
    previewTitle: string
    previewDescription: string
    characters: string
    pageTitlePlaceholder: string
    pageDescriptionPlaceholder: string
  }
  serpPreview: {
    title: string
    desktop: string
    mobile: string
    noMetaTitle: string
    noMetaDescription: string
    previewTitle: string
    previewDescription: string
    url: string
    characters: string
  }
  metaTitle: {
    label: string
    placeholder: string
    characters: string
    optimal: string
    charactersMissing: string
    charactersTooMany: string
    idealLength: string
  }
  metaDescription: {
    label: string
    placeholder: string
    characters: string
    optimal: string
    charactersMissing: string
    charactersTooMany: string
    idealLength: string
  }
  metaImage: {
    label: string
    imageSet: string
    noImage: string
    set: string
  }
  overview: {
    metaCompleteness: string
    incomplete: string
    partial: string
    almostComplete: string
    complete: string
    titleLabel: string
    descriptionLabel: string
    imageLabel: string
    set: string
    missing: string
  }
}

// ---------------------------------------------------------------------------
// French translations
// ---------------------------------------------------------------------------

const fr: DashboardTranslations = {
  common: {
    loading: 'Chargement...',
    loadingError: 'Erreur de chargement',
    retry: 'Réessayer',
    save: 'Sauvegarder',
    saving: 'Sauvegarde...',
    cancel: 'Annuler',
    refresh: 'Rafraîchir',
    exportCsv: 'Export CSV',
    exportJson: 'Export JSON',
    exportPdf: 'Export PDF',
    edit: 'Éditer',
    delete: 'Supprimer',
    add: 'Ajouter',
    noResults: 'Aucun résultat.',
    previous: 'Précédent',
    next: 'Suivant',
    page: 'Page',
    selected: 'sélectionné',
    deselectAll: 'Tout désélectionner',
    characters: 'caractères',
    generate: 'Générer',
    generating: 'Génération...',
    copy: 'Copier',
    serverError: 'Erreur serveur',
    networkError: 'Erreur réseau',
    noTitle: '(sans titre)',
    none: 'Aucun',
    article: 'Article',
    ok: 'OK',
    modify: 'Modifier',
  },
  nav: {
    dashboard: 'Dashboard',
    sitemapAudit: 'Audit Sitemap',
    redirects: 'Redirections',
    cannibalization: 'Cannibalisation',
    performance: 'Performance',
    keywords: 'Mots-clés',
    schemaOrg: 'Schema.org',
    linkGraph: 'Graphe de liens',
    settings: 'Configuration',
    seo: 'SEO',
  },
  seoView: {
    loadingAudit: 'Chargement de l\'audit SEO...',
    errorSaving: 'Erreur lors de la sauvegarde',
    auditTitle: 'Audit SEO',
    pagesAnalyzed: 'pages analysées',
    markCornerstone: 'Marquer pilier',
    unmarkCornerstone: 'Démarquer pilier',
    searchPlaceholder: 'Rechercher (titre, slug, keyword)...',
    allCollections: 'Toutes les collections',
    allScores: 'Tous les scores',
    goodScores: 'Bonnes (>=80)',
    needsWork: 'À améliorer (50-79)',
    criticalScores: 'Critiques (<50)',
    missingMeta: 'Sans meta',
    missingH1: 'H1 manquant',
    lowReadability: 'Lisib. faible',
    averageScore: 'Score moyen',
    goodLabel: 'Bonnes (>=80)',
    needsWorkLabel: 'À améliorer',
    criticalLabel: 'Critiques (<50)',
    noKeyword: 'Sans keyword',
    wordsAvg: 'Mots (moy.)',
    metaTitle: 'META TITLE',
    metaDesc: 'META DESC',
    cornerstone: 'PILIER',
    collection: 'Collection',
    score: 'Score',
    keyword: 'Mot-clé',
    h1: 'H1',
    og: 'OG',
    internal: 'Int.',
    external: 'Ext.',
    words: 'Mots',
    readability: 'Lisib.',
    updated: 'MAJ',
    seoReport: 'Rapport SEO',
    overview: 'Vue d\'ensemble',
    missingMetaTitle: 'Meta title manquant',
    missingMetaDescription: 'Meta description manquante',
    missingKeyword: 'Mot-clé manquant',
    shortContent: 'Contenu court',
    lowReadabilityIssue: 'Lisibilité faible',
    missingOgImage: 'Image OG manquante',
    noInternalLinks: 'Aucun lien interne',
    lowOverallScore: 'Score général faible',
    shortMetaTitle: 'Meta title court',
    longMetaTitle: 'Meta title long',
    shortMetaDesc: 'Meta desc. courte',
    longMetaDesc: 'Meta desc. longue',
    top5PriorityActions: 'Top 5 — Actions prioritaires',
    perPageDetails: 'Détail par page',
    title: 'Titre',
    slug: 'Slug',
    issues: 'Problèmes',
    identifiedIssues: 'Problèmes identifiés',
    scoreDistribution: 'Distribution des scores',
    good: 'Bonnes',
    critical: 'Critiques',
    generatedBy: 'Généré par SEO Analyzer',
    resultsDisplayed: 'résultats affichés',
    noKeywordLabel: 'Sans mot-clé',
    wordsAverage: 'Mots (moyenne)',
    readabilityAvg: 'Lisibilité (moy.)',
    noTitleDesc: 'Sans title / desc',
    previousLabel: 'Précédent:',
  },
  sitemapAudit: {
    loading404: 'Chargement des logs 404...',
    title: 'Audit Sitemap & Maillage',
    totalPages: 'Pages total',
    internalLinks: 'Liens internes',
    linksPerPage: 'Liens / page',
    average: 'Moyenne',
    orphaned: 'Orphelines',
    fragile: 'Fragiles',
    brokenLinks: 'Liens cassés',
    searchPlaceholder: 'Rechercher (titre, slug, URL cible)...',
    orphanedPages: 'Pages orphelines',
    fragilePages: 'Pages fragiles',
    linkHubs: 'Hubs de liens',
    logs404: 'Logs 404',
    externalLinks: 'Liens externes',
    noOrphanedPages: 'Aucune page orpheline détectée. Toutes les pages sont accessibles via des liens internes.',
    orphanedPagesDesc: 'Pages sans aucun lien interne entrant (inaccessibles depuis les autres pages)',
    zeroIncomingLinks: '0 liens entrants',
    noFragilePages: 'Aucune page fragile détectée. Toutes les pages ont au moins 2 liens internes entrants.',
    fragilePagesDesc: 'Pages avec un seul lien interne entrant (fragiles — si ce lien disparaît, la page devient orpheline)',
    oneIncomingLink: '1 lien entrant',
    from: 'depuis:',
    anchor: 'ancre:',
    noLinkHubs: 'Aucun hub de liens détecté (aucune page avec plus de 10 liens sortants).',
    linkHubsDesc: 'Pages avec plus de 10 liens internes sortants — ces pages distribuent beaucoup de PageRank',
    links: 'liens',
    brokenLinksDesc: 'Liens internes pointant vers des slugs inexistants — à corriger ou rediriger',
    created: 'créées',
    errors: 'erreurs',
    selectedItems: 'sélectionné(s)',
    selectAll: 'Tout sélectionner',
    suggestion: 'Suggestion:',
    targetSlug: 'slug cible',
    createdLabel: 'Créée',
    no404Errors: 'Aucune erreur 404 enregistrée. Activez le logging dans votre middleware Next.js.',
    pages404Desc: 'Pages 404 visitées par vos utilisateurs — créez des redirections 301 pour les corriger',
    last: 'Dernier:',
    ref: 'Réf:',
    ignore: 'Ignorer',
    checkExternalLinksDesc: 'Vérifiez les liens externes de votre site pour détecter les liens cassés.',
    scanExternalLinks: 'Scanner les liens externes',
    verificationInProgress: 'Vérification en cours... (cela peut prendre quelques secondes)',
    noBrokenLinks: 'Aucun lien cassé détecté.',
    noExternalLinks: 'Aucun lien externe trouvé.',
    total: 'total',
    broken: 'cassés',
    timeout: 'timeout',
    all: 'Tous',
    brokenLabel: 'Cassés',
    rescan: 'Rescanner',
    forceNewVerification: 'Forcer une nouvelle vérification',
    analyzingInternal: 'Analyse du maillage interne en cours...',
    brokenLinkTo: 'lien cassé vers',
    linkFrom: 'lien depuis',
  },
  seoConfig: {
    loading: 'Chargement de la configuration...',
    title: 'Configuration SEO',
    subtitle: 'Paramètres globaux du moteur d\'analyse SEO',
    saved: 'Configuration sauvegardée',
    siteName: 'Nom du site',
    siteNameDesc: 'Utilisé pour la vérification de marque dans les titres (éviter la duplication du nom du site)',
    ignoredPages: 'Pages ignorées',
    ignoredPagesDesc: 'Pages exclues de l\'audit SEO global',
    pageSlugPlaceholder: 'slug-de-la-page',
    noIgnoredSlugs: 'Aucun slug ignoré',
    disabledRules: 'Règles désactivées',
    disabledRulesDesc: 'Cochez les groupes de règles à ignorer lors de l\'analyse. Les règles désactivées ne seront pas exécutées.',
    customThresholds: 'Seuils personnalisés',
    customThresholdsDesc: 'Laissez vide pour utiliser les valeurs par défaut. Les seuils contrôlent les limites min/max de chaque règle.',
    defaultLabel: 'Défaut:',
    ruleGroupTitle: 'Titre',
    ruleGroupMetaDescription: 'Meta description',
    ruleGroupUrlSlug: 'URL / Slug',
    ruleGroupHeadings: 'Titres H1-H6',
    ruleGroupContent: 'Contenu',
    ruleGroupImages: 'Images',
    ruleGroupLinks: 'Liens',
    ruleGroupSocial: 'Réseaux sociaux',
    ruleGroupStructuredData: 'Données structurées',
    ruleGroupReadability: 'Lisibilité',
    ruleGroupQuality: 'Qualité',
    ruleGroupSecondaryKeywords: 'Mots-clés secondaires',
    ruleGroupCornerstone: 'Contenu pilier',
    ruleGroupFreshness: 'Fraîcheur',
    ruleGroupTechnical: 'Technique',
    ruleGroupAccessibility: 'Accessibilité',
    ruleGroupEcommerce: 'E-commerce',
    thresholdTitleMin: 'Titre — longueur min',
    thresholdTitleMax: 'Titre — longueur max',
    thresholdMetaDescMin: 'Meta desc — longueur min',
    thresholdMetaDescMax: 'Meta desc — longueur max',
    thresholdMinWordsPages: 'Mots min (pages)',
    thresholdMinWordsPosts: 'Mots min (articles)',
    thresholdKeywordDensityMin: 'Densité mot-clé min (%)',
    thresholdKeywordDensityMax: 'Densité mot-clé max (%)',
    thresholdFleschMin: 'Score Flesch min',
    thresholdSlugMaxLength: 'Longueur max slug',
    sitemapConfig: 'Configuration Sitemap',
    sitemapExcludedSlugs: 'Slugs exclus du sitemap',
    slugToExcludePlaceholder: 'slug-à-exclure',
    noExcludedSlugs: 'Aucun slug exclu',
    defaultChangeFrequency: 'Fréquence par défaut',
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    defaultPriority: 'Priorité par défaut',
    defaultPriorityDesc: 'Valeur entre 0 et 1 (défaut: 0.5)',
    priorityOverrides: 'Overrides de priorité',
    priorityOverridesDesc: 'Définir la priorité pour des patterns de slugs spécifiques',
    patternPlaceholder: 'Pattern (ex: blog/*)',
    priority: 'Priorité',
    defaultShort: 'Défaut',
    addOverride: '+ Ajouter un override',
    sitemapPreview: 'Aperçu du sitemap',
    viewPreview: 'Voir l\'aperçu',
    refreshPreview: 'Rafraîchir l\'aperçu',
    pages: 'pages',
    included: 'incluses',
    excluded: 'exclues',
    url: 'URL',
    lastModified: 'Dernière modif.',
    frequency: 'Fréquence',
    breadcrumbConfig: 'Configuration Breadcrumb',
    breadcrumbConfigDesc: 'Configuration des fils d\'Ariane (breadcrumbs) et du schéma JSON-LD BreadcrumbList.',
    enableBreadcrumbs: 'Activer les breadcrumbs',
    homePageLabel: 'Label page d\'accueil',
    separator: 'Séparateur',
    separatorDesc: 'Caractère utilisé entre les éléments du breadcrumb',
    showOnHomePage: 'Afficher sur la page d\'accueil',
    showOnHomePageDesc: 'Par défaut, le breadcrumb n\'est pas affiché sur la page d\'accueil',
    preview: 'Aperçu',
    websiteCreation: 'Création de site web',
  },
  redirectManager: {
    loading: 'Chargement des redirections...',
    title: 'Gestionnaire de redirections',
    totalRedirects: 'redirection(s) au total',
    importCsv: 'Import CSV',
    total: 'Total',
    permanent301: '301 (permanentes)',
    temporary302: '302 (temporaires)',
    addRedirect: 'Ajouter une redirection',
    sourceUrl: 'URL source',
    sourceUrlPlaceholder: '/ancienne-page',
    destinationUrl: 'URL destination',
    destinationUrlPlaceholder: '/nouvelle-page',
    type: 'Type',
    adding: 'Ajout...',
    searchPlaceholder: 'Rechercher (URL source ou destination)...',
    urlToTestPlaceholder: '/url-à-tester',
    test: 'Tester',
    noMatch: 'Aucune correspondance',
    sourceFrom: 'Source (from)',
    destinationTo: 'Destination (to)',
    date: 'Date',
    actions: 'Actions',
    noMatchingRedirects: 'Aucune redirection correspondante.',
    noRedirects: 'Aucune redirection. Ajoutez-en une ci-dessus.',
    redirectCreated: 'Redirection créée',
    redirectDeleted: 'Redirection supprimée',
    redirectsDeleted: 'redirection(s) supprimée(s)',
    redirectModified: 'Redirection modifiée',
    noValidCsvRedirects: 'Aucune redirection valide trouvée dans le CSV',
    redirectsExported: 'redirection(s) exportée(s)',
    exportError: 'Erreur export',
    createdCount: 'créée(s)',
    duplicatesCount: 'doublon(s)',
    errorsCount: 'erreur(s)',
  },
  performance: {
    days7: '7 jours',
    days30: '30 jours',
    days90: '90 jours',
    loading: 'Chargement des performances...',
    title: 'Performance Search Console',
    subtitle: 'Clics, impressions, CTR et positions depuis Google Search Console',
    closeImport: 'Fermer import',
    import: 'Importer',
    importGscData: 'Importer des données GSC',
    fileType: 'Fichier XLSX ou CSV',
    pasteJsonHint: 'Ou collez du JSON (tableau d\'entrées)',
    importing: 'Import en cours...',
    importedCount: 'importé(s)',
    updatedCount: 'mis à jour',
    noData: 'Aucune donnée de performance',
    noDataDesc: 'Importez vos données depuis Google Search Console pour visualiser vos clics, impressions, CTR et positions.',
    importData: 'Importer des données',
    totalClicks: 'Total clics',
    totalImpressions: 'Total impressions',
    averageCtr: 'CTR moyen',
    averagePosition: 'Position moyenne',
    topPages: 'Top pages',
    clicks: 'Clics',
    impressions: 'Impressions',
    ctrPercent: 'CTR (%)',
    position: 'Position',
    topQueries: 'Top requêtes',
    query: 'Requête',
    xlsxEntriesLoaded: 'entrées chargées depuis le fichier XLSX',
    pages: 'pages',
    queries: 'requêtes',
  },
  schemaBuilder: {
    localBusiness: 'Commerce local',
    article: 'Article',
    product: 'Produit',
    faq: 'FAQ',
    howTo: 'Guide pratique',
    organization: 'Organisation',
    event: 'Événement',
    choose: '-- Choisir --',
    jsonLdPreview: 'Aperçu JSON-LD',
    liveUpdate: 'Mise à jour en direct',
    copyJsonLd: 'Copier le JSON-LD',
    copyScriptTag: 'Copier le script tag',
    copied: 'copié !',
    copyError: 'Erreur de copie',
    tip: 'Conseil :',
    beforeDeploying: 'avant de le déployer en production.',
    visualGeneratorDesc: 'Générateur visuel de données structurées JSON-LD pour le référencement',
    addButton: '+ Ajouter',
    name: 'Nom',
    description: 'Description',
    address: 'Adresse',
    city: 'Ville',
    postalCode: 'Code postal',
    country: 'Pays',
    phone: 'Téléphone',
    email: 'Email',
    openingHours: 'Horaires',
    latitude: 'Latitude',
    longitude: 'Longitude',
    website: 'Site web',
    contactEmail: 'Email de contact',
    socialMediaUrls: 'Réseaux sociaux (URLs)',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    location: 'Lieu',
    locationAddress: 'Adresse du lieu',
    ticketUrl: 'URL billetterie',
    title: 'Titre',
    author: 'Auteur',
    publisher: 'Éditeur',
    imageUrl: 'URL image',
    publicationDate: 'Date de publication',
    sku: 'SKU',
    brand: 'Marque',
    price: 'Prix',
    currency: 'Devise',
    availability: 'Disponibilité',
    inStock: 'En stock',
    outOfStock: 'Rupture de stock',
    preOrder: 'Pré-commande',
    madeToOrder: 'Sur commande',
    questionsAnswers: 'Questions / Réponses',
    question: 'Question',
    answer: 'Réponse',
    steps: 'Étapes',
    stepTitle: 'Titre de l\'étape',
    stepDescription: 'Description de l\'étape',
    priceRange: 'Fourchette de prix',
    modificationDate: 'Date de modification',
    publisherName: 'Nom de l\'éditeur',
    publisherLogo: 'Logo éditeur (URL)',
    productName: 'Nom du produit',
    reviewCount: 'Nombre d\'avis',
    ratingValue: 'Note moyenne',
    guideTitle: 'Titre du guide',
    logoUrl: 'Logo (URL)',
    imageLabel: 'Image (URL)',
    urlLabel: 'URL',
    validateOnRichResults: 'Validez votre JSON-LD sur',
  },
  keywordResearch: {
    loading: 'Analyse des mots-clés en cours...',
    title: 'Recherche de mots-clés',
    subtitle: 'Suggestions basées sur l\'analyse du contenu existant',
    activeKeywords: 'mots-clés actifs',
    uniqueTerms: 'termes uniques',
    suggestions: 'suggestions',
    searchPlaceholder: 'Rechercher un mot-clé, titre de page...',
    noSuggestions: 'Aucune suggestion disponible',
    noSuggestionsDesc: 'Ajoutez du contenu à vos pages pour que l\'analyse puisse générer des suggestions.',
    noMatchingSuggestions: 'Aucune suggestion ne correspond à votre recherche.',
    unused: 'Non utilisé',
    associated: 'Associé',
    trending: 'Tendance',
    longTail: 'Longue traîne',
    all: 'Tous',
    unusedPlural: 'Non utilisés',
    associatedPlural: 'Associés',
    trendingPlural: 'Tendances',
    keyword: 'Mot-clé',
    freq: 'Fréq.',
    seeLess: 'Voir moins',
    type: 'Type',
    score: 'Score',
    frequency: 'Fréquence',
    usedBy: 'Utilisé par',
    suggestedFor: 'Suggéré pour',
  },
  cannibalization: {
    loading: 'Analyse de la cannibalisation...',
    title: 'Cannibalisation de mots-clés',
    subtitle: 'Détection des mots-clés utilisés par plusieurs pages',
    conflicts: 'conflit(s)',
    affectedPages: 'page(s) concernée(s)',
    searchPlaceholder: 'Rechercher un mot-clé, titre ou slug...',
    noCannibalization: 'Aucune cannibalisation détectée',
    noCannibalizationDesc: 'Chaque mot-clé est utilisé par une seule page. Bonne pratique !',
    noMatchingConflicts: 'Aucun conflit ne correspond à votre recherche.',
    highRisk: 'Risque élevé',
    warning: 'Attention',
    pages: 'pages',
  },
  seoAnalyzer: {
    groupTitle: 'Titre',
    groupDescription: 'Description',
    groupUrlSlug: 'URL / Slug',
    groupHeadings: 'Titres H1-H6',
    groupContent: 'Contenu',
    groupImages: 'Images',
    groupLinks: 'Liens',
    groupSocial: 'Réseaux sociaux',
    groupStructuredData: 'Données structurées',
    groupReadability: 'Lisibilité',
    groupQuality: 'Qualité',
    groupSecondaryKeywords: 'Mots-clés secondaires',
    groupCornerstone: 'Contenu pilier',
    groupFreshness: 'Fraîcheur du contenu',
    groupTechnical: 'Technique',
    groupAccessibility: 'Accessibilité',
    groupEcommerce: 'E-commerce',
    levelExcellent: 'Excellent',
    levelGood: 'Bon',
    levelFair: 'Acceptable',
    levelNeedsImprovement: 'À améliorer',
    categoryCritical: 'Critique',
    categoryImportant: 'Important',
    categoryBonus: 'Bonus',
    seoScore: 'Score SEO',
    outOf100: '/ 100',
    cornerstoneLabel: 'PILIER',
    checksPassed: 'critères validés',
    errorsCount: 'erreur(s)',
    warningsCount: 'avertissement(s)',
    improvementSuggestions: 'Suggestions d\'amélioration',
    adjustTitle: 'Ajustez votre titre SEO',
    currently: 'actuellement',
    titleCharactersIdeal: 'caractères, idéal: 50-60',
    writeMetaDesc: 'Rédigez une meta-description entre 120-160 caractères',
    enrichContent: 'Enrichissez votre contenu (minimum 300 mots recommandé)',
    includeKeywordInTitle: 'Intégrez votre mot-clé principal dans le titre',
    includeKeywordInDesc: 'Incluez votre mot-clé dans la meta-description',
    addAltText: 'Ajoutez des attributs alt à vos images',
    addInternalLinks: 'Ajoutez des liens internes vers d\'autres pages',
    seoCannibalization: 'Cannibalisation SEO',
    highRisk: 'Risque élevé',
    duplicationHarmsRanking: 'Ce niveau de duplication nuit fortement au positionnement.',
    diluteRanking: 'Cela peut diluer votre positionnement sur ce mot-clé.',
    viewPages: 'Voir les pages',
    uniqueKeywordAdvice: 'Utilisez un mot-clé unique par page pour éviter la cannibalisation SEO.',
    suggestedInternalLinks: 'Liens internes suggérés',
    analyzingContent: 'Analyse du contenu...',
    readingTime: 'Temps de lecture : ~{n} min',
    wordsLabel: 'mots',
    secondaryKeywords: 'mot(s)-clé(s) secondaire(s)',
    generateMeta: 'Générer les meta',
    metaTitle: 'Meta Title',
    metaDescription: 'Meta Description',
    emptyValue: '(vide)',
  },
  scoreHistory: {
    loading: 'Chargement de l\'historique...',
    loadingError: 'Erreur lors du chargement de l\'historique',
    noHistory: 'Pas encore d\'historique.',
    noHistoryDesc: 'Les scores seront enregistrés à chaque sauvegarde.',
    improving: 'En hausse',
    declining: 'En baisse',
    stable: 'Stable',
    scoreEvolution: 'Évolution du score',
    measures: 'mesure(s)',
    latestScore: 'Dernier score :',
  },
  contentDecay: {
    title: 'Contenu obsolète',
    lessThan3Months: '< 3 mois',
    months3to6: '3-6 mois',
    months6to12: '6-12 mois',
    moreThan12Months: '> 12 mois',
    description: 'Détecte les pages dont le contenu vieillit. Les contenus non mis à jour perdent en pertinence SEO au fil du temps.',
    lastUpdate: 'Dernière MAJ',
    lastReview: 'Dernière rev.',
    ageDays: 'Age (j)',
    action: 'Action',
    reviewed: 'Révisé !',
    markReviewed: 'Marquer révisé',
    noData: 'Aucune donnée de mise à jour disponible.',
  },
  socialPreview: {
    title: 'Aperçu réseaux sociaux',
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    ogImage: 'Image OG 1200x630',
    cardImage: 'Image Card 1200x628',
    previewTitle: 'Titre',
    previewDescription: 'Description',
    characters: 'caractères',
    pageTitlePlaceholder: 'Titre de la page',
    pageDescriptionPlaceholder: 'Description de la page...',
  },
  serpPreview: {
    title: 'Aperçu Google',
    desktop: 'Bureau',
    mobile: 'Mobile',
    noMetaTitle: 'Pas de meta title',
    noMetaDescription: 'Pas de meta description',
    previewTitle: 'Titre',
    previewDescription: 'Description',
    url: 'URL',
    characters: 'caractères',
  },
  metaTitle: {
    label: 'Meta Title',
    placeholder: 'Titre SEO de la page...',
    characters: 'caractères',
    optimal: 'Optimal :',
    charactersMissing: 'caractères manquants',
    charactersTooMany: 'caractères en trop',
    idealLength: 'Longueur idéale',
  },
  metaDescription: {
    label: 'Meta Description',
    placeholder: 'Description SEO de la page...',
    characters: 'caractères',
    optimal: 'Optimal :',
    charactersMissing: 'caractères manquants',
    charactersTooMany: 'caractères en trop',
    idealLength: 'Longueur idéale',
  },
  metaImage: {
    label: 'Meta Image',
    imageSet: 'Image définie pour le partage social',
    noImage: 'Aucune image meta (recommandé pour les réseaux sociaux)',
    set: 'Définie',
  },
  overview: {
    metaCompleteness: 'Complétude meta',
    incomplete: 'Incomplet',
    partial: 'Partiel',
    almostComplete: 'Presque complet',
    complete: 'Complet',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    imageLabel: 'Image',
    set: 'Défini',
    missing: 'Manquant',
  },
}

// ---------------------------------------------------------------------------
// English translations
// ---------------------------------------------------------------------------

const en: DashboardTranslations = {
  common: {
    loading: 'Loading...',
    loadingError: 'Loading error',
    retry: 'Retry',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    refresh: 'Refresh',
    exportCsv: 'Export CSV',
    exportJson: 'Export JSON',
    exportPdf: 'Export PDF',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add',
    noResults: 'No results.',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    selected: 'selected',
    deselectAll: 'Deselect all',
    characters: 'characters',
    generate: 'Generate',
    generating: 'Generating...',
    copy: 'Copy',
    serverError: 'Server error',
    networkError: 'Network error',
    noTitle: '(no title)',
    none: 'None',
    article: 'Article',
    ok: 'OK',
    modify: 'Edit',
  },
  nav: {
    dashboard: 'Dashboard',
    sitemapAudit: 'Sitemap Audit',
    redirects: 'Redirects',
    cannibalization: 'Cannibalization',
    performance: 'Performance',
    keywords: 'Keywords',
    schemaOrg: 'Schema.org',
    linkGraph: 'Link Graph',
    settings: 'Settings',
    seo: 'SEO',
  },
  seoView: {
    loadingAudit: 'Loading SEO audit...',
    errorSaving: 'Error during save',
    auditTitle: 'SEO Audit',
    pagesAnalyzed: 'pages analyzed',
    markCornerstone: 'Mark as cornerstone',
    unmarkCornerstone: 'Unmark cornerstone',
    searchPlaceholder: 'Search (title, slug, keyword)...',
    allCollections: 'All collections',
    allScores: 'All scores',
    goodScores: 'Good (>=80)',
    needsWork: 'Needs work (50-79)',
    criticalScores: 'Critical (<50)',
    missingMeta: 'Missing meta',
    missingH1: 'Missing H1',
    lowReadability: 'Low readability',
    averageScore: 'Average score',
    goodLabel: 'Good (>=80)',
    needsWorkLabel: 'Needs work',
    criticalLabel: 'Critical (<50)',
    noKeyword: 'No keyword',
    wordsAvg: 'Words (avg)',
    metaTitle: 'META TITLE',
    metaDesc: 'META DESC',
    cornerstone: 'CORNERSTONE',
    collection: 'Collection',
    score: 'Score',
    keyword: 'Keyword',
    h1: 'H1',
    og: 'OG',
    internal: 'Internal',
    external: 'External',
    words: 'Words',
    readability: 'Readability',
    updated: 'Updated',
    seoReport: 'SEO Report',
    overview: 'Overview',
    missingMetaTitle: 'Missing meta title',
    missingMetaDescription: 'Missing meta description',
    missingKeyword: 'Missing keyword',
    shortContent: 'Short content',
    lowReadabilityIssue: 'Low readability',
    missingOgImage: 'Missing OG image',
    noInternalLinks: 'No internal links',
    lowOverallScore: 'Low overall score',
    shortMetaTitle: 'Short meta title',
    longMetaTitle: 'Long meta title',
    shortMetaDesc: 'Short meta description',
    longMetaDesc: 'Long meta description',
    top5PriorityActions: 'Top 5 — Priority actions',
    perPageDetails: 'Per-page details',
    title: 'Title',
    slug: 'Slug',
    issues: 'Issues',
    identifiedIssues: 'Identified issues',
    scoreDistribution: 'Score distribution',
    good: 'Good',
    critical: 'Critical',
    generatedBy: 'Generated by SEO Analyzer',
    resultsDisplayed: 'results displayed',
    noKeywordLabel: 'No keyword',
    wordsAverage: 'Words (average)',
    readabilityAvg: 'Readability (avg)',
    noTitleDesc: 'No title / desc',
    previousLabel: 'Previous:',
  },
  sitemapAudit: {
    loading404: 'Loading 404 logs...',
    title: 'Sitemap & Link Audit',
    totalPages: 'Total pages',
    internalLinks: 'Internal links',
    linksPerPage: 'Links / page',
    average: 'Average',
    orphaned: 'Orphaned',
    fragile: 'Fragile',
    brokenLinks: 'Broken links',
    searchPlaceholder: 'Search (title, slug, target URL)...',
    orphanedPages: 'Orphaned pages',
    fragilePages: 'Fragile pages',
    linkHubs: 'Link hubs',
    logs404: '404 Logs',
    externalLinks: 'External links',
    noOrphanedPages: 'No orphaned pages detected. All pages are accessible via internal links.',
    orphanedPagesDesc: 'Pages with no incoming internal links (inaccessible from other pages)',
    zeroIncomingLinks: '0 incoming links',
    noFragilePages: 'No fragile pages detected. All pages have at least 2 incoming internal links.',
    fragilePagesDesc: 'Pages with only one incoming internal link (fragile — if this link disappears, the page becomes orphaned)',
    oneIncomingLink: '1 incoming link',
    from: 'from:',
    anchor: 'anchor:',
    noLinkHubs: 'No link hubs detected (no page with more than 10 outgoing links).',
    linkHubsDesc: 'Pages with more than 10 internal outgoing links — these pages distribute a lot of PageRank',
    links: 'links',
    brokenLinksDesc: 'Internal links pointing to non-existent slugs — to fix or redirect',
    created: 'created',
    errors: 'errors',
    selectedItems: 'selected',
    selectAll: 'Select all',
    suggestion: 'Suggestion:',
    targetSlug: 'target slug',
    createdLabel: 'Created',
    no404Errors: 'No 404 errors recorded. Enable logging in your Next.js middleware.',
    pages404Desc: '404 pages visited by your users — create 301 redirects to fix them',
    last: 'Last:',
    ref: 'Ref:',
    ignore: 'Ignore',
    checkExternalLinksDesc: 'Check your site\'s external links to detect broken links.',
    scanExternalLinks: 'Scan external links',
    verificationInProgress: 'Verification in progress... (this may take a few seconds)',
    noBrokenLinks: 'No broken links detected.',
    noExternalLinks: 'No external links found.',
    total: 'total',
    broken: 'broken',
    timeout: 'timeout',
    all: 'All',
    brokenLabel: 'Broken',
    rescan: 'Rescan',
    forceNewVerification: 'Force a new verification',
    analyzingInternal: 'Analyzing internal linking structure...',
    brokenLinkTo: 'broken link to',
    linkFrom: 'link from',
  },
  seoConfig: {
    loading: 'Loading configuration...',
    title: 'SEO Configuration',
    subtitle: 'Global parameters of the SEO analysis engine',
    saved: 'Configuration saved',
    siteName: 'Site name',
    siteNameDesc: 'Used for brand verification in titles (avoid duplication of site name)',
    ignoredPages: 'Ignored pages',
    ignoredPagesDesc: 'Pages excluded from the global SEO audit',
    pageSlugPlaceholder: 'page-slug',
    noIgnoredSlugs: 'No ignored slugs',
    disabledRules: 'Disabled rules',
    disabledRulesDesc: 'Check the rule groups to ignore during analysis. Disabled rules will not be executed.',
    customThresholds: 'Custom thresholds',
    customThresholdsDesc: 'Leave empty to use default values. Thresholds control the min/max limits of each rule.',
    defaultLabel: 'Default:',
    ruleGroupTitle: 'Title',
    ruleGroupMetaDescription: 'Meta description',
    ruleGroupUrlSlug: 'URL / Slug',
    ruleGroupHeadings: 'H1-H6 Headings',
    ruleGroupContent: 'Content',
    ruleGroupImages: 'Images',
    ruleGroupLinks: 'Links',
    ruleGroupSocial: 'Social networks',
    ruleGroupStructuredData: 'Structured data',
    ruleGroupReadability: 'Readability',
    ruleGroupQuality: 'Quality',
    ruleGroupSecondaryKeywords: 'Secondary keywords',
    ruleGroupCornerstone: 'Cornerstone content',
    ruleGroupFreshness: 'Freshness',
    ruleGroupTechnical: 'Technical',
    ruleGroupAccessibility: 'Accessibility',
    ruleGroupEcommerce: 'E-commerce',
    thresholdTitleMin: 'Title — min length',
    thresholdTitleMax: 'Title — max length',
    thresholdMetaDescMin: 'Meta desc — min length',
    thresholdMetaDescMax: 'Meta desc — max length',
    thresholdMinWordsPages: 'Min words (pages)',
    thresholdMinWordsPosts: 'Min words (posts)',
    thresholdKeywordDensityMin: 'Min keyword density (%)',
    thresholdKeywordDensityMax: 'Max keyword density (%)',
    thresholdFleschMin: 'Min Flesch score',
    thresholdSlugMaxLength: 'Max slug length',
    sitemapConfig: 'Sitemap Configuration',
    sitemapExcludedSlugs: 'Slugs excluded from sitemap',
    slugToExcludePlaceholder: 'slug-to-exclude',
    noExcludedSlugs: 'No excluded slugs',
    defaultChangeFrequency: 'Default change frequency',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    defaultPriority: 'Default priority',
    defaultPriorityDesc: 'Value between 0 and 1 (default: 0.5)',
    priorityOverrides: 'Priority overrides',
    priorityOverridesDesc: 'Define priority for specific slug patterns',
    patternPlaceholder: 'Pattern (e.g. blog/*)',
    priority: 'Priority',
    defaultShort: 'Default',
    addOverride: '+ Add an override',
    sitemapPreview: 'Sitemap preview',
    viewPreview: 'View preview',
    refreshPreview: 'Refresh preview',
    pages: 'pages',
    included: 'included',
    excluded: 'excluded',
    url: 'URL',
    lastModified: 'Last modified',
    frequency: 'Frequency',
    breadcrumbConfig: 'Breadcrumb Configuration',
    breadcrumbConfigDesc: 'Configuration of breadcrumbs and JSON-LD BreadcrumbList schema.',
    enableBreadcrumbs: 'Enable breadcrumbs',
    homePageLabel: 'Home page label',
    separator: 'Separator',
    separatorDesc: 'Character used between breadcrumb elements',
    showOnHomePage: 'Show on home page',
    showOnHomePageDesc: 'By default, breadcrumb is not displayed on the home page',
    preview: 'Preview',
    websiteCreation: 'Website creation',
  },
  redirectManager: {
    loading: 'Loading redirects...',
    title: 'Redirect Manager',
    totalRedirects: 'redirect(s) total',
    importCsv: 'Import CSV',
    total: 'Total',
    permanent301: '301 (permanent)',
    temporary302: '302 (temporary)',
    addRedirect: 'Add a redirect',
    sourceUrl: 'Source URL',
    sourceUrlPlaceholder: '/old-page',
    destinationUrl: 'Destination URL',
    destinationUrlPlaceholder: '/new-page',
    type: 'Type',
    adding: 'Adding...',
    searchPlaceholder: 'Search (source or destination URL)...',
    urlToTestPlaceholder: '/url-to-test',
    test: 'Test',
    noMatch: 'No match',
    sourceFrom: 'Source (from)',
    destinationTo: 'Destination (to)',
    date: 'Date',
    actions: 'Actions',
    noMatchingRedirects: 'No matching redirects.',
    noRedirects: 'No redirects. Add one above.',
    redirectCreated: 'Redirect created',
    redirectDeleted: 'Redirect deleted',
    redirectsDeleted: 'redirect(s) deleted',
    redirectModified: 'Redirect modified',
    noValidCsvRedirects: 'No valid redirects found in CSV',
    redirectsExported: 'redirect(s) exported',
    exportError: 'Export error',
    createdCount: 'created',
    duplicatesCount: 'duplicate(s)',
    errorsCount: 'error(s)',
  },
  performance: {
    days7: '7 days',
    days30: '30 days',
    days90: '90 days',
    loading: 'Loading performance...',
    title: 'Search Console Performance',
    subtitle: 'Clicks, impressions, CTR and positions from Google Search Console',
    closeImport: 'Close import',
    import: 'Import',
    importGscData: 'Import GSC data',
    fileType: 'XLSX or CSV file',
    pasteJsonHint: 'Or paste JSON (array of entries)',
    importing: 'Importing...',
    importedCount: 'imported',
    updatedCount: 'updated',
    noData: 'No performance data',
    noDataDesc: 'Import your data from Google Search Console to view your clicks, impressions, CTR and positions.',
    importData: 'Import data',
    totalClicks: 'Total clicks',
    totalImpressions: 'Total impressions',
    averageCtr: 'Average CTR',
    averagePosition: 'Average position',
    topPages: 'Top pages',
    clicks: 'Clicks',
    impressions: 'Impressions',
    ctrPercent: 'CTR (%)',
    position: 'Position',
    topQueries: 'Top queries',
    query: 'Query',
    xlsxEntriesLoaded: 'entries loaded from XLSX file',
    pages: 'pages',
    queries: 'queries',
  },
  schemaBuilder: {
    localBusiness: 'Local Business',
    article: 'Article',
    product: 'Product',
    faq: 'FAQ',
    howTo: 'How-To Guide',
    organization: 'Organization',
    event: 'Event',
    choose: '-- Choose --',
    jsonLdPreview: 'JSON-LD Preview',
    liveUpdate: 'Live update',
    copyJsonLd: 'Copy JSON-LD',
    copyScriptTag: 'Copy script tag',
    copied: 'copied!',
    copyError: 'Copy error',
    tip: 'Tip:',
    beforeDeploying: 'before deploying to production.',
    visualGeneratorDesc: 'Visual generator of structured JSON-LD data for SEO',
    addButton: '+ Add',
    name: 'Name',
    description: 'Description',
    address: 'Address',
    city: 'City',
    postalCode: 'Postal code',
    country: 'Country',
    phone: 'Phone',
    email: 'Email',
    openingHours: 'Opening hours',
    latitude: 'Latitude',
    longitude: 'Longitude',
    website: 'Website',
    contactEmail: 'Contact email',
    socialMediaUrls: 'Social media (URLs)',
    startDate: 'Start date',
    endDate: 'End date',
    location: 'Location',
    locationAddress: 'Location address',
    ticketUrl: 'Ticket URL',
    title: 'Title',
    author: 'Author',
    publisher: 'Publisher',
    imageUrl: 'Image URL',
    publicationDate: 'Publication date',
    sku: 'SKU',
    brand: 'Brand',
    price: 'Price',
    currency: 'Currency',
    availability: 'Availability',
    inStock: 'In stock',
    outOfStock: 'Out of stock',
    preOrder: 'Pre-order',
    madeToOrder: 'Made to order',
    questionsAnswers: 'Questions / Answers',
    question: 'Question',
    answer: 'Answer',
    steps: 'Steps',
    stepTitle: 'Step title',
    stepDescription: 'Step description',
    priceRange: 'Price range',
    modificationDate: 'Modification date',
    publisherName: 'Publisher name',
    publisherLogo: 'Publisher logo (URL)',
    productName: 'Product name',
    reviewCount: 'Review count',
    ratingValue: 'Average rating',
    guideTitle: 'Guide title',
    logoUrl: 'Logo (URL)',
    imageLabel: 'Image (URL)',
    urlLabel: 'URL',
    validateOnRichResults: 'Validate your JSON-LD on',
  },
  keywordResearch: {
    loading: 'Keyword analysis in progress...',
    title: 'Keyword Research',
    subtitle: 'Suggestions based on existing content analysis',
    activeKeywords: 'active keywords',
    uniqueTerms: 'unique terms',
    suggestions: 'suggestions',
    searchPlaceholder: 'Search keyword, page title...',
    noSuggestions: 'No suggestions available',
    noSuggestionsDesc: 'Add content to your pages for analysis to generate suggestions.',
    noMatchingSuggestions: 'No suggestions match your search.',
    unused: 'Unused',
    associated: 'Associated',
    trending: 'Trending',
    longTail: 'Long-tail',
    all: 'All',
    unusedPlural: 'Unused',
    associatedPlural: 'Associated',
    trendingPlural: 'Trending',
    keyword: 'Keyword',
    freq: 'Freq.',
    seeLess: 'See less',
    type: 'Type',
    score: 'Score',
    frequency: 'Frequency',
    usedBy: 'Used by',
    suggestedFor: 'Suggested for',
  },
  cannibalization: {
    loading: 'Cannibalization analysis...',
    title: 'Keyword Cannibalization',
    subtitle: 'Detection of keywords used by multiple pages',
    conflicts: 'conflict(s)',
    affectedPages: 'affected page(s)',
    searchPlaceholder: 'Search keyword, title or slug...',
    noCannibalization: 'No cannibalization detected',
    noCannibalizationDesc: 'Each keyword is used by a single page. Best practice!',
    noMatchingConflicts: 'No conflicts match your search.',
    highRisk: 'High risk',
    warning: 'Warning',
    pages: 'pages',
  },
  seoAnalyzer: {
    groupTitle: 'Title',
    groupDescription: 'Description',
    groupUrlSlug: 'URL / Slug',
    groupHeadings: 'Headings H1-H6',
    groupContent: 'Content',
    groupImages: 'Images',
    groupLinks: 'Links',
    groupSocial: 'Social media',
    groupStructuredData: 'Structured data',
    groupReadability: 'Readability',
    groupQuality: 'Quality',
    groupSecondaryKeywords: 'Secondary keywords',
    groupCornerstone: 'Cornerstone content',
    groupFreshness: 'Content freshness',
    groupTechnical: 'Technical',
    groupAccessibility: 'Accessibility',
    groupEcommerce: 'E-commerce',
    levelExcellent: 'Excellent',
    levelGood: 'Good',
    levelFair: 'Fair',
    levelNeedsImprovement: 'Needs improvement',
    categoryCritical: 'Critical',
    categoryImportant: 'Important',
    categoryBonus: 'Bonus',
    seoScore: 'SEO Score',
    outOf100: '/ 100',
    cornerstoneLabel: 'CORNERSTONE',
    checksPassed: 'checks passed',
    errorsCount: 'error(s)',
    warningsCount: 'warning(s)',
    improvementSuggestions: 'Improvement suggestions',
    adjustTitle: 'Adjust your SEO title',
    currently: 'currently',
    titleCharactersIdeal: 'characters, ideal: 50-60',
    writeMetaDesc: 'Write a meta description of 120-160 characters',
    enrichContent: 'Enrich your content (minimum 300 words recommended)',
    includeKeywordInTitle: 'Include your main keyword in the title',
    includeKeywordInDesc: 'Include your keyword in the meta description',
    addAltText: 'Add alt text to your images',
    addInternalLinks: 'Add internal links to other pages',
    seoCannibalization: 'SEO Cannibalization',
    highRisk: 'High risk',
    duplicationHarmsRanking: 'This level of duplication harms ranking significantly.',
    diluteRanking: 'This can dilute your ranking on this keyword.',
    viewPages: 'View pages',
    uniqueKeywordAdvice: 'Use a unique keyword per page to avoid SEO cannibalization.',
    suggestedInternalLinks: 'Suggested internal links',
    analyzingContent: 'Analyzing content...',
    readingTime: 'Reading time: ~{n} min',
    wordsLabel: 'words',
    secondaryKeywords: 'secondary keyword(s)',
    generateMeta: 'Generate meta',
    metaTitle: 'Meta Title',
    metaDescription: 'Meta Description',
    emptyValue: '(empty)',
  },
  scoreHistory: {
    loading: 'Loading history...',
    loadingError: 'Error loading history',
    noHistory: 'No history yet.',
    noHistoryDesc: 'Scores will be recorded with each save.',
    improving: 'Improving',
    declining: 'Declining',
    stable: 'Stable',
    scoreEvolution: 'Score Evolution',
    measures: 'measure(s)',
    latestScore: 'Latest score:',
  },
  contentDecay: {
    title: 'Stale Content',
    lessThan3Months: '< 3 months',
    months3to6: '3-6 months',
    months6to12: '6-12 months',
    moreThan12Months: '> 12 months',
    description: 'Detects pages with aging content. Non-updated content loses SEO relevance over time.',
    lastUpdate: 'Last Update',
    lastReview: 'Last Review',
    ageDays: 'Age (days)',
    action: 'Action',
    reviewed: 'Reviewed!',
    markReviewed: 'Mark Reviewed',
    noData: 'No update data available.',
  },
  socialPreview: {
    title: 'Social Networks Preview',
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    ogImage: 'OG Image 1200x630',
    cardImage: 'Card Image 1200x628',
    previewTitle: 'Title',
    previewDescription: 'Description',
    characters: 'characters',
    pageTitlePlaceholder: 'Page Title',
    pageDescriptionPlaceholder: 'Page description...',
  },
  serpPreview: {
    title: 'Google Preview',
    desktop: 'Desktop',
    mobile: 'Mobile',
    noMetaTitle: 'No meta title',
    noMetaDescription: 'No meta description',
    previewTitle: 'Title',
    previewDescription: 'Description',
    url: 'URL',
    characters: 'characters',
  },
  metaTitle: {
    label: 'Meta Title',
    placeholder: 'SEO title of the page...',
    characters: 'characters',
    optimal: 'Optimal:',
    charactersMissing: 'characters missing',
    charactersTooMany: 'characters too many',
    idealLength: 'Ideal length',
  },
  metaDescription: {
    label: 'Meta Description',
    placeholder: 'SEO description of the page...',
    characters: 'characters',
    optimal: 'Optimal:',
    charactersMissing: 'characters missing',
    charactersTooMany: 'characters too many',
    idealLength: 'Ideal length',
  },
  metaImage: {
    label: 'Meta Image',
    imageSet: 'Image set for social sharing',
    noImage: 'No meta image (recommended for social networks)',
    set: 'Set',
  },
  overview: {
    metaCompleteness: 'Meta Completeness',
    incomplete: 'Incomplete',
    partial: 'Partial',
    almostComplete: 'Almost complete',
    complete: 'Complete',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    imageLabel: 'Image',
    set: 'Set',
    missing: 'Missing',
  },
}

// ---------------------------------------------------------------------------
// Registry & accessor
// ---------------------------------------------------------------------------

const translations: Record<DashboardLocale, DashboardTranslations> = { fr, en }

export function getDashboardT(locale: DashboardLocale): DashboardTranslations {
  return translations[locale] || translations.fr
}
