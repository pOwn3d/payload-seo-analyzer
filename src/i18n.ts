/**
 * SEO Plugin — Lightweight i18n translation system.
 * Provides French (default) and English translations for all plugin views
 * and all rule messages/labels/tips.
 * No external dependencies.
 */

export type SeoLocale = 'fr' | 'en'

// ---------------------------------------------------------------------------
// Rule translations interface — one sub-object per rule group
// ---------------------------------------------------------------------------

export interface RuleTranslations {
  title: {
    missingLabel: string
    missingMessage: string
    missingTip: string
    lengthLabel: string
    lengthShort: (len: number) => string
    lengthShortTip: string
    lengthLong: (len: number) => string
    lengthLongTip: string
    lengthPass: (len: number) => string
    keywordLabel: string
    keywordPass: (kw: string) => string
    keywordFail: (kw: string) => string
    keywordPositionLabel: string
    keywordPositionPass: string
    keywordPositionFail: string
    duplicateBrandLabel: string
    duplicateBrandFail: string
    duplicateBrandTip: string
    duplicateBrandPass: string
    powerWordsLabel: string
    powerWordsPass: (count: number, words: string) => string
    powerWordsFail: string
    powerWordsTip: string
    hasNumberLabel: string
    hasNumberPass: string
    hasNumberFail: string
    hasNumberTip: string
    isQuestionLabel: string
    isQuestionPass: string
    isQuestionFail: string
    isQuestionTip: string
    sentimentLabel: string
    sentimentPass: (count: number, words: string) => string
    sentimentFail: string
    sentimentTip: string
  }
  metaDescription: {
    missingLabel: string
    missingMessage: string
    missingTip: string
    lengthLabel: string
    lengthShort: (len: number) => string
    lengthShortTip: string
    lengthLong: (len: number) => string
    lengthLongTip: string
    lengthPass: (len: number) => string
    keywordLabel: string
    keywordPass: (kw: string) => string
    keywordFail: (kw: string) => string
    ctaLabel: string
    ctaPass: string
    ctaFail: string
    ctaTip: string
  }
  headings: {
    h1MissingLabel: string
    h1MissingMessage: string
    h1MissingTip: string
    h1UniqueLabel: string
    h1MultipleMessage: (count: number) => string
    h1UniquePass: string
    h1KeywordLabel: string
    h1KeywordPass: string
    h1KeywordFail: (kw: string) => string
    hierarchyLabel: string
    hierarchyPass: string
    hierarchyFail: string
    h2KeywordLabel: string
    h2KeywordPass: string
    h2KeywordFail: (kw: string) => string
    frequencyLabel: string
    frequencyPass: (count: number, words: number) => string
    frequencyFail: (count: number, words: number) => string
    frequencyTip: string
    h1TitleDiffLabel: string
    h1TitleDiffFail: string
    h1TitleDiffTip: string
    h1TitleDiffPass: string
  }
  url: {
    missingLabel: string
    missingMessage: string
    lengthLabel: string
    lengthFail: (len: number) => string
    lengthPass: (len: number) => string
    formatLabel: string
    formatFail: string
    formatPass: string
    keywordLabel: string
    keywordPass: string
    keywordFail: (kw: string) => string
    keywordUtilityPass: string
    stopwordsLabel: string
    stopwordsFail: (words: string) => string
    stopwordsPass: string
  }
  content: {
    wordcountLabel: string
    wordcountFail: (count: number, minLabel: string) => string
    wordcountFailTip: string
    wordcountWarn: (count: number, minLabel: string) => string
    wordcountWarnTip: string
    wordcountPass: (count: number) => string
    keywordIntroLabel: string
    keywordIntroPass: string
    keywordIntroFail: (kw: string) => string
    densityLabel: string
    densityOverstuffed: (density: string) => string
    densityHigh: (density: string) => string
    densityPass: (density: string) => string
    densityPassWordLevel: (density: string) => string
    densityLowWordLevel: (density: string) => string
    densityLow: (density: string) => string
    densityMissing: (kw: string) => string
    placeholderLabel: string
    placeholderFail: string
    placeholderPass: string
    placeholderTip: string
    thinLabel: string
    thinWarnLabel: string
    thinWarn: (count: number) => string
    thinWarnTip: string
    thinPass: string
    thinPassLabel: string
    distributionLabel: string
    distributionPass: (tiers: number) => string
    distributionWarn: string
    distributionWarnTip: string
    distributionFail: string
    distributionFailTip: string
    listsLabel: string
    listsPass: (count: number) => string
    listsFail: string
    listsTip: string
    // Min word labels by page type
    minWordsPost: string
    minWordsForm: string
    minWordsLegal: string
    minWordsGeneric: string
  }
  secondaryKeywords: {
    titleLabel: (suffix: string) => string
    titlePass: (kw: string) => string
    titleFail: (kw: string) => string
    descLabel: (suffix: string) => string
    descPass: (kw: string) => string
    descFail: (kw: string) => string
    contentLabel: (suffix: string) => string
    contentPass: (kw: string, count: number, density: string) => string
    contentFail: (kw: string) => string
    headingLabel: (suffix: string) => string
    headingPass: (kw: string) => string
    headingFail: (kw: string) => string
  }
  images: {
    altLabel: string
    altAllPass: (total: number) => string
    altSomeFail: (missing: number, total: number) => string
    altMostFail: (missing: number, total: number) => string
    altKeywordLabel: string
    altKeywordPass: string
    altKeywordFail: string
    presentLabel: string
    presentPass: (total: number) => string
    presentFail: string
    presentUtilityPass: string
    quantityLabel: string
    quantityPass: (total: number) => string
    quantityFail: string
  }
  linking: {
    internalLabel: string
    internalNone: string
    internalFew: (count: number) => string
    internalGood: (count: number) => string
    externalLabel: string
    externalNone: string
    externalPass: (count: number) => string
    externalUtilityPass: string
    genericAnchorsLabel: string
    genericAnchorsFail: (count: number) => string
    genericAnchorsPassLabel: string
    genericAnchorsPass: string
    emptyLinksLabel: string
    emptyLinksFail: (count: number) => string
    emptyLinksPassLabel: string
    emptyLinksPass: string
  }
  cornerstone: {
    wordcountLabel: string
    wordcountPass: (count: number) => string
    wordcountFail: (count: number) => string
    internalLinksLabel: string
    internalLinksPass: (count: number) => string
    internalLinksFail: (count: number) => string
    focusKeywordLabel: string
    focusKeywordPass: string
    focusKeywordFail: string
    metaDescLabel: string
    metaDescPass: (len: number) => string
    metaDescWarn: (len: number) => string
    metaDescFail: string
  }
  readability: {
    fleschLabel: string
    fleschPass: (score: number) => string
    fleschWarn: (score: number) => string
    fleschFail: (score: number) => string
    longSentencesLabelFail: string
    longSentencesLabelPass: string
    longSentencesFail: (long: number, total: number, pct: number) => string
    longSentencesPass: (pct: number) => string
    longParagraphsLabel: string
    longParagraphsFail: string
    longParagraphsPass: string
    passiveLabelFail: string
    passiveLabelPass: string
    passiveFail: (count: number, total: number, pct: number) => string
    passivePass: (pct: number) => string
    transitionsLabel: string
    transitionsFail: (pct: number) => string
    transitionsPass: (pct: number) => string
    consecutiveLabelFail: string
    consecutiveLabelPass: string
    consecutiveFail: (count: number) => string
    consecutivePass: string
    longSectionsLabelFail: string
    longSectionsLabelPass: string
    longSectionsFail: (count: number) => string
    longSectionsPass: string
  }
  freshness: {
    ageLabel: string
    ageEvergreenWarn: (days: number) => string
    ageEvergreenPass: (days: number) => string
    ageFail: (days: number) => string
    ageWarn: (days: number) => string
    agePass: (days: number) => string
    reviewLabel: string
    reviewWarn: (days: number) => string
    reviewPass: (days: number) => string
    yearRefLabel: string
    yearRefWarn: (oldest: number, current: number, last: number) => string
    yearRefPass: (year: number) => string
    thinAgingLabel: string
    thinAgingFail: (words: number, days: number) => string
  }
  schema: {
    readinessLabel: string
    readinessPass: string
    readinessFail: string
  }
  technical: {
    canonicalMissingLabel: string
    canonicalMissingMessage: string
    canonicalInvalidLabel: string
    canonicalInvalidMessage: (url: string) => string
    canonicalExternalLabel: string
    canonicalExternalMessage: string
    canonicalOkLabel: string
    canonicalOkMessage: string
    robotsNoindexLabel: string
    robotsNoindexAcceptable: (pageType: string) => string
    robotsNoindexFail: string
    robotsNofollowLabel: string
    robotsNofollowMessage: string
    robotsOkLabel: string
    robotsOkMessage: string
  }
  social: {
    ogImageLabel: string
    ogImageFail: string
    ogImagePass: string
    titleTruncLabel: string
    titleTruncFail: (len: number) => string
    titleTruncPass: string
    descLengthLabel: string
    descLengthFail: (len: number) => string
    descLengthPass: string
  }
  accessibility: {
    shortAnchorsLabel: string
    shortAnchorsFail: (count: number, example: string) => string
    shortAnchorsPass: string
    shortAnchorsTip: string
    altQualityLabel: string
    altQualityFail: (count: number, example: string) => string
    altQualityPass: string
    altQualityTip: string
    emptyHeadingsLabel: string
    emptyHeadingsFail: (count: number, tags: string) => string
    emptyHeadingsPass: string
    emptyHeadingsTip: string
    duplicateLinksLabel: string
    duplicateLinksFail: (count: number) => string
    duplicateLinksPass: string
    duplicateLinksTip: string
    allCapsLabel: string
    allCapsFail: (count: number, example: string) => string
    allCapsPass: string
    allCapsTip: string
    linkDensityLabel: string
    linkDensityFail: (pct: number) => string
    linkDensityWarn: (pct: number) => string
    linkDensityPass: (pct: number) => string
    linkDensityNoContent: string
    linkDensityTip: string
    imageFilenameLabel: string
    imageFilenameFail: (count: number, example: string) => string
    imageFilenamePass: string
    imageFilenameTip: string
    altDuplicatesLabel: string
    altDuplicatesFail: (count: number, example: string) => string
    altDuplicatesPass: string
    altDuplicatesTip: string
  }
  quality: {
    noDuplicateLabel: string
    noDuplicateFail: string
    noDuplicatePass: string
    substantialLabel: string
    substantialFail: (count: number) => string
    substantialWarn: (count: number) => string
    substantialPass: (count: number) => string
  }
  ecommerce: {
    priceLabel: string
    pricePass: string
    priceFail: string
    priceTip: string
    descriptionLabel: string
    descriptionPass: (count: number) => string
    descriptionFail: (count: number, min: number) => string
    descriptionTip: string
    imagesLabel: string
    imagesPass: (count: number) => string
    imagesWarn: (count: number, min: number) => string
    imagesFail: string
    imagesTip: string
    brandLabel: string
    brandPass: string
    brandFailKw: (kw: string) => string
    brandFailNoKw: string
    brandTip: string
    metaPriceLabel: string
    metaPricePass: string
    metaPriceFail: string
    metaPriceTip: string
    reviewLabel: string
    reviewPass: string
    reviewFail: string
    reviewTip: string
    availabilityLabel: string
    availabilityPass: string
    availabilityFail: string
    availabilityTip: string
  }
}

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
  // Rule translations
  rules: RuleTranslations
}

