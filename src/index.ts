/**
 * SEO Analyzer — Main orchestrator.
 * Imports all rule modules, builds the analysis context, runs every check,
 * and computes the final score.
 *
 * Public API:
 *   analyzeSeo(data: SeoInput, config?: SeoConfig): SeoAnalysis
 *
 * All types and useful helpers are re-exported for convenience.
 */

// Re-export types
export type {
  CheckStatus,
  CheckCategory,
  RuleGroup,
  SeoCheck,
  SeoLevel,
  SeoAnalysis,
  SeoInput,
  AnalysisContext,
  PageType,
  SeoConfig,
  SeoThresholds,
} from './types'

// Re-export helpers for external consumers
export {
  extractTextFromLexical,
  extractHeadingsFromLexical,
  extractLinksFromLexical,
  extractImagesFromLexical,
  extractLinkUrlsFromLexical,
  extractListsFromLexical,
  checkImagesInBlocks,
  normalizeForComparison,
  slugifyKeyword,
  keywordMatchesText,
  countKeywordOccurrences,
  countWords,
  countSentences,
  countSyllablesFR,
  calculateFleschFR,
  calculateFlesch,
  countSyllablesEN,
  detectPassiveVoice,
  hasTransitionWord,
  checkHeadingHierarchy,
  countLongSections,
  detectPageType,
  getStopWordsFR,
  getActionVerbsFR,
  isStopWordInCompoundExpression,
} from './helpers'

// Re-export plugin
export { seoPlugin } from './plugin.js'
export type { SeoPluginConfig } from './plugin.js'

// Re-export field definitions
export { seoFields } from './fields.js'

// Re-export endpoint utilities
export { buildSeoInputFromDoc } from './endpoints/validate.js'
export { createHistoryHandler } from './endpoints/history.js'
export { createSitemapAuditHandler } from './endpoints/sitemap-audit.js'

// Re-export collection + hook for advanced consumers
export { createSeoScoreHistoryCollection } from './collections/SeoScoreHistory.js'
export { createSeoPerformanceCollection } from './collections/SeoPerformance.js'
export { createTrackSeoScoreHook } from './hooks/trackSeoScore.js'

// Re-export new endpoint creators
export { createPerformanceHandler } from './endpoints/performance.js'
export { createKeywordResearchHandler } from './endpoints/keywordResearch.js'

// Re-export constants for consumers that need thresholds
export {
  TITLE_LENGTH_MIN,
  TITLE_LENGTH_MAX,
  META_DESC_LENGTH_MIN,
  META_DESC_LENGTH_MAX,
  MIN_WORDS_POST,
  MIN_WORDS_FORM,
  MIN_WORDS_LEGAL,
  MIN_WORDS_GENERIC,
  MIN_WORDS_THIN,
  KEYWORD_DENSITY_MAX,
  KEYWORD_DENSITY_WARN,
  KEYWORD_DENSITY_MIN,
  SCORE_EXCELLENT,
  SCORE_GOOD,
  SCORE_OK,
  WARNING_MULTIPLIER,
  MAX_RECURSION_DEPTH,
  POWER_WORDS_FR,
  POWER_WORDS,
  STOP_WORDS,
  ACTION_VERBS,
  GENERIC_ANCHORS,
  LEGAL_SLUGS_MAP,
  UTILITY_SLUGS,
  EVERGREEN_SLUGS,
  STOP_WORD_COMPOUNDS_MAP,
  FLESCH_THRESHOLDS,
  READABILITY_THRESHOLDS,
  getStopWords,
  getActionVerbs,
  getPowerWords,
  getGenericAnchors,
  getLegalSlugs,
  getUtilitySlugs,
  getEvergreenSlugs,
  getStopWordCompounds,
} from './constants'

import type {
  SeoCheck,
  SeoLevel,
  SeoAnalysis,
  SeoInput,
  SeoConfig,
  AnalysisContext,
  RuleGroup,
} from './types'

import {
  extractTextFromLexical,
  extractHeadingsFromLexical,
  extractLinksFromLexical,
  extractImagesFromLexical,
  extractListsFromLexical,
  checkImagesInBlocks,
  countWords,
  countSentences,
  normalizeForComparison,
  detectPageType,
} from './helpers'

