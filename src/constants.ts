/**
 * SEO Analyzer — Shared constants.
 * Centralizes thresholds, limits, and shared lists used across rule modules.
 * Importing from here ensures consistency and makes tuning easy.
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
// Readability (Flesch FR — Kandel-Moles)
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
// Shared lists
// ---------------------------------------------------------------------------

/** Generic anchor texts that should be avoided in links */
export const GENERIC_ANCHOR_TEXTS = [
  'cliquez ici',
  'cliquer ici',
  'en savoir plus',
  'ici',
  'lire la suite',
  'plus',
  'voir plus',
  'lien',
  'click here',
  'read more',
  'here',
  'more',
] as const

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
]

/** Standard utility page slugs where keyword-in-URL is not applicable */
export const UTILITY_PAGE_SLUGS = [
  'contact',
  'about',
  'a-propos',
  'plan-du-site',
  'mentions-legales',
  'politique-de-confidentialite',
  'cgv',
  'cgu',
  'blog',
  'accessibilite',
  'cookies',
  'support',
  'faq',
  'equipe',
  'portfolio',
  'tarifs',
] as const

/** Evergreen pages where freshness is less relevant */
export const EVERGREEN_PAGE_SLUGS = [
  'mentions-legales',
  'politique-de-confidentialite',
  'cgv',
  'cgu',
  'plan-du-site',
  'contact',
  'accessibilite',
  'cookies',
] as const

/** French stop words (for slug analysis) */
export const FRENCH_STOP_WORDS = [
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une',
  'et', 'en', 'pour', 'avec', 'dans', 'sur', 'par',
  'au', 'aux', 'ce', 'ces', 'est', 'sont', 'qui', 'que',
  'dont', 'ou', 'ne', 'pas', 'se', 'sa', 'son', 'ses',
  'nous', 'vous', 'ils', 'leur', 'leurs',
] as const

/** French action verbs commonly used in CTAs */
export const FRENCH_ACTION_VERBS = [
  'découvrez', 'contactez', 'obtenez', 'profitez', 'demandez',
  'essayez', 'téléchargez', 'réservez', 'commandez', 'inscrivez',
  'appelez', 'trouvez', 'comparez', 'calculez', 'estimez',
  'consultez', 'visitez', 'explorez', 'lancez', 'commencez',
  'transformez', 'optimisez', 'améliorez', 'boostez', 'créez',
  'rejoignez', 'bénéficiez', 'accédez', 'simplifiez', 'recevez',
] as const

/** Compound expressions in French where stop words are meaningful */
export const STOP_WORD_COMPOUNDS: ReadonlyArray<readonly [string, string]> = [
  ['en', 'ligne'],
  ['en', 'france'],
  ['en', 'production'],
  ['en', 'pratique'],
  ['sur', 'mesure'],
  ['pour', 'tous'],
  ['de', 'site'],
  ['du', 'web'],
]

/** Local SEO page slugs — empty by default, configure via SeoConfig.localSeoSlugs */
export const LOCAL_SEO_SLUGS: readonly string[] = []

/** French power words that boost CTR in titles */
export const POWER_WORDS_FR = [
  'gratuit', 'exclusif', 'nouveau', 'meilleur', 'secret', 'ultime',
  'essentiel', 'complet', 'rapide', 'efficace', 'simple', 'garanti',
  'prouve', 'unique', 'incontournable', 'revolutionnaire', 'indispensable',
  'exceptionnel', 'professionnel', 'expert', 'guide', 'conseil', 'astuce',
  'methode', 'solution', 'resultat', 'facile', 'puissant', 'fiable', 'premium',
] as const

/** Legal page slugs (used by detectPageType in prompts context) */
export const LEGAL_SLUGS = [
  'mentions-legales',
  'politique-confidentialite',
  'plan-du-site',
  'conditions-generales-vente',
  'conditions-generales-utilisation',
] as const
