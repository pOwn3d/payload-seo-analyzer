/**
 * SEO Analyzer — Shared constants.
 * Centralizes thresholds, limits, and shared lists used across rule modules.
 * Importing from here ensures consistency and makes tuning easy.
 *
 * v1.4.0: Bilingual support (FR/EN) for all language-specific constants.
 */

// ---------------------------------------------------------------------------
// Title & meta description lengths
// ---------------------------------------------------------------------------

export const TITLE_LENGTH_MIN = 30
export const TITLE_LENGTH_MAX = 60
export const META_DESC_LENGTH_MIN = 120
export const META_DESC_LENGTH_MAX = 160

// ---------------------------------------------------------------------------
// Content word-count thresholds (by page type)
// ---------------------------------------------------------------------------

export const MIN_WORDS_POST = 800
export const MIN_WORDS_FORM = 150
export const MIN_WORDS_LEGAL = 200
export const MIN_WORDS_GENERIC = 300
export const MIN_WORDS_THIN = 100

// Quality thresholds
export const MIN_WORDS_QUALITY_FAIL = 50
export const MIN_WORDS_QUALITY_WARN = 200

// Cornerstone / aging
export const CORNERSTONE_MIN_WORDS = 1500
export const THIN_AGING_MIN_WORDS = 500

// ---------------------------------------------------------------------------
// Keyword density (%)
// ---------------------------------------------------------------------------

export const KEYWORD_DENSITY_MAX = 3
export const KEYWORD_DENSITY_WARN = 2.5
export const KEYWORD_DENSITY_MIN = 0.5

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const ALT_TEXT_MIN_RATIO = 0.8
export const ALT_TEXT_MIN_LENGTH = 20

// ---------------------------------------------------------------------------
// Headings & structure
// ---------------------------------------------------------------------------

export const WORDS_PER_HEADING = 300
export const LONG_SECTION_THRESHOLD = 400

// ---------------------------------------------------------------------------
// Readability (Flesch — legacy FR constants kept for backward compat)
// ---------------------------------------------------------------------------

export const FLESCH_SCORE_PASS = 40
export const FLESCH_SCORE_WARN = 25
export const LONG_SENTENCE_WORDS = 25
export const LONG_SENTENCE_MAX_RATIO = 0.3
export const LONG_PARAGRAPH_WORDS = 150
export const PASSIVE_VOICE_MAX_RATIO = 0.15
export const TRANSITION_WORDS_MIN_RATIO = 0.15
export const CONSECUTIVE_SAME_START_MAX = 3

// ---------------------------------------------------------------------------
// URL / slug
// ---------------------------------------------------------------------------

export const SLUG_MAX_LENGTH = 75

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export const SOCIAL_TITLE_MAX = 65
export const SOCIAL_DESC_MAX = 155

// ---------------------------------------------------------------------------
// Cornerstone
// ---------------------------------------------------------------------------

export const CORNERSTONE_MIN_INTERNAL_LINKS = 5

// ---------------------------------------------------------------------------
// Freshness (days)
// ---------------------------------------------------------------------------

export const MS_PER_DAY = 1000 * 60 * 60 * 24
export const FRESHNESS_DAYS_EVERGREEN = 730
export const FRESHNESS_DAYS_FAIL = 365
export const FRESHNESS_DAYS_WARN = 180
export const REVIEW_DAYS_WARN = 180

// ---------------------------------------------------------------------------
// Recursion safety
// ---------------------------------------------------------------------------

export const MAX_RECURSION_DEPTH = 50

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCORE_EXCELLENT = 91
export const SCORE_GOOD = 71
export const SCORE_OK = 41
export const WARNING_MULTIPLIER = 0.5

// ---------------------------------------------------------------------------
// Bilingual shared lists
// ---------------------------------------------------------------------------

/** Generic anchor texts that should be avoided in links */
export const GENERIC_ANCHORS: Record<'fr' | 'en', readonly string[]> = {
  fr: ['cliquez ici', 'cliquer ici', 'en savoir plus', 'ici', 'lire la suite', 'plus', 'voir plus', 'lien'],
  en: ['click here', 'read more', 'here', 'more', 'learn more', 'this', 'link'],
}