import {
  SCORE_EXCELLENT,
  SCORE_GOOD,
  SCORE_OK,
  WARNING_MULTIPLIER,
  MAX_RECURSION_DEPTH,
} from './constants'

// Rule modules
import { checkTitle } from './rules/title'
import { checkMetaDescription } from './rules/meta-description'
import { checkUrl } from './rules/url'
import { checkHeadings } from './rules/headings'
import { checkContent } from './rules/content'
import { checkImages } from './rules/images'
import { checkLinking } from './rules/linking'
import { checkSocial } from './rules/social'
import { checkSchema } from './rules/schema'
import { checkReadability } from './rules/readability'
import { checkQuality } from './rules/quality'
import { checkSecondaryKeywords } from './rules/secondary-keywords'
import { checkCornerstone } from './rules/cornerstone'
import { checkFreshness } from './rules/freshness'
import { checkTechnical } from './rules/technical'
import { checkAccessibility } from './rules/accessibility'
import { checkEcommerce } from './rules/ecommerce'

// ---------------------------------------------------------------------------
// Payload link field extractor (shared module)
// ---------------------------------------------------------------------------

import { extractPayloadLink } from './helpers/linkExtractor.js'

// ---------------------------------------------------------------------------
// Context builder — pre-computes data shared across rule modules
// ---------------------------------------------------------------------------

