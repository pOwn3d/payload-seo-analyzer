/**
 * SEO Analyzer — Type definitions.
 * Shared across all rule modules and the main orchestrator.
 */

export type CheckStatus = 'pass' | 'warning' | 'fail'
export type CheckCategory = 'critical' | 'important' | 'bonus'

/** Rule group label — used by the UI to group checks by topic */
export type RuleGroup =
  | 'title'
  | 'meta-description'
  | 'url'
  | 'headings'
  | 'content'
  | 'images'
  | 'linking'
  | 'social'
  | 'schema'
  | 'readability'
  | 'quality'
  | 'secondary-keywords'
  | 'cornerstone'
  | 'freshness'
  | 'technical'
  | 'accessibility'
  | 'ecommerce'

export interface SeoCheck {
  id: string
  label: string
  status: CheckStatus
  message: string
  category: CheckCategory
  weight: number
  /** Which rule group this check belongs to */
  group: RuleGroup
  /** Actionable tip displayed below the message when status is not 'pass' */
  tip?: string
}

export type SeoLevel = 'poor' | 'ok' | 'good' | 'excellent'

export interface SeoAnalysis {
  score: number // 0-100
  level: SeoLevel
  checks: SeoCheck[]
}

export interface SeoInput {
  metaTitle?: string
  metaDescription?: string
  metaImage?: unknown
  slug?: string
  focusKeyword?: string
  /** Secondary focus keywords (in addition to the primary keyword) */
  focusKeywords?: string[]
  heroTitle?: string
  heroRichText?: unknown // Lexical root node
  heroLinks?: unknown[] // Hero CTA links (linkGroup items)
  heroMedia?: unknown // Hero background/media image (populated media object)
  blocks?: unknown[] // layout blocks array
  /** For posts — the Lexical content field */
  content?: unknown
  /** Whether the content is a post (for word count thresholds) */
  isPost?: boolean
  /** Whether the content is a product (triggers e-commerce SEO checks) */
  isProduct?: boolean
  /** Whether the content is marked as cornerstone/pillar content */
  isCornerstone?: boolean
  /** ISO date string — last time the document was updated */
  updatedAt?: string
  /** ISO date string — last time the content was manually reviewed */
  contentLastReviewed?: string
  /** Canonical URL for this page (if explicitly set) */
  canonicalUrl?: string
  /** Robots meta directives (e.g. 'noindex', 'nofollow', 'noindex, nofollow') */
  robotsMeta?: string
}

/** Page type for adapting SEO rule severity */
export type PageType =
  | 'legal'
  | 'contact'
  | 'form'
  | 'home'
  | 'service'
  | 'local-seo'
  | 'blog'
  | 'agency'
  | 'resource'
  | 'generic'

/**
 * Overridable thresholds for the SEO analyzer.
 * All fields are optional — defaults from constants.ts are used when omitted.
 */
export interface SeoThresholds {
  titleLengthMin?: number
  titleLengthMax?: number
  metaDescLengthMin?: number
  metaDescLengthMax?: number
  minWordsGeneric?: number
  minWordsPost?: number
  keywordDensityMin?: number
  keywordDensityMax?: number
  fleschScorePass?: number
  slugMaxLength?: number
}

/**
 * Configuration for the SEO analyzer.
 * All fields are optional — sensible defaults are used when omitted.
 * Use this to adapt the analyzer to different projects/sites.
 */
export interface SeoConfig {
  /** Additional local SEO slugs to recognize (appended to pattern detection) */
  localSeoSlugs?: string[]
  /** Regex pattern for detecting local-SEO pages (checked in addition to slug list) */
  localSeoPattern?: RegExp
  /** Additional stop word compounds for slug analysis (appended to defaults) */
  stopWordCompounds?: Array<readonly [string, string]>
  /** Maximum recursion depth for Lexical tree extraction (default: 50) */
  maxRecursionDepth?: number
  /** Base URL of the site (used for canonical URL validation) */
  siteUrl?: string
  /** Site name (used for brand duplicate check in titles) */
  siteName?: string
  /** Rule groups to disable entirely */
  disabledRules?: RuleGroup[]
  /** Override the weight of all checks within a rule group */
  overrideWeights?: Partial<Record<RuleGroup, number>>
  /** Custom thresholds (override defaults from constants.ts) */
  thresholds?: SeoThresholds
  /** Locale for language-specific analysis (default: 'fr') */
  locale?: 'fr' | 'en'
}

/** Pre-computed context shared across all rule modules to avoid redundant work */
export interface AnalysisContext {
  /** All plain text extracted from the page */
  fullText: string
  /** Word count of fullText */
  wordCount: number
  /** Normalised focus keyword (lowercase, trimmed) — empty string if none */
  normalizedKeyword: string
  /** Normalised secondary keywords (lowercase, trimmed, duplicates removed) */
  secondaryNormalizedKeywords: string[]
  /** All headings found in the content */
  allHeadings: Array<{ tag: string; text: string }>
  /** All links found in the content (url + anchor text) */
  allLinks: Array<{ url: string; text: string }>
  /** Image statistics from blocks + content */
  imageStats: { total: number; withAlt: number; altTexts: string[] }
  /** All sentences extracted from fullText */
  sentences: string[]
  /** Whether the content is a blog post (affects thresholds) */
  isPost: boolean
  /** Detected page type for adapting rule severity */
  pageType: PageType
  /** SEO configuration (merged defaults + user overrides) */
  config: SeoConfig
  /** Active locale for language-specific rules */
  locale: 'fr' | 'en'
}