/** Regex patterns detecting placeholder content */
export const PLACEHOLDER_PATTERNS: RegExp[] = [
  /lorem ipsum/i,
  /\bTODO\b/,
  /\bTBD\b/,
  /\bFIXME\b/,
  /\bplaceholder\b/i,
  /\btexte ici\b/i,
  /\bcontenu a venir\b/i,
  /\ba completer\b/i,
  /\bXXX\b/,
  /\bcontent coming soon\b/i,
  /\bunder construction\b/i,
  /\btext here\b/i,
  /\bto be completed\b/i,
]

/** Standard utility page slugs where keyword-in-URL is not applicable */
export const UTILITY_SLUGS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'contact', 'about', 'a-propos', 'plan-du-site', 'mentions-legales',
    'politique-de-confidentialite', 'cgv', 'cgu', 'blog', 'accessibilite',
    'cookies', 'support', 'faq', 'equipe', 'portfolio', 'tarifs',
  ],
  en: [
    'contact', 'about', 'about-us', 'sitemap', 'blog', 'accessibility',
    'cookies', 'support', 'faq', 'team', 'portfolio', 'pricing', 'careers', 'services',
  ],
}

/** Evergreen pages where freshness is less relevant */
export const EVERGREEN_SLUGS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'mentions-legales', 'politique-de-confidentialite', 'cgv', 'cgu',
    'plan-du-site', 'contact', 'accessibilite', 'cookies',
  ],
  en: [
    'legal-notice', 'privacy-policy', 'terms', 'terms-of-service',
    'sitemap', 'contact', 'accessibility', 'cookies',
  ],
}

/** Stop words (for slug analysis) */
export const STOP_WORDS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une',
    'et', 'en', 'pour', 'avec', 'dans', 'sur', 'par',
    'au', 'aux', 'ce', 'ces', 'est', 'sont', 'qui', 'que',
    'dont', 'ou', 'ne', 'pas', 'se', 'sa', 'son', 'ses',
    'nous', 'vous', 'ils', 'leur', 'leurs',
  ],
  en: [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
    'it', 'this', 'that', 'your', 'my', 'his', 'her',
  ],
}

/** Action verbs commonly used in CTAs */
export const ACTION_VERBS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'découvrez', 'contactez', 'obtenez', 'profitez', 'demandez',
    'essayez', 'téléchargez', 'réservez', 'commandez', 'inscrivez',
    'appelez', 'trouvez', 'comparez', 'calculez', 'estimez',
    'consultez', 'visitez', 'explorez', 'lancez', 'commencez',
    'transformez', 'optimisez', 'améliorez', 'boostez', 'créez',
    'rejoignez', 'bénéficiez', 'accédez', 'simplifiez', 'recevez',
  ],
  en: [
    'discover', 'get', 'try', 'download', 'book', 'order', 'sign up',
    'call', 'find', 'compare', 'calculate', 'estimate', 'explore',
    'start', 'transform', 'optimize', 'improve', 'boost', 'create',
    'join', 'access', 'simplify', 'receive', 'learn', 'save',
    'unlock', 'claim', 'request', 'schedule', 'browse',
  ],
}

/** Compound expressions where stop words are meaningful */
export const STOP_WORD_COMPOUNDS_MAP: Record<'fr' | 'en', ReadonlyArray<readonly [string, string]>> = {
  fr: [
    ['en', 'ligne'],
    ['en', 'france'],
    ['en', 'production'],
    ['en', 'pratique'],
    ['sur', 'mesure'],
    ['pour', 'tous'],
    ['de', 'site'],
    ['du', 'web'],
  ],
  en: [
    ['in', 'the'],
    ['of', 'the'],
    ['on', 'the'],
    ['for', 'the'],
    ['at', 'the'],
  ],
}

/** Local SEO page slugs — empty by default, configure via SeoConfig.localSeoSlugs */
export const LOCAL_SEO_SLUGS: readonly string[] = []