// ---------------------------------------------------------------------------
// French rule translations
// ---------------------------------------------------------------------------

const rulesFr: RuleTranslations = {
  title: {
    missingLabel: 'Meta title',
    missingMessage: 'Meta title manquant — Ajoutez un titre pour le referencement.',
    missingTip: 'Redigez un titre de 30-60 caracteres contenant le mot-cle principal et le nom de marque.',
    lengthLabel: 'Longueur du title',
    lengthShort: (len) => `Meta title (${len} car.) — Trop court. Visez 30 a 60 caracteres.`,
    lengthShortTip: 'Ajoutez des mots descriptifs ou le nom de marque pour atteindre 30 caracteres minimum.',
    lengthLong: (len) => `Meta title (${len} car.) — Trop long, sera coupe dans Google. Reduisez a 60 max.`,
    lengthLongTip: 'Google tronque au-dela de ~60 caracteres. Supprimez les mots superflus et gardez l\'essentiel.',
    lengthPass: (len) => `Meta title (${len} car.) — Longueur ideale.`,
    keywordLabel: 'Mot-cle dans le title',
    keywordPass: (kw) => `Le mot-cle "${kw}" est present dans le meta title.`,
    keywordFail: (kw) => `Le mot-cle "${kw}" n'est pas dans le meta title — Ajoutez-le pour un meilleur referencement.`,
    keywordPositionLabel: 'Position du mot-cle',
    keywordPositionPass: 'Le mot-cle est place en debut de title — Position ideale.',
    keywordPositionFail: 'Le mot-cle est en fin de title — Placez-le au debut pour un meilleur impact.',
    duplicateBrandLabel: 'Nom de marque duplique',
    duplicateBrandFail: 'Le title contient une partie dupliquee (ex: "Marque | Marque") — Supprimez le doublon.',
    duplicateBrandTip: 'Verifiez que le generateur de meta title n\'ajoute pas automatiquement le nom de marque si vous l\'avez deja inclus.',
    duplicateBrandPass: 'Pas de duplication dans le title.',
    powerWordsLabel: 'Mots puissants dans le title',
    powerWordsPass: (count, words) => `Le title contient ${count} mot(s) puissant(s) : ${words}`,
    powerWordsFail: 'Le title ne contient aucun mot puissant — Ajoutez un mot comme "gratuit", "guide", "complet" pour booster le CTR.',
    powerWordsTip: 'Les mots puissants (gratuit, exclusif, guide, complet, essentiel...) attirent l\'attention dans les resultats de recherche.',
    hasNumberLabel: 'Nombre dans le title',
    hasNumberPass: 'Le title contient un nombre — Les titres avec chiffres generent +36% de CTR.',
    hasNumberFail: 'Aucun nombre dans le title — Les titres avec chiffres (ex: "5 astuces", "Top 10") attirent plus de clics.',
    hasNumberTip: 'Ajoutez un nombre pour creer un titre de type liste (ex: "7 conseils pour...", "Les 3 erreurs a eviter").',
    isQuestionLabel: 'Title interrogatif',
    isQuestionPass: 'Le title est formule en question — Ideal pour les Featured Snippets Google.',
    isQuestionFail: 'Le title n\'est pas une question — Les titres interrogatifs favorisent les extraits en vedette.',
    isQuestionTip: 'Reformulez en question si pertinent (ex: "Comment optimiser votre SEO ?").',
    sentimentLabel: 'Mots emotionnels dans le title',
    sentimentPass: (count, words) => `Le title contient ${count} mot(s) emotionnel(s) : ${words}`,
    sentimentFail: 'Le title ne contient aucun mot emotionnel — Les mots a forte emotion augmentent le taux de clic.',
    sentimentTip: 'Ajoutez un mot emotionnel pour capter l\'attention (ex: "erreur", "secret", "incroyable").',
  },
  metaDescription: {
    missingLabel: 'Meta description',
    missingMessage: 'Meta description manquante — Ajoutez une description pour le referencement.',
    missingTip: 'Redigez une phrase de 120-160 caracteres qui resume la page et incite au clic. Incluez le mot-cle principal.',
    lengthLabel: 'Longueur de la description',
    lengthShort: (len) => `Meta description (${len} car.) — Trop courte. Visez 120 a 160 caracteres.`,
    lengthShortTip: 'Completez avec les benefices de la page ou un appel a l\'action (ex: "Devis gratuit en 24h").',
    lengthLong: (len) => `Meta description (${len} car.) — Trop longue, sera coupee. Reduisez a 160 max.`,
    lengthLongTip: 'Google tronque au-dela de ~160 caracteres. Supprimez les details secondaires et gardez l\'essentiel.',
    lengthPass: (len) => `Meta description (${len} car.) — Longueur ideale.`,
    keywordLabel: 'Mot-cle dans la description',
    keywordPass: (kw) => `Le mot-cle "${kw}" est present dans la meta description.`,
    keywordFail: (kw) => `Le mot-cle "${kw}" n'est pas dans la meta description.`,
    ctaLabel: 'Verbe d\'action (CTA)',
    ctaPass: 'La meta description contient un element incitatif — Bon pour le taux de clic.',
    ctaFail: 'Ajoutez un verbe d\'action (decouvrez, contactez, obtenez...) pour inciter au clic.',
    ctaTip: 'Commencez par un verbe a l\'imperatif (Decouvrez, Profitez, Obtenez) ou utilisez un chiffre ("5 raisons de...").',
  },
  headings: {
    h1MissingLabel: 'Titre H1',
    h1MissingMessage: 'Aucun titre H1 detecte — Ajoutez un titre principal dans le hero.',
    h1MissingTip: 'Le H1 est le titre principal de la page. Il doit contenir le mot-cle et resumer le sujet en une phrase.',
    h1UniqueLabel: 'Titre H1 unique',
    h1MultipleMessage: (count) => `${count} titres H1 detectes — Gardez un seul H1 par page.`,
    h1UniquePass: 'Un seul H1 detecte — Parfait.',
    h1KeywordLabel: 'Mot-cle dans le H1',
    h1KeywordPass: 'Le mot-cle est present dans le titre H1.',
    h1KeywordFail: (kw) => `Le mot-cle "${kw}" n'est pas dans le H1 — Integrez-le au titre principal.`,
    hierarchyLabel: 'Hierarchie des titres',
    hierarchyPass: 'La hierarchie des titres est correcte (h2 avant h3, etc.).',
    hierarchyFail: 'La hierarchie des titres n\'est pas respectee — Utilisez h2 avant h3, h3 avant h4, etc.',
    h2KeywordLabel: 'Mot-cle dans un H2',
    h2KeywordPass: 'Le mot-cle est present dans au moins un sous-titre H2.',
    h2KeywordFail: (kw) => `Ajoutez le mot-cle "${kw}" dans l'un des sous-titres H2.`,
    frequencyLabel: 'Frequence des sous-titres',
    frequencyPass: (count, words) => `${count} sous-titre(s) pour ${words} mots — Bonne structure.`,
    frequencyFail: (count, words) => `Seulement ${count} sous-titre(s) pour ${words} mots — Ajoutez un sous-titre tous les ~300 mots.`,
    frequencyTip: 'Decoupez les longs paragraphes avec des sous-titres H2/H3 qui resument chaque section.',
    h1TitleDiffLabel: 'H1 different du meta title',
    h1TitleDiffFail: 'Le H1 et le meta title sont identiques — Differenciez-les pour couvrir plus de variations de mots-cles.',
    h1TitleDiffTip: 'Le meta title est optimise pour Google (avec le nom de marque). Le H1 peut etre plus descriptif ou accrocheur pour le visiteur.',
    h1TitleDiffPass: 'Le H1 et le meta title sont differents — Bonne pratique pour la diversite semantique.',
  },
  url: {
    missingLabel: 'Slug (URL)',
    missingMessage: 'Slug manquant — Definissez une URL pour cette page.',
    lengthLabel: 'Longueur du slug',
    lengthFail: (len) => `Slug trop long (${len} car.) — Gardez-le sous 75 caracteres.`,
    lengthPass: (len) => `Slug valide (${len} car.).`,
    formatLabel: 'Format du slug',
    formatFail: 'Slug contient des caracteres speciaux ou majuscules — Utilisez uniquement des minuscules, chiffres et tirets.',
    formatPass: 'Format du slug correct (minuscules, chiffres, tirets).',
    keywordLabel: 'Mot-cle dans le slug',
    keywordPass: 'Le mot-cle est present dans l\'URL.',
    keywordFail: (kw) => `Le mot-cle "${kw}" n'est pas dans l'URL — Integrez-le si possible.`,
    keywordUtilityPass: 'Page utilitaire — Le slug standard est adapte.',
    stopwordsLabel: 'Stop words dans le slug',
    stopwordsFail: (words) => `Le slug contient des mots vides (${words}) — Retirez-les pour un slug plus propre.`,
    stopwordsPass: 'Le slug ne contient pas de mots vides inutiles.',
  },
  content: {
    wordcountLabel: 'Volume de contenu',
    wordcountFail: (count, minLabel) => `Seulement ${count} mots — Visez au moins ${minLabel} pour un bon referencement.`,
    wordcountFailTip: 'Ajoutez des sections avec des sous-titres H2, des exemples concrets, une FAQ ou des temoignages.',
    wordcountWarn: (count, minLabel) => `${count} mots — Correct mais insuffisant. Visez ${minLabel}.`,
    wordcountWarnTip: 'Developpez le contenu avec des paragraphes explicatifs, des exemples ou une section FAQ.',
    wordcountPass: (count) => `${count} mots — Volume de contenu suffisant.`,
    keywordIntroLabel: 'Mot-cle dans l\'introduction',
    keywordIntroPass: 'Le mot-cle apparait dans le premier paragraphe — Bonne pratique.',
    keywordIntroFail: (kw) => `Ajoutez le mot-cle "${kw}" dans les premieres phrases du contenu.`,
    densityLabel: 'Densite du mot-cle',
    densityOverstuffed: (density) => `Densite du mot-cle : ${density}% — Trop eleve (>3%), risque de suroptimisation (keyword stuffing).`,
    densityHigh: (density) => `Densite du mot-cle : ${density}% — Legerement elevee. Restez entre 0,5% et 2,5%.`,
    densityPass: (density) => `Densite du mot-cle : ${density}% — Equilibre ideal.`,
    densityPassWordLevel: (density) => `Les composants du mot-cle sont presents dans le contenu (densite estimee : ${density}%).`,
    densityLowWordLevel: (density) => `Les composants du mot-cle sont presents mais peu frequents (densite estimee : ${density}%). Renforcez leur presence.`,
    densityLow: (density) => `Densite du mot-cle : ${density}% — Trop faible. Visez 0,5% a 2,5%.`,
    densityMissing: (kw) => `Le mot-cle "${kw}" n'apparait jamais dans le contenu.`,
    placeholderLabel: 'Contenu placeholder',
    placeholderFail: 'Du contenu placeholder a ete detecte (lorem ipsum, TODO, etc.) — Remplacez par du vrai contenu.',
    placeholderPass: 'Aucun contenu placeholder detecte.',
    placeholderTip: 'Recherchez "lorem", "TODO", "TBD" dans l\'editeur et remplacez par du vrai contenu metier.',
    thinLabel: 'Contenu trop fin',
    thinWarnLabel: 'Contenu trop fin',
    thinWarn: (count) => `Seulement ${count} mots de contenu — Les pages avec moins de 100 mots risquent d'etre ignorees par Google.`,
    thinWarnTip: 'Developpez le contenu avec des paragraphes explicatifs, des exemples concrets ou une FAQ.',
    thinPass: 'Le contenu est suffisamment riche pour etre indexe.',
    thinPassLabel: 'Contenu substantiel',
    distributionLabel: 'Distribution du mot-cle',
    distributionPass: (tiers) => `Mot-cle present dans ${tiers}/3 sections du contenu — Bonne repartition.`,
    distributionWarn: `Mot-cle present dans seulement 1/3 du contenu — Repartissez-le dans tout le texte.`,
    distributionWarnTip: 'Utilisez le mot-cle naturellement dans l\'introduction, le corps et la conclusion du texte.',
    distributionFail: 'Mot-cle absent des sections du contenu — Il doit apparaitre dans au moins 2 des 3 tiers.',
    distributionFailTip: 'Inserez le mot-cle dans l\'introduction, dans au moins un sous-titre H2 et dans la conclusion.',
    listsLabel: 'Listes dans le contenu',
    listsPass: (count) => `${count} liste(s) detectee(s) — Les listes ameliorent la lisibilite et les chances de featured snippet.`,
    listsFail: 'Aucune liste detectee — Ajoutez des listes a puces ou numerotees pour structurer le contenu.',
    listsTip: 'Utilisez des listes pour enumerer des etapes, des avantages ou des fonctionnalites. Google les utilise souvent pour les featured snippets.',
    minWordsPost: '800 mots (article)',
    minWordsForm: '150 mots (page formulaire)',
    minWordsLegal: '200 mots (page legale)',
    minWordsGeneric: '300 mots (page)',
  },
  secondaryKeywords: {
    titleLabel: (suffix) => `Mot-cle secondaire dans le title${suffix}`,
    titlePass: (kw) => `Le mot-cle secondaire "${kw}" est present dans le meta title.`,
    titleFail: (kw) => `Le mot-cle secondaire "${kw}" n'est pas dans le meta title.`,
    descLabel: (suffix) => `Mot-cle secondaire dans la description${suffix}`,
    descPass: (kw) => `Le mot-cle secondaire "${kw}" est present dans la meta description.`,
    descFail: (kw) => `Le mot-cle secondaire "${kw}" n'est pas dans la meta description.`,
    contentLabel: (suffix) => `Mot-cle secondaire dans le contenu${suffix}`,
    contentPass: (kw, count, density) => `Le mot-cle secondaire "${kw}" apparait ${count} fois (${density}%).`,
    contentFail: (kw) => `Le mot-cle secondaire "${kw}" n'apparait pas dans le contenu.`,
    headingLabel: (suffix) => `Mot-cle secondaire dans un H2/H3${suffix}`,
    headingPass: (kw) => `Le mot-cle secondaire "${kw}" est present dans un sous-titre H2 ou H3.`,
    headingFail: (kw) => `Ajoutez le mot-cle secondaire "${kw}" dans un sous-titre H2 ou H3.`,
  },
  images: {
    altLabel: 'Alt text images',
    altAllPass: (total) => `${total} image(s) avec alt text — Parfait.`,
    altSomeFail: (missing, total) => `${missing}/${total} image(s) sans texte alternatif — Ajoutez des alt texts descriptifs.`,
    altMostFail: (missing, total) => `${missing}/${total} image(s) sans texte alternatif — L'accessibilite et le SEO en souffrent.`,
    altKeywordLabel: 'Mot-cle dans un alt',
    altKeywordPass: 'Le mot-cle ou un alt descriptif est present sur au moins une image.',
    altKeywordFail: 'Integrez le mot-cle dans le texte alternatif d\'au moins une image.',
    presentLabel: 'Presence d\'images',
    presentPass: (total) => `${total} image(s) detectee(s).`,
    presentFail: 'Aucune image detectee — Ajoutez des visuels pour enrichir le contenu.',
    presentUtilityPass: 'Page utilitaire — Les images ne sont pas indispensables.',
    quantityLabel: 'Nombre d\'images',
    quantityPass: (total) => `${total} image(s) — Visuels presents.`,
    quantityFail: 'Aucune image dans cet article — Les articles sans images sont moins engageants.',
  },
  linking: {
    internalLabel: 'Liens internes',
    internalNone: 'Aucun lien interne detecte — Ajoutez des liens vers d\'autres pages du site.',
    internalFew: (count) => `${count} lien(s) interne(s) — Correct. Visez 3+ pour renforcer le maillage.`,
    internalGood: (count) => `${count} liens internes — Excellent maillage interne.`,
    externalLabel: 'Liens externes',
    externalNone: 'Aucun lien externe — Ajoutez des liens vers des sources fiables pour renforcer la credibilite.',
    externalPass: (count) => `${count} lien(s) externe(s) detecte(s).`,
    externalUtilityPass: 'Page utilitaire — Les liens externes ne sont pas indispensables.',
    genericAnchorsLabel: 'Ancres generiques',
    genericAnchorsFail: (count) => `${count} lien(s) avec des ancres generiques ("cliquez ici", "ici"...) — Utilisez des textes descriptifs.`,
    genericAnchorsPassLabel: 'Ancres descriptives',
    genericAnchorsPass: 'Tous les liens utilisent des textes d\'ancrage descriptifs.',
    emptyLinksLabel: 'Liens vides',
    emptyLinksFail: (count) => `${count} lien(s) vide(s) detecte(s) (href="" ou href="#") — Ajoutez des destinations valides.`,
    emptyLinksPassLabel: 'Liens valides',
    emptyLinksPass: 'Aucun lien vide detecte.',
  },
  cornerstone: {
    wordcountLabel: 'Longueur du contenu pilier',
    wordcountPass: (count) => `${count} mots — Le contenu pilier est suffisamment complet.`,
    wordcountFail: (count) => `${count} mots — Un contenu pilier devrait contenir au moins 1500 mots pour etre vraiment complet.`,
    internalLinksLabel: 'Maillage interne du contenu pilier',
    internalLinksPass: (count) => `${count} liens internes — Bon maillage pour un contenu pilier.`,
    internalLinksFail: (count) => `${count} lien(s) interne(s) — Un contenu pilier devrait avoir au moins 5 liens internes vers du contenu associe.`,
    focusKeywordLabel: 'Mot-cle principal du contenu pilier',
    focusKeywordPass: 'Un mot-cle principal est defini pour ce contenu pilier.',
    focusKeywordFail: 'Un contenu pilier DOIT avoir un mot-cle principal — Definissez-le dans la sidebar.',
    metaDescLabel: 'Meta description du contenu pilier',
    metaDescPass: (len) => `Meta description de ${len} caracteres — Optimale pour un contenu pilier.`,
    metaDescWarn: (len) => `Meta description de ${len} caracteres — Visez entre 120 et 160 caracteres pour un contenu pilier.`,
    metaDescFail: 'Un contenu pilier DOIT avoir une meta description — C\'est essentiel pour le CTR dans les SERP.',
  },
  readability: {
    fleschLabel: 'Score de lisibilite',
    fleschPass: (score) => `Score Flesch FR : ${score}/100 — Texte accessible.`,
    fleschWarn: (score) => `Score Flesch FR : ${score}/100 — Texte assez difficile. Simplifiez les phrases.`,
    fleschFail: (score) => `Score Flesch FR : ${score}/100 — Texte difficile a lire. Raccourcissez les phrases et simplifiez le vocabulaire.`,
    longSentencesLabelFail: 'Phrases trop longues',
    longSentencesLabelPass: 'Longueur des phrases',
    longSentencesFail: (long, total, pct) => `${long}/${total} phrases de plus de 25 mots (${pct}%) — Max recommande : 30%.`,
    longSentencesPass: (pct) => `${pct}% de phrases longues — Bonne distribution.`,
    longParagraphsLabel: 'Paragraphes longs',
    longParagraphsFail: 'Des paragraphes de plus de 150 mots ont ete detectes — Decoupez-les pour faciliter la lecture.',
    longParagraphsPass: 'Aucun paragraphe excessivement long.',
    passiveLabelFail: 'Voix passive',
    passiveLabelPass: 'Voix active',
    passiveFail: (count, total, pct) => `${count}/${total} phrases a la voix passive (${pct}%) — Max recommande : 15%.`,
    passivePass: (pct) => `${pct}% de voix passive — Bon usage de la voix active.`,
    transitionsLabel: 'Mots de transition',
    transitionsFail: (pct) => `${pct}% des phrases contiennent des mots de transition — Visez 15%+.`,
    transitionsPass: (pct) => `${pct}% des phrases avec mots de transition — Bonne fluidite.`,
    consecutiveLabelFail: 'Debuts de phrases repetitifs',
    consecutiveLabelPass: 'Variete des phrases',
    consecutiveFail: (count) => `${count} phrases consecutives commencent par le meme mot — Variez les debuts de phrases.`,
    consecutivePass: 'Les debuts de phrases sont suffisamment varies.',
    longSectionsLabelFail: 'Sections sans sous-titre',
    longSectionsLabelPass: 'Structure en sections',
    longSectionsFail: (count) => `${count} section(s) de plus de 400 mots sans sous-titre — Decoupez avec des h2/h3.`,
    longSectionsPass: 'Les sections sont bien decoupees avec des sous-titres.',
  },
  freshness: {
    ageLabel: 'Anciennete du contenu',
    ageEvergreenWarn: (days) => `Contenu non mis a jour depuis ${days} jours (>\u00A024 mois) — Verifiez que les informations legales sont toujours a jour.`,
    ageEvergreenPass: (days) => `Page evergreen — Mis a jour il y a ${days} jour${days !== 1 ? 's' : ''}.`,
    ageFail: (days) => `Contenu non mis a jour depuis ${days} jours (>\u00A012 mois) — Ce contenu est potentiellement obsolete.`,
    ageWarn: (days) => `Contenu non mis a jour depuis ${days} jours (>\u00A06 mois) — Pensez a le rafraichir.`,
    agePass: (days) => `Contenu mis a jour il y a ${days} jour${days !== 1 ? 's' : ''}.`,
    reviewLabel: 'Revision du contenu',
    reviewWarn: (days) => `Derniere revision il y a ${days} jours (>\u00A06 mois) — Verifiez que le contenu est toujours d'actualite.`,
    reviewPass: (days) => `Contenu revise il y a ${days} jour${days !== 1 ? 's' : ''}.`,
    yearRefLabel: 'References temporelles',
    yearRefWarn: (oldest, current, last) => `Le contenu mentionne l'annee ${oldest} sans reference a ${current} ou ${last} — Contenu potentiellement obsolete.`,
    yearRefPass: (year) => `Le contenu fait reference a l'annee en cours (${year}).`,
    thinAgingLabel: 'Contenu leger et ancien',
    thinAgingFail: (words, days) => `Seulement ${words} mots et non mis a jour depuis ${days} jours — Un contenu leger ancien perd rapidement en pertinence.`,
  },
  schema: {
    readinessLabel: 'Donnees structurees',
    readinessPass: 'La page a suffisamment de metadonnees pour generer du JSON-LD (title, description, image).',
    readinessFail: 'Completez le title, la description et ajoutez une image pour exploiter pleinement les donnees structurees.',
  },
  technical: {
    canonicalMissingLabel: 'URL canonique',
    canonicalMissingMessage: 'URL canonique vide — Definissez une URL canonique pour eviter le contenu duplique.',
    canonicalInvalidLabel: 'URL canonique',
    canonicalInvalidMessage: (url) => `URL canonique "${url}" invalide — Utilisez une URL absolue (https://...).`,
    canonicalExternalLabel: 'URL canonique',
    canonicalExternalMessage: 'URL canonique pointe vers un domaine externe — Verifiez que c\'est intentionnel.',
    canonicalOkLabel: 'URL canonique',
    canonicalOkMessage: 'URL canonique correctement definie.',
    robotsNoindexLabel: 'Robots noindex',
    robotsNoindexAcceptable: (pageType) => `Page en noindex — Acceptable pour une page ${pageType}, mais verifiez que c'est voulu.`,
    robotsNoindexFail: 'Page en noindex — Cette page ne sera PAS indexee par Google. Retirez le noindex sauf si c\'est intentionnel.',
    robotsNofollowLabel: 'Robots nofollow',
    robotsNofollowMessage: 'Page en nofollow — Les liens de cette page ne transmettront pas de "link juice". Verifiez que c\'est intentionnel.',
    robotsOkLabel: 'Robots meta',
    robotsOkMessage: 'Directives robots correctes — La page est indexable et suivie.',
  },
  social: {
    ogImageLabel: 'Image OG (meta)',
    ogImageFail: 'Aucune image meta definie — Ajoutez une image pour le partage sur les reseaux sociaux.',
    ogImagePass: 'Image meta definie — Parfait pour le partage social.',
    titleTruncLabel: 'Title sur les reseaux',
    titleTruncFail: (len) => `Le title (${len} car.) sera tronque sur certains reseaux sociaux (max ~65 car.).`,
    titleTruncPass: 'Le title ne sera pas tronque sur les reseaux sociaux.',
    descLengthLabel: 'Description sociale',
    descLengthFail: (len) => `La description (${len} car.) sera tronquee sur Facebook/LinkedIn (max ~155 car.).`,
    descLengthPass: 'La description est adaptee au partage social.',
  },
  accessibility: {
    shortAnchorsLabel: 'Liens avec ancre courte',
    shortAnchorsFail: (count, example) => `${count} lien(s) avec un texte d'ancre de moins de 3 caracteres (ex: "${example}") — Les lecteurs d'ecran ne peuvent pas interpreter ces liens.`,
    shortAnchorsPass: 'Tous les liens ont un texte d\'ancre suffisamment long.',
    shortAnchorsTip: 'Remplacez les ancres courtes par un texte descriptif (ex: "en savoir plus sur nos services" au lieu de "->").',
    altQualityLabel: 'Qualite des textes alternatifs',
    altQualityFail: (count, example) => `${count} image(s) avec un alt generique ou de type nom de fichier (ex: "${example}") — Un alt descriptif ameliore l'accessibilite.`,
    altQualityPass: 'Tous les textes alternatifs sont descriptifs.',
    altQualityTip: 'Redigez un alt qui decrit le contenu de l\'image (ex: "Logo de l\'entreprise" au lieu de "image1").',
    emptyHeadingsLabel: 'Titres vides',
    emptyHeadingsFail: (count, tags) => `${count} titre(s) vide(s) detecte(s) (${tags}) — Les titres vides perturbent la navigation par lecteur d'ecran.`,
    emptyHeadingsPass: 'Aucun titre vide detecte.',
    emptyHeadingsTip: 'Ajoutez du texte dans chaque titre ou supprimez les titres vides.',
    duplicateLinksLabel: 'Liens adjacents dupliques',
    duplicateLinksFail: (count) => `${count} paire(s) de liens adjacents pointant vers la meme URL — Fusionnez-les pour simplifier la navigation.`,
    duplicateLinksPass: 'Aucun lien adjacent duplique.',
    duplicateLinksTip: 'Combinez les liens adjacents en un seul lien englobant (ex: image + texte dans un meme <a>).',
    allCapsLabel: 'Titres en majuscules',
    allCapsFail: (count, example) => `${count} titre(s) en MAJUSCULES (ex: "${example}") — Les lecteurs d'ecran peuvent epeler chaque lettre.`,
    allCapsPass: 'Aucun titre en majuscules detecte.',
    allCapsTip: 'Utilisez la casse normale et appliquez text-transform: uppercase en CSS si besoin.',
    linkDensityLabel: 'Densite de liens',
    linkDensityFail: (pct) => `Le texte des liens represente ${pct}% du contenu — Ratio trop eleve, la page ressemble a une page de spam.`,
    linkDensityWarn: (pct) => `Le texte des liens represente ${pct}% du contenu — Ratio eleve, reduisez le nombre de liens ou augmentez le contenu textuel.`,
    linkDensityPass: (pct) => `Le texte des liens represente ${pct}% du contenu — Ratio equilibre.`,
    linkDensityNoContent: 'Pas de contenu textuel pour calculer la densite de liens.',
    linkDensityTip: 'Reduisez le nombre de liens ou enrichissez le contenu textuel pour equilibrer le ratio.',
    imageFilenameLabel: 'Noms de fichiers dans les alt',
    imageFilenameFail: (count, example) => `${count} image(s) avec un alt ressemblant a un nom de fichier (ex: "${example}") — Redigez une description du contenu de l'image.`,
    imageFilenamePass: 'Aucun alt de type nom de fichier detecte.',
    imageFilenameTip: 'Remplacez les noms de fichiers (IMG_001, DSC_234) par une description utile de l\'image.',
    altDuplicatesLabel: 'Alt identique a un titre',
    altDuplicatesFail: (count, example) => `${count} image(s) dont l'alt est identique a un titre de la page (ex: "${example}") — L'information est redondante pour les lecteurs d'ecran.`,
    altDuplicatesPass: 'Aucun alt redondant avec les titres de la page.',
    altDuplicatesTip: 'Differenciez le texte alternatif des titres en decrivant specifiquement ce que montre l\'image.',
  },
  quality: {
    noDuplicateLabel: 'Contenu original',
    noDuplicateFail: 'Du contenu generique ou duplique a ete detecte — Remplacez par du contenu unique et pertinent.',
    noDuplicatePass: 'Le contenu semble original et unique.',
    substantialLabel: 'Contenu substantiel',
    substantialFail: (count) => `Seulement ${count} mots — Contenu insuffisant pour offrir de la valeur au lecteur.`,
    substantialWarn: (count) => `${count} mots — Le contenu est leger. Enrichissez-le pour mieux repondre a l'intention de recherche.`,
    substantialPass: (count) => `${count} mots — Volume de contenu adequat.`,
  },
  ecommerce: {
    priceLabel: 'Prix dans le contenu',
    pricePass: 'Le contenu mentionne un prix — Les utilisateurs peuvent identifier le cout du produit.',
    priceFail: 'Aucun prix detecte dans le contenu — Mentionnez le prix ou une indication tarifaire pour ameliorer le taux de conversion.',
    priceTip: 'Ajoutez le prix du produit ou une mention "a partir de X\u20AC" dans la description.',
    descriptionLabel: 'Longueur description produit',
    descriptionPass: (count) => `Description produit de ${count} mots — Suffisamment detaillee pour le SEO.`,
    descriptionFail: (count, min) => `Description produit de ${count} mots (minimum recommande : ${min}) — Les descriptions longues ameliorent le positionnement et la conversion.`,
    descriptionTip: 'Enrichissez la description avec les caracteristiques, avantages, cas d\'utilisation et specifications du produit.',
    imagesLabel: 'Images produit',
    imagesPass: (count) => `${count} image(s) trouvee(s) — Bon nombre d'images pour presenter le produit.`,
    imagesWarn: (count, min) => `${count} seule image trouvee (recommande : ${min}+) — Ajoutez des images supplementaires pour montrer le produit sous differents angles.`,
    imagesFail: 'Aucune image trouvee — Les produits sans photo sont tres difficiles a vendre en ligne.',
    imagesTip: 'Ajoutez des photos sous differents angles, des zooms sur les details et une photo d\'ambiance.',
    brandLabel: 'Marque dans le titre',
    brandPass: 'Le titre contient le mot-cle produit/marque — Bon pour le referencement produit.',
    brandFailKw: (kw) => `Le titre ne contient pas le mot-cle "${kw}" — Incluez le nom du produit ou de la marque dans le titre.`,
    brandFailNoKw: 'Aucun mot-cle focus defini — Definissez le nom du produit comme mot-cle focus pour optimiser le titre.',
    brandTip: 'Placez le nom du produit ou de la marque au debut du meta titre.',
    metaPriceLabel: 'Prix dans la meta description',
    metaPricePass: 'La meta description mentionne le prix — Ameliore le taux de clic dans les resultats de recherche.',
    metaPriceFail: 'La meta description ne mentionne pas le prix — Inclure le prix ou "a partir de X\u20AC" ameliore le CTR.',
    metaPriceTip: 'Ajoutez le prix ou une fourchette tarifaire dans votre meta description (ex: "a partir de 29\u20AC").',
    reviewLabel: 'Avis et evaluations',
    reviewPass: 'Le contenu fait reference a des avis/evaluations — Bon signal de confiance pour les acheteurs.',
    reviewFail: 'Aucune mention d\'avis ou d\'evaluations detectee — Les avis clients augmentent la confiance et le taux de conversion.',
    reviewTip: 'Ajoutez une section avis clients ou integrez des donnees structurees Review/AggregateRating.',
    availabilityLabel: 'Disponibilite produit',
    availabilityPass: 'Information de disponibilite detectee — Les acheteurs savent si le produit est disponible.',
    availabilityFail: 'Aucune information de disponibilite detectee — Indiquez clairement si le produit est en stock, sur commande, etc.',
    availabilityTip: 'Ajoutez une mention de disponibilite (en stock, sur commande, delai de livraison).',
  },
}