function buildContext(data: SeoInput, config: SeoConfig): AnalysisContext {
  const {
    heroRichText,
    blocks,
    content,
  } = data

  const maxDepth = config.maxRecursionDepth ?? MAX_RECURSION_DEPTH

  // Gather all text content
  let fullText = ''
  const allLinks: Array<{ url: string; text: string }> = []
  const allHeadings: Array<{ tag: string; text: string }> = []

  // Extract from hero richText
  if (heroRichText) {
    fullText += extractTextFromLexical(heroRichText, maxDepth) + ' '
    allLinks.push(...extractLinksFromLexical(heroRichText, maxDepth))
    allHeadings.push(...extractHeadingsFromLexical(heroRichText, maxDepth))
  }

  // Extract from hero CTA links (linkGroup)
  if (data.heroLinks && Array.isArray(data.heroLinks)) {
    for (const item of data.heroLinks) {
      if (item && typeof item === 'object') {
        const linkItem = item as Record<string, unknown>
        const linkData = extractPayloadLink(linkItem.link)
        if (linkData) allLinks.push(linkData)
      }
    }
  }

  // Extract from blocks (Pages)
  if (blocks && Array.isArray(blocks)) {
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>

      // Content blocks with columns
      if (b.columns && Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.richText) {
              fullText += extractTextFromLexical(colObj.richText, maxDepth) + ' '
              allLinks.push(...extractLinksFromLexical(colObj.richText, maxDepth))
              allHeadings.push(...extractHeadingsFromLexical(colObj.richText, maxDepth))
            }
          }
        }
      }

      // Blocks with direct richText
      if (b.richText) {
        fullText += extractTextFromLexical(b.richText, maxDepth) + ' '
        allLinks.push(...extractLinksFromLexical(b.richText, maxDepth))
        allHeadings.push(...extractHeadingsFromLexical(b.richText, maxDepth))
      }

      // Services block text + links
      if (b.blockType === 'services' && Array.isArray(b.services)) {
        for (const svc of b.services) {
          if (svc && typeof svc === 'object') {
            const s = svc as Record<string, unknown>
            if (typeof s.title === 'string') fullText += s.title + ' '
            if (typeof s.description === 'string') fullText += s.description + ' '
            // Service link (plain text URL)
            if (typeof s.link === 'string' && s.link) {
              allLinks.push({ url: s.link, text: (s.title as string) || '' })
            }
          }
        }
      }

      // CTA block links (linkGroup: links[].link)
      if (
        (b.blockType === 'cta' || b.blockType === 'callToAction') &&
        Array.isArray(b.links)
      ) {
        for (const item of b.links) {
          if (item && typeof item === 'object') {
            const linkItem = item as Record<string, unknown>
            const linkData = extractPayloadLink(linkItem.link)
            if (linkData) allLinks.push(linkData)
          }
        }
      }

      // Content column links (enableLink + link field)
      if (b.columns && Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.enableLink && colObj.link) {
              const linkData = extractPayloadLink(colObj.link)
              if (linkData) allLinks.push(linkData)
            }
          }
        }
      }

      // LatestPosts block CTA link (plain text URL)
      if (b.blockType === 'latestPosts' && typeof b.ctaLink === 'string' && b.ctaLink) {
        allLinks.push({ url: b.ctaLink, text: (b.ctaLabel as string) || '' })
      }

      // Portfolio block project links (plain text URL)
      if (b.blockType === 'portfolio' && Array.isArray(b.projects)) {
        for (const proj of b.projects) {
          if (proj && typeof proj === 'object') {
            const p = proj as Record<string, unknown>
            if (typeof p.link === 'string' && p.link) {
              allLinks.push({ url: p.link, text: (p.title as string) || '' })
            }
          }
        }
      }

      // Testimonials text
      if (b.blockType === 'testimonials' && Array.isArray(b.testimonials)) {
        for (const t of b.testimonials) {
          if (t && typeof t === 'object') {
            const testimonial = t as Record<string, unknown>
            if (typeof testimonial.quote === 'string') fullText += testimonial.quote + ' '
          }
        }
      }
    }
  }

  // Extract from content (Posts — Lexical richText)
  if (content) {
    fullText += extractTextFromLexical(content, maxDepth) + ' '
    allLinks.push(...extractLinksFromLexical(content, maxDepth))
    allHeadings.push(...extractHeadingsFromLexical(content, maxDepth))
  }

  // For posts, the title field is rendered as H1 by PostHero — include it
  if (data.isPost && data.heroTitle) {
    const hasH1InContent = allHeadings.some((h) => h.tag === 'h1')
    if (!hasH1InContent) {
      allHeadings.unshift({ tag: 'h1', text: data.heroTitle })
      fullText = data.heroTitle + ' ' + fullText
    }
  }

  // Image stats
  const imageStats: { total: number; withAlt: number; altTexts: string[] } = {
    total: 0,
    withAlt: 0,
    altTexts: [],
  }

  if (blocks && Array.isArray(blocks)) {
    const blockImgs = checkImagesInBlocks(blocks)
    imageStats.total += blockImgs.total
    imageStats.withAlt += blockImgs.withAlt
    imageStats.altTexts.push(...blockImgs.altTexts)
  }

  if (content) {
    const contentImgs = extractImagesFromLexical(content, maxDepth)
    imageStats.total += contentImgs.total
    imageStats.withAlt += contentImgs.withAlt
    imageStats.altTexts.push(...contentImgs.altTexts)
  }

  // Count hero media (background image in HighImpact/MediumImpact heroes)
  if (data.heroMedia && typeof data.heroMedia === 'object') {
    const hm = data.heroMedia as Record<string, unknown>
    if (hm.url || hm.filename) {
      imageStats.total++
      if (hm.alt && typeof hm.alt === 'string' && hm.alt.trim().length > 0) {
        imageStats.withAlt++
        imageStats.altTexts.push(hm.alt.trim())
      }
    }
  }

  // Count meta/OG image if present
  if (data.metaImage && typeof data.metaImage === 'object') {
    const mi = data.metaImage as Record<string, unknown>
    if (mi.url || mi.filename) {
      imageStats.total++
      if (mi.alt && typeof mi.alt === 'string' && mi.alt.trim().length > 0) {
        imageStats.withAlt++
        imageStats.altTexts.push(mi.alt.trim())
      }
    }
  }

  const wordCount = countWords(fullText)
  const sentences = countSentences(fullText)

  // Build secondary normalised keywords (deduplicated, excluding primary)
  const primaryNormalized = data.focusKeyword ? normalizeForComparison(data.focusKeyword) : ''
  const secondaryNormalizedKeywords: string[] = []
  if (data.focusKeywords && Array.isArray(data.focusKeywords)) {
    for (const kw of data.focusKeywords) {
      const normalized = normalizeForComparison(kw)
      if (
        normalized &&
        normalized !== primaryNormalized &&
        !secondaryNormalizedKeywords.includes(normalized)
      ) {
        secondaryNormalizedKeywords.push(normalized)
      }
    }
  }

  return {
    fullText,
    wordCount,
    normalizedKeyword: primaryNormalized,
    secondaryNormalizedKeywords,
    allHeadings,
    allLinks,
    imageStats,
    sentences,
    isPost: data.isPost ?? false,
    pageType: data.isPost
      ? 'blog'
      : detectPageType(data.slug || '', undefined, config.localSeoSlugs),
    config,
    locale: (config.locale || 'fr') as 'fr' | 'en',
  }
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