/** Power words that boost CTR in titles */
export const POWER_WORDS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'gratuit', 'exclusif', 'nouveau', 'meilleur', 'secret', 'ultime',
    'essentiel', 'complet', 'rapide', 'efficace', 'simple', 'garanti',
    'prouve', 'unique', 'incontournable', 'revolutionnaire', 'indispensable',
    'exceptionnel', 'professionnel', 'expert', 'guide', 'conseil', 'astuce',
    'methode', 'solution', 'resultat', 'facile', 'puissant', 'fiable', 'premium',
  ],
  en: [
    'free', 'exclusive', 'new', 'best', 'secret', 'ultimate',
    'essential', 'complete', 'fast', 'effective', 'simple', 'guaranteed',
    'proven', 'unique', 'must-have', 'revolutionary', 'indispensable',
    'exceptional', 'professional', 'expert', 'guide', 'tips', 'hack',
    'method', 'solution', 'results', 'easy', 'powerful', 'reliable', 'premium',
  ],
}

/** Legal page slugs (used by detectPageType) */
export const LEGAL_SLUGS_MAP: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'mentions-legales', 'politique-confidentialite', 'plan-du-site',
    'conditions-generales-vente', 'conditions-generales-utilisation',
  ],
  en: [
    'legal', 'legal-notice', 'privacy-policy', 'privacy', 'terms',
    'terms-of-service', 'tos', 'terms-and-conditions', 'cookies',
    'accessibility', 'cookie-policy', 'gdpr',
  ],
}

// ---------------------------------------------------------------------------
// Locale-dependent readability thresholds
// ---------------------------------------------------------------------------

export const FLESCH_THRESHOLDS: Record<'fr' | 'en', { pass: number; warn: number }> = {
  fr: { pass: 40, warn: 25 },
  en: { pass: 60, warn: 40 },
}

export const READABILITY_THRESHOLDS: Record<'fr' | 'en', { longSentenceWords: number; passiveMax: number; transitionsMin: number }> = {
  fr: { longSentenceWords: 25, passiveMax: 0.15, transitionsMin: 0.15 },
  en: { longSentenceWords: 20, passiveMax: 0.10, transitionsMin: 0.20 },
}

// ---------------------------------------------------------------------------
// Backward-compatibility aliases (deprecated — use bilingual versions)
// ---------------------------------------------------------------------------

/** @deprecated Use STOP_WORDS.fr */
export const FRENCH_STOP_WORDS = STOP_WORDS.fr
/** @deprecated Use ACTION_VERBS.fr */
export const FRENCH_ACTION_VERBS = ACTION_VERBS.fr
/** @deprecated Use POWER_WORDS.fr */
export const POWER_WORDS_FR = POWER_WORDS.fr
/** @deprecated Use STOP_WORD_COMPOUNDS_MAP.fr */
export const STOP_WORD_COMPOUNDS = STOP_WORD_COMPOUNDS_MAP.fr
/** @deprecated Use GENERIC_ANCHORS */
export const GENERIC_ANCHOR_TEXTS = [...GENERIC_ANCHORS.fr, ...GENERIC_ANCHORS.en] as const
/** @deprecated Use LEGAL_SLUGS_MAP.fr */
export const LEGAL_SLUGS = LEGAL_SLUGS_MAP.fr
/** @deprecated Use UTILITY_SLUGS */
export const UTILITY_PAGE_SLUGS = [...UTILITY_SLUGS.fr] as const
/** @deprecated Use EVERGREEN_SLUGS */
export const EVERGREEN_PAGE_SLUGS = [...EVERGREEN_SLUGS.fr] as const

// ---------------------------------------------------------------------------
// Locale accessor helpers
// ---------------------------------------------------------------------------

export function getStopWords(locale: 'fr' | 'en'): readonly string[] { return STOP_WORDS[locale] }
export function getActionVerbs(locale: 'fr' | 'en'): readonly string[] { return ACTION_VERBS[locale] }
export function getPowerWords(locale: 'fr' | 'en'): readonly string[] { return POWER_WORDS[locale] }
export function getGenericAnchors(locale: 'fr' | 'en'): readonly string[] { return GENERIC_ANCHORS[locale] }
export function getLegalSlugs(locale: 'fr' | 'en'): readonly string[] { return LEGAL_SLUGS_MAP[locale] }
export function getUtilitySlugs(locale: 'fr' | 'en'): readonly string[] { return UTILITY_SLUGS[locale] }
export function getEvergreenSlugs(locale: 'fr' | 'en'): readonly string[] { return EVERGREEN_SLUGS[locale] }
export function getStopWordCompounds(locale: 'fr' | 'en'): ReadonlyArray<readonly [string, string]> { return STOP_WORD_COMPOUNDS_MAP[locale] }