// ---------------------------------------------------------------------------
// English rule translations
// ---------------------------------------------------------------------------

const rulesEn: RuleTranslations = {
  title: {
    missingLabel: 'Meta title',
    missingMessage: 'Meta title is missing — Add a title for search engine optimization.',
    missingTip: 'Write a 30-60 character title containing the focus keyword and brand name.',
    lengthLabel: 'Title length',
    lengthShort: (len) => `Meta title (${len} chars) — Too short. Aim for 30 to 60 characters.`,
    lengthShortTip: 'Add descriptive words or the brand name to reach at least 30 characters.',
    lengthLong: (len) => `Meta title (${len} chars) — Too long, will be truncated in Google. Reduce to 60 max.`,
    lengthLongTip: 'Google truncates beyond ~60 characters. Remove unnecessary words and keep the essentials.',
    lengthPass: (len) => `Meta title (${len} chars) — Ideal length.`,
    keywordLabel: 'Keyword in title',
    keywordPass: (kw) => `The keyword "${kw}" is present in the meta title.`,
    keywordFail: (kw) => `The keyword "${kw}" is not in the meta title — Add it for better SEO.`,
    keywordPositionLabel: 'Keyword position',
    keywordPositionPass: 'The keyword is placed at the beginning of the title — Ideal position.',
    keywordPositionFail: 'The keyword is at the end of the title — Place it at the beginning for better impact.',
    duplicateBrandLabel: 'Duplicate brand name',
    duplicateBrandFail: 'The title contains a duplicated part (e.g. "Brand | Brand") — Remove the duplicate.',
    duplicateBrandTip: 'Check that the meta title generator does not automatically add the brand name if you already included it.',
    duplicateBrandPass: 'No duplication in the title.',
    powerWordsLabel: 'Power words in title',
    powerWordsPass: (count, words) => `The title contains ${count} power word(s): ${words}`,
    powerWordsFail: 'The title contains no power words — Add a word like "free", "guide", "ultimate" to boost CTR.',
    powerWordsTip: 'Power words (free, exclusive, guide, ultimate, essential...) attract attention in search results.',
    hasNumberLabel: 'Number in title',
    hasNumberPass: 'The title contains a number — Titles with numbers generate +36% CTR.',
    hasNumberFail: 'No number in the title — Titles with numbers (e.g. "5 tips", "Top 10") attract more clicks.',
    hasNumberTip: 'Add a number to create a list-type title (e.g. "7 tips for...", "The 3 mistakes to avoid").',
    isQuestionLabel: 'Question title',
    isQuestionPass: 'The title is phrased as a question — Ideal for Google Featured Snippets.',
    isQuestionFail: 'The title is not a question — Question titles favor featured snippets.',
    isQuestionTip: 'Rephrase as a question if relevant (e.g. "How to optimize your SEO?").',
    sentimentLabel: 'Emotional words in title',
    sentimentPass: (count, words) => `The title contains ${count} emotional word(s): ${words}`,
    sentimentFail: 'The title contains no emotional words — High-emotion words increase click-through rate.',
    sentimentTip: 'Add an emotional word to capture attention (e.g. "mistake", "secret", "incredible").',
  },
  metaDescription: {
    missingLabel: 'Meta description',
    missingMessage: 'Meta description is missing — Add a description for search engine optimization.',
    missingTip: 'Write a 120-160 character sentence that summarizes the page and encourages clicks. Include the focus keyword.',
    lengthLabel: 'Description length',
    lengthShort: (len) => `Meta description (${len} chars) — Too short. Aim for 120 to 160 characters.`,
    lengthShortTip: 'Complete with page benefits or a call to action (e.g. "Free quote within 24h").',
    lengthLong: (len) => `Meta description (${len} chars) — Too long, will be truncated. Reduce to 160 max.`,
    lengthLongTip: 'Google truncates beyond ~160 characters. Remove secondary details and keep the essentials.',
    lengthPass: (len) => `Meta description (${len} chars) — Ideal length.`,
    keywordLabel: 'Keyword in description',
    keywordPass: (kw) => `The keyword "${kw}" is present in the meta description.`,
    keywordFail: (kw) => `The keyword "${kw}" is not in the meta description.`,
    ctaLabel: 'Action verb (CTA)',
    ctaPass: 'The meta description contains a compelling element — Good for click-through rate.',
    ctaFail: 'Add an action verb (discover, contact, get...) to encourage clicks.',
    ctaTip: 'Start with an imperative verb (Discover, Enjoy, Get) or use a number ("5 reasons to...").',
  },
  headings: {
    h1MissingLabel: 'H1 heading',
    h1MissingMessage: 'No H1 heading detected — Add a main heading in the hero section.',
    h1MissingTip: 'The H1 is the main heading of the page. It should contain the keyword and summarize the topic in one sentence.',
    h1UniqueLabel: 'Unique H1 heading',
    h1MultipleMessage: (count) => `${count} H1 headings detected — Keep only one H1 per page.`,
    h1UniquePass: 'Only one H1 detected — Perfect.',
    h1KeywordLabel: 'Keyword in H1',
    h1KeywordPass: 'The keyword is present in the H1 heading.',
    h1KeywordFail: (kw) => `The keyword "${kw}" is not in the H1 — Add it to the main heading.`,
    hierarchyLabel: 'Heading hierarchy',
    hierarchyPass: 'The heading hierarchy is correct (h2 before h3, etc.).',
    hierarchyFail: 'The heading hierarchy is not respected — Use h2 before h3, h3 before h4, etc.',
    h2KeywordLabel: 'Keyword in an H2',
    h2KeywordPass: 'The keyword is present in at least one H2 subheading.',
    h2KeywordFail: (kw) => `Add the keyword "${kw}" to one of the H2 subheadings.`,
    frequencyLabel: 'Subheading frequency',
    frequencyPass: (count, words) => `${count} subheading(s) for ${words} words — Good structure.`,
    frequencyFail: (count, words) => `Only ${count} subheading(s) for ${words} words — Add a subheading every ~300 words.`,
    frequencyTip: 'Break up long paragraphs with H2/H3 subheadings that summarize each section.',
    h1TitleDiffLabel: 'H1 different from meta title',
    h1TitleDiffFail: 'The H1 and meta title are identical — Differentiate them to cover more keyword variations.',
    h1TitleDiffTip: 'The meta title is optimized for Google (with brand name). The H1 can be more descriptive or catchy for visitors.',
    h1TitleDiffPass: 'The H1 and meta title are different — Good practice for semantic diversity.',
  },
  url: {
    missingLabel: 'Slug (URL)',
    missingMessage: 'Slug is missing — Define a URL for this page.',
    lengthLabel: 'Slug length',
    lengthFail: (len) => `Slug too long (${len} chars) — Keep it under 75 characters.`,
    lengthPass: (len) => `Valid slug (${len} chars).`,
    formatLabel: 'Slug format',
    formatFail: 'Slug contains special characters or uppercase — Use only lowercase, numbers and hyphens.',
    formatPass: 'Slug format is correct (lowercase, numbers, hyphens).',
    keywordLabel: 'Keyword in slug',
    keywordPass: 'The keyword is present in the URL.',
    keywordFail: (kw) => `The keyword "${kw}" is not in the URL — Add it if possible.`,
    keywordUtilityPass: 'Utility page — The standard slug is appropriate.',
    stopwordsLabel: 'Stop words in slug',
    stopwordsFail: (words) => `The slug contains stop words (${words}) — Remove them for a cleaner slug.`,
    stopwordsPass: 'The slug does not contain unnecessary stop words.',
  },
  content: {
    wordcountLabel: 'Content volume',
    wordcountFail: (count, minLabel) => `Only ${count} words — Aim for at least ${minLabel} for good SEO.`,
    wordcountFailTip: 'Add sections with H2 subheadings, concrete examples, an FAQ or testimonials.',
    wordcountWarn: (count, minLabel) => `${count} words — Decent but insufficient. Aim for ${minLabel}.`,
    wordcountWarnTip: 'Expand the content with explanatory paragraphs, examples or an FAQ section.',
    wordcountPass: (count) => `${count} words — Sufficient content volume.`,
    keywordIntroLabel: 'Keyword in introduction',
    keywordIntroPass: 'The keyword appears in the first paragraph — Good practice.',
    keywordIntroFail: (kw) => `Add the keyword "${kw}" in the first sentences of the content.`,
    densityLabel: 'Keyword density',
    densityOverstuffed: (density) => `Keyword density: ${density}% — Too high (>3%), risk of keyword stuffing.`,
    densityHigh: (density) => `Keyword density: ${density}% — Slightly high. Stay between 0.5% and 2.5%.`,
    densityPass: (density) => `Keyword density: ${density}% — Ideal balance.`,
    densityPassWordLevel: (density) => `Keyword components are present in the content (estimated density: ${density}%).`,
    densityLowWordLevel: (density) => `Keyword components are present but infrequent (estimated density: ${density}%). Strengthen their presence.`,
    densityLow: (density) => `Keyword density: ${density}% — Too low. Aim for 0.5% to 2.5%.`,
    densityMissing: (kw) => `The keyword "${kw}" never appears in the content.`,
    placeholderLabel: 'Placeholder content',
    placeholderFail: 'Placeholder content detected (lorem ipsum, TODO, etc.) — Replace with real content.',
    placeholderPass: 'No placeholder content detected.',
    placeholderTip: 'Search for "lorem", "TODO", "TBD" in the editor and replace with real business content.',
    thinLabel: 'Thin content',
    thinWarnLabel: 'Thin content',
    thinWarn: (count) => `Only ${count} words of content — Pages with fewer than 100 words risk being ignored by Google.`,
    thinWarnTip: 'Expand the content with explanatory paragraphs, concrete examples or an FAQ.',
    thinPass: 'The content is rich enough to be indexed.',
    thinPassLabel: 'Substantial content',
    distributionLabel: 'Keyword distribution',
    distributionPass: (tiers) => `Keyword present in ${tiers}/3 content sections — Good distribution.`,
    distributionWarn: 'Keyword present in only 1/3 of the content — Distribute it throughout the text.',
    distributionWarnTip: 'Use the keyword naturally in the introduction, body and conclusion of the text.',
    distributionFail: 'Keyword absent from content sections — It should appear in at least 2 of 3 thirds.',
    distributionFailTip: 'Insert the keyword in the introduction, in at least one H2 subheading and in the conclusion.',
    listsLabel: 'Lists in content',
    listsPass: (count) => `${count} list(s) detected — Lists improve readability and featured snippet chances.`,
    listsFail: 'No list detected — Add bullet or numbered lists to structure the content.',
    listsTip: 'Use lists to enumerate steps, benefits or features. Google often uses them for featured snippets.',
    minWordsPost: '800 words (article)',
    minWordsForm: '150 words (form page)',
    minWordsLegal: '200 words (legal page)',
    minWordsGeneric: '300 words (page)',
  },
  secondaryKeywords: {
    titleLabel: (suffix) => `Secondary keyword in title${suffix}`,
    titlePass: (kw) => `The secondary keyword "${kw}" is present in the meta title.`,
    titleFail: (kw) => `The secondary keyword "${kw}" is not in the meta title.`,
    descLabel: (suffix) => `Secondary keyword in description${suffix}`,
    descPass: (kw) => `The secondary keyword "${kw}" is present in the meta description.`,
    descFail: (kw) => `The secondary keyword "${kw}" is not in the meta description.`,
    contentLabel: (suffix) => `Secondary keyword in content${suffix}`,
    contentPass: (kw, count, density) => `The secondary keyword "${kw}" appears ${count} time(s) (${density}%).`,
    contentFail: (kw) => `The secondary keyword "${kw}" does not appear in the content.`,
    headingLabel: (suffix) => `Secondary keyword in H2/H3${suffix}`,
    headingPass: (kw) => `The secondary keyword "${kw}" is present in an H2 or H3 subheading.`,
    headingFail: (kw) => `Add the secondary keyword "${kw}" to an H2 or H3 subheading.`,
  },
  images: {
    altLabel: 'Image alt text',
    altAllPass: (total) => `${total} image(s) with alt text — Perfect.`,
    altSomeFail: (missing, total) => `${missing}/${total} image(s) without alt text — Add descriptive alt texts.`,
    altMostFail: (missing, total) => `${missing}/${total} image(s) without alt text — Accessibility and SEO suffer.`,
    altKeywordLabel: 'Keyword in alt text',
    altKeywordPass: 'The keyword or a descriptive alt text is present on at least one image.',
    altKeywordFail: 'Add the keyword to the alt text of at least one image.',
    presentLabel: 'Images present',
    presentPass: (total) => `${total} image(s) detected.`,
    presentFail: 'No image detected — Add visuals to enrich the content.',
    presentUtilityPass: 'Utility page — Images are not essential.',
    quantityLabel: 'Number of images',
    quantityPass: (total) => `${total} image(s) — Visuals present.`,
    quantityFail: 'No image in this article — Articles without images are less engaging.',
  },
  linking: {
    internalLabel: 'Internal links',
    internalNone: 'No internal link detected — Add links to other pages on the site.',
    internalFew: (count) => `${count} internal link(s) — OK. Aim for 3+ to strengthen internal linking.`,
    internalGood: (count) => `${count} internal links — Excellent internal linking.`,
    externalLabel: 'External links',
    externalNone: 'No external link — Add links to reliable sources to strengthen credibility.',
    externalPass: (count) => `${count} external link(s) detected.`,
    externalUtilityPass: 'Utility page — External links are not essential.',
    genericAnchorsLabel: 'Generic anchors',
    genericAnchorsFail: (count) => `${count} link(s) with generic anchors ("click here", "here"...) — Use descriptive text.`,
    genericAnchorsPassLabel: 'Descriptive anchors',
    genericAnchorsPass: 'All links use descriptive anchor text.',
    emptyLinksLabel: 'Empty links',
    emptyLinksFail: (count) => `${count} empty link(s) detected (href="" or href="#") — Add valid destinations.`,
    emptyLinksPassLabel: 'Valid links',
    emptyLinksPass: 'No empty link detected.',
  },
  cornerstone: {
    wordcountLabel: 'Pillar content length',
    wordcountPass: (count) => `${count} words — The pillar content is comprehensive enough.`,
    wordcountFail: (count) => `${count} words — Pillar content should contain at least 1500 words to be truly comprehensive.`,
    internalLinksLabel: 'Pillar content internal linking',
    internalLinksPass: (count) => `${count} internal links — Good linking for pillar content.`,
    internalLinksFail: (count) => `${count} internal link(s) — Pillar content should have at least 5 internal links to related content.`,
    focusKeywordLabel: 'Pillar content focus keyword',
    focusKeywordPass: 'A focus keyword is defined for this pillar content.',
    focusKeywordFail: 'Pillar content MUST have a focus keyword — Define it in the sidebar.',
    metaDescLabel: 'Pillar content meta description',
    metaDescPass: (len) => `Meta description of ${len} characters — Optimal for pillar content.`,
    metaDescWarn: (len) => `Meta description of ${len} characters — Aim for 120 to 160 characters for pillar content.`,
    metaDescFail: 'Pillar content MUST have a meta description — Essential for CTR in SERPs.',
  },
  readability: {
    fleschLabel: 'Readability score',
    fleschPass: (score) => `Flesch score: ${score}/100 — Text is accessible.`,
    fleschWarn: (score) => `Flesch score: ${score}/100 — Text is fairly difficult. Simplify sentences.`,
    fleschFail: (score) => `Flesch score: ${score}/100 — Text is hard to read. Shorten sentences and simplify vocabulary.`,
    longSentencesLabelFail: 'Long sentences',
    longSentencesLabelPass: 'Sentence length',
    longSentencesFail: (long, total, pct) => `${long}/${total} sentences over 25 words (${pct}%) — Recommended max: 30%.`,
    longSentencesPass: (pct) => `${pct}% long sentences — Good distribution.`,
    longParagraphsLabel: 'Long paragraphs',
    longParagraphsFail: 'Paragraphs with more than 150 words detected — Break them up for easier reading.',
    longParagraphsPass: 'No excessively long paragraphs.',
    passiveLabelFail: 'Passive voice',
    passiveLabelPass: 'Active voice',
    passiveFail: (count, total, pct) => `${count}/${total} passive voice sentences (${pct}%) — Recommended max: 15%.`,
    passivePass: (pct) => `${pct}% passive voice — Good use of active voice.`,
    transitionsLabel: 'Transition words',
    transitionsFail: (pct) => `${pct}% of sentences contain transition words — Aim for 15%+.`,
    transitionsPass: (pct) => `${pct}% of sentences with transition words — Good flow.`,
    consecutiveLabelFail: 'Repetitive sentence starts',
    consecutiveLabelPass: 'Sentence variety',
    consecutiveFail: (count) => `${count} consecutive sentences start with the same word — Vary sentence beginnings.`,
    consecutivePass: 'Sentence beginnings are sufficiently varied.',
    longSectionsLabelFail: 'Sections without subheading',
    longSectionsLabelPass: 'Section structure',
    longSectionsFail: (count) => `${count} section(s) over 400 words without a subheading — Break up with h2/h3.`,
    longSectionsPass: 'Sections are well divided with subheadings.',
  },
  freshness: {
    ageLabel: 'Content age',
    ageEvergreenWarn: (days) => `Content not updated for ${days} days (>\u00A024 months) — Verify that legal information is still current.`,
    ageEvergreenPass: (days) => `Evergreen page — Updated ${days} day${days !== 1 ? 's' : ''} ago.`,
    ageFail: (days) => `Content not updated for ${days} days (>\u00A012 months) — This content is potentially outdated.`,
    ageWarn: (days) => `Content not updated for ${days} days (>\u00A06 months) — Consider refreshing it.`,
    agePass: (days) => `Content updated ${days} day${days !== 1 ? 's' : ''} ago.`,
    reviewLabel: 'Content review',
    reviewWarn: (days) => `Last review ${days} days ago (>\u00A06 months) — Verify the content is still up to date.`,
    reviewPass: (days) => `Content reviewed ${days} day${days !== 1 ? 's' : ''} ago.`,
    yearRefLabel: 'Year references',
    yearRefWarn: (oldest, current, last) => `The content mentions year ${oldest} without reference to ${current} or ${last} — Potentially outdated.`,
    yearRefPass: (year) => `The content references the current year (${year}).`,
    thinAgingLabel: 'Thin and old content',
    thinAgingFail: (words, days) => `Only ${words} words and not updated for ${days} days — Thin old content loses relevance quickly.`,
  },
  schema: {
    readinessLabel: 'Structured data',
    readinessPass: 'The page has sufficient metadata to generate JSON-LD (title, description, image).',
    readinessFail: 'Complete the title, description and add an image to fully leverage structured data.',
  },
  technical: {
    canonicalMissingLabel: 'Canonical URL',
    canonicalMissingMessage: 'Empty canonical URL — Define a canonical URL to avoid duplicate content.',
    canonicalInvalidLabel: 'Canonical URL',
    canonicalInvalidMessage: (url) => `Canonical URL "${url}" is invalid — Use an absolute URL (https://...).`,
    canonicalExternalLabel: 'Canonical URL',
    canonicalExternalMessage: 'Canonical URL points to an external domain — Verify this is intentional.',
    canonicalOkLabel: 'Canonical URL',
    canonicalOkMessage: 'Canonical URL is correctly defined.',
    robotsNoindexLabel: 'Robots noindex',
    robotsNoindexAcceptable: (pageType) => `Page is noindex — Acceptable for a ${pageType} page, but verify this is intended.`,
    robotsNoindexFail: 'Page is noindex — This page will NOT be indexed by Google. Remove noindex unless intentional.',
    robotsNofollowLabel: 'Robots nofollow',
    robotsNofollowMessage: 'Page is nofollow — Links on this page will not pass "link juice". Verify this is intentional.',
    robotsOkLabel: 'Robots meta',
    robotsOkMessage: 'Robots directives are correct — The page is indexable and followed.',
  },
  social: {
    ogImageLabel: 'OG image (meta)',
    ogImageFail: 'No meta image defined — Add an image for social media sharing.',
    ogImagePass: 'Meta image defined — Perfect for social sharing.',
    titleTruncLabel: 'Title on social networks',
    titleTruncFail: (len) => `The title (${len} chars) will be truncated on some social networks (max ~65 chars).`,
    titleTruncPass: 'The title will not be truncated on social networks.',
    descLengthLabel: 'Social description',
    descLengthFail: (len) => `The description (${len} chars) will be truncated on Facebook/LinkedIn (max ~155 chars).`,
    descLengthPass: 'The description is suitable for social sharing.',
  },
  accessibility: {
    shortAnchorsLabel: 'Short anchor links',
    shortAnchorsFail: (count, example) => `${count} link(s) with anchor text under 3 characters (e.g. "${example}") — Screen readers cannot interpret these links.`,
    shortAnchorsPass: 'All links have sufficiently long anchor text.',
    shortAnchorsTip: 'Replace short anchors with descriptive text (e.g. "learn more about our services" instead of "->").',
    altQualityLabel: 'Alt text quality',
    altQualityFail: (count, example) => `${count} image(s) with generic or filename-like alt text (e.g. "${example}") — A descriptive alt improves accessibility.`,
    altQualityPass: 'All alt texts are descriptive.',
    altQualityTip: 'Write alt text that describes the image content (e.g. "Company logo" instead of "image1").',
    emptyHeadingsLabel: 'Empty headings',
    emptyHeadingsFail: (count, tags) => `${count} empty heading(s) detected (${tags}) — Empty headings disrupt screen reader navigation.`,
    emptyHeadingsPass: 'No empty headings detected.',
    emptyHeadingsTip: 'Add text to each heading or remove empty headings.',
    duplicateLinksLabel: 'Adjacent duplicate links',
    duplicateLinksFail: (count) => `${count} pair(s) of adjacent links pointing to the same URL — Merge them to simplify navigation.`,
    duplicateLinksPass: 'No adjacent duplicate links.',
    duplicateLinksTip: 'Combine adjacent links into a single wrapping link (e.g. image + text in one <a>).',
    allCapsLabel: 'All-caps headings',
    allCapsFail: (count, example) => `${count} heading(s) in ALL CAPS (e.g. "${example}") — Screen readers may spell out each letter.`,
    allCapsPass: 'No all-caps headings detected.',
    allCapsTip: 'Use normal case and apply text-transform: uppercase in CSS if needed.',
    linkDensityLabel: 'Link density',
    linkDensityFail: (pct) => `Link text represents ${pct}% of content — Ratio too high, the page looks like spam.`,
    linkDensityWarn: (pct) => `Link text represents ${pct}% of content — High ratio, reduce links or increase text content.`,
    linkDensityPass: (pct) => `Link text represents ${pct}% of content — Balanced ratio.`,
    linkDensityNoContent: 'No text content to calculate link density.',
    linkDensityTip: 'Reduce the number of links or enrich the text content to balance the ratio.',
    imageFilenameLabel: 'Filenames in alt text',
    imageFilenameFail: (count, example) => `${count} image(s) with alt text resembling a filename (e.g. "${example}") — Write a description of the image content.`,
    imageFilenamePass: 'No filename-like alt text detected.',
    imageFilenameTip: 'Replace filenames (IMG_001, DSC_234) with a useful description of the image.',
    altDuplicatesLabel: 'Alt identical to heading',
    altDuplicatesFail: (count, example) => `${count} image(s) with alt text identical to a page heading (e.g. "${example}") — Redundant for screen readers.`,
    altDuplicatesPass: 'No alt text redundant with page headings.',
    altDuplicatesTip: 'Differentiate alt text from headings by specifically describing what the image shows.',
  },
  quality: {
    noDuplicateLabel: 'Original content',
    noDuplicateFail: 'Generic or duplicate content detected — Replace with unique and relevant content.',
    noDuplicatePass: 'The content appears original and unique.',
    substantialLabel: 'Substantial content',
    substantialFail: (count) => `Only ${count} words — Insufficient content to provide value to the reader.`,
    substantialWarn: (count) => `${count} words — Content is thin. Enrich it to better answer search intent.`,
    substantialPass: (count) => `${count} words — Adequate content volume.`,
  },
  ecommerce: {
    priceLabel: 'Price in content',
    pricePass: 'The content mentions a price — Users can identify the product cost.',
    priceFail: 'No price detected in the content — Mention the price or a price indication to improve conversion rate.',
    priceTip: 'Add the product price or a "starting from $X" mention in the description.',
    descriptionLabel: 'Product description length',
    descriptionPass: (count) => `Product description of ${count} words — Detailed enough for SEO.`,
    descriptionFail: (count, min) => `Product description of ${count} words (recommended minimum: ${min}) — Longer descriptions improve ranking and conversion.`,
    descriptionTip: 'Enrich the description with features, benefits, use cases and product specifications.',
    imagesLabel: 'Product images',
    imagesPass: (count) => `${count} image(s) found — Good number of images to showcase the product.`,
    imagesWarn: (count, min) => `${count} image found (recommended: ${min}+) — Add more images to show the product from different angles.`,
    imagesFail: 'No image found — Products without photos are very difficult to sell online.',
    imagesTip: 'Add photos from different angles, detail close-ups and a lifestyle photo.',
    brandLabel: 'Brand in title',
    brandPass: 'The title contains the product/brand keyword — Good for product SEO.',
    brandFailKw: (kw) => `The title does not contain the keyword "${kw}" — Include the product or brand name in the title.`,
    brandFailNoKw: 'No focus keyword defined — Set the product name as the focus keyword to optimize the title.',
    brandTip: 'Place the product or brand name at the beginning of the meta title.',
    metaPriceLabel: 'Price in meta description',
    metaPricePass: 'The meta description mentions the price — Improves click-through rate in search results.',
    metaPriceFail: 'The meta description does not mention the price — Including the price or "starting from $X" improves CTR.',
    metaPriceTip: 'Add the price or a price range in your meta description (e.g. "starting from $29").',
    reviewLabel: 'Reviews and ratings',
    reviewPass: 'The content references reviews/ratings — Good trust signal for buyers.',
    reviewFail: 'No mention of reviews or ratings detected — Customer reviews increase trust and conversion rate.',
    reviewTip: 'Add a customer reviews section or integrate Review/AggregateRating structured data.',
    availabilityLabel: 'Product availability',
    availabilityPass: 'Availability information detected — Buyers know if the product is available.',
    availabilityFail: 'No availability information detected — Clearly indicate if the product is in stock, on order, etc.',
    availabilityTip: 'Add an availability mention (in stock, on order, delivery time).',
  },
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
  rules: rulesFr,
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
  rules: rulesEn,
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