export function analyzeSeo(data: SeoInput, config?: SeoConfig): SeoAnalysis {
  // Input validation — ensure we have a usable object
  if (!data || typeof data !== 'object') {
    return { score: 0, level: 'poor', checks: [] }
  }

  // Merge config with defaults
  const mergedConfig: SeoConfig = {
    maxRecursionDepth: MAX_RECURSION_DEPTH,
    ...config,
  }

  const ctx = buildContext(data, mergedConfig)

  const disabled = new Set<RuleGroup>(mergedConfig.disabledRules || [])

  // Map rule groups to their check functions
  const ruleModules: Array<{ group: RuleGroup; fn: (i: SeoInput, c: AnalysisContext) => SeoCheck[] }> = [
    { group: 'title', fn: checkTitle },
    { group: 'meta-description', fn: checkMetaDescription },
    { group: 'url', fn: checkUrl },
    { group: 'headings', fn: checkHeadings },
    { group: 'content', fn: checkContent },
    { group: 'images', fn: checkImages },
    { group: 'linking', fn: checkLinking },
    { group: 'social', fn: checkSocial },
    { group: 'schema', fn: checkSchema },
    { group: 'readability', fn: checkReadability },
    { group: 'quality', fn: checkQuality },
    { group: 'secondary-keywords', fn: checkSecondaryKeywords },
    { group: 'cornerstone', fn: checkCornerstone },
    { group: 'freshness', fn: checkFreshness },
    { group: 'technical', fn: checkTechnical },
    { group: 'accessibility', fn: checkAccessibility },
    // E-commerce rules only run for product pages
    ...(data.isProduct ? [{ group: 'ecommerce' as RuleGroup, fn: checkEcommerce }] : []),
  ]

  // Run all rule modules (skip disabled groups)
  const checks: SeoCheck[] = []
  const weightOverrides = mergedConfig.overrideWeights

  for (const { group, fn } of ruleModules) {
    if (disabled.has(group)) continue
    const moduleChecks = fn(data, ctx)

    // Apply weight overrides if configured
    if (weightOverrides && weightOverrides[group] !== undefined) {
      const overrideWeight = weightOverrides[group]!
      for (const check of moduleChecks) {
        check.weight = overrideWeight
      }
    }

    checks.push(...moduleChecks)
  }

  // =========================================================================
  // Score calculation
  //
  // Algorithm:
  //   Each check contributes `weight` points to the total.
  //   - pass    → earns 100% of weight
  //   - warning → earns WARNING_MULTIPLIER (50%) of weight
  //   - fail    → earns 0
  //   score = round(earnedPoints / maxPoints * 100)
  //
  // Level thresholds:
  //   >= SCORE_EXCELLENT (91) → 'excellent'
  //   >= SCORE_GOOD      (71) → 'good'
  //   >= SCORE_OK         (41) → 'ok'
  //   < SCORE_OK               → 'poor'
  // =========================================================================

  let earnedPoints = 0
  let maxPoints = 0

  for (const check of checks) {
    maxPoints += check.weight
    if (check.status === 'pass') {
      earnedPoints += check.weight
    } else if (check.status === 'warning') {
      earnedPoints += check.weight * WARNING_MULTIPLIER
    }
    // fail = 0
  }

  const score = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0

  let level: SeoLevel = 'poor'
  if (score >= SCORE_EXCELLENT) level = 'excellent'
  else if (score >= SCORE_GOOD) level = 'good'
  else if (score >= SCORE_OK) level = 'ok'

  return { score, level, checks }
}
