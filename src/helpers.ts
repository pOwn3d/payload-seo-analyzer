/**
 * SEO Analyzer — Helper utilities.
 * Pure functions for extracting data from Lexical JSON, counting words/syllables,
 * and performing French-language readability analysis.
 */

import {
  FRENCH_STOP_WORDS,
  FRENCH_ACTION_VERBS,
  STOP_WORD_COMPOUNDS,
  LOCAL_SEO_SLUGS,
  LEGAL_SLUGS,
  LEGAL_SLUGS_MAP,
  MAX_RECURSION_DEPTH,
} from './constants'

// ---------------------------------------------------------------------------
// Text normalization (accent-stripping for French keyword matching)
// ---------------------------------------------------------------------------

/**
 * Strip diacritical marks (accents) from text for comparison.
 * "Réalité augmentée" → "realite augmentee"
 * Used to avoid false negatives when comparing keywords against content.
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Slugify a keyword for URL comparison.
 * Strips accents, special chars (.&/), and converts spaces to hyphens.
 * "Next.js & React" → "nextjs-react"
 * "design UX/UI" → "design-ux-ui"
 */
export function slugifyKeyword(kw: string): string {
  return normalizeForComparison(kw)
    .replace(/[^a-z0-9\s-]/g, '') // remove dots, &, /, etc.
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ---------------------------------------------------------------------------
// Smart keyword matching for French multi-word keywords
// ---------------------------------------------------------------------------

/**
 * Smart keyword matching adapted for French.
 *
 * For 1-2 word keywords: exact substring match (accent-insensitive).
 * For 3+ word keywords: all significant words (>3 chars) must be present
 * in the text. This handles French articles/prepositions that naturally
 * separate keyword components ("politique de confidentialité" vs
 * "politique confidentialité RGPD").
 *
 * Both `keyword` and `text` must be pre-normalized with `normalizeForComparison()`.
 */
export function keywordMatchesText(normalizedKeyword: string, normalizedText: string): boolean {
  if (!normalizedKeyword || !normalizedText) return false

  // Exact substring match always wins
  if (normalizedText.includes(normalizedKeyword)) return true

  // For multi-word keywords, check if all significant words are present
  const kwWords = normalizedKeyword.split(/\s+/).filter((w) => w.length > 3)
  if (kwWords.length >= 2) {
    return kwWords.every((w) => normalizedText.includes(w))
  }

  return false
}

/**
 * Count keyword occurrences in text with smart French matching.
 *
 * Returns exact occurrence count plus a word-level match flag for multi-word
 * keywords where individual significant words appear but not as exact phrase.
 * Also returns an estimated effective density.
 */
export function countKeywordOccurrences(
  normalizedKeyword: string,
  normalizedText: string,
  totalWordCount: number,
): { exactCount: number; wordLevelMatch: boolean; effectiveDensity: number } {
  const kwWordCount = countWords(normalizedKeyword)

  // Count exact phrase occurrences
  let exactCount = 0
  let searchIdx = 0
  while (true) {
    const idx = normalizedText.indexOf(normalizedKeyword, searchIdx)
    if (idx === -1) break
    exactCount++
    searchIdx = idx + 1
  }

  if (exactCount > 0 || totalWordCount === 0) {
    const density = totalWordCount > 0 ? ((exactCount * kwWordCount) / totalWordCount) * 100 : 0
    return { exactCount, wordLevelMatch: true, effectiveDensity: density }
  }

  // For multi-word keywords: check individual significant words
  const significantWords = normalizedKeyword.split(/\s+/).filter((w) => w.length > 3)
  if (significantWords.length < 2) {
    return { exactCount: 0, wordLevelMatch: false, effectiveDensity: 0 }
  }

  // Count occurrences of each significant word, take the minimum
  const wordCounts = significantWords.map((word) => {
    let count = 0
    let idx = 0
    while (true) {
      const pos = normalizedText.indexOf(word, idx)
      if (pos === -1) break
      count++
      idx = pos + 1
    }
    return count
  })

  const allPresent = wordCounts.every((c) => c > 0)
  const minCount = Math.min(...wordCounts)

  // Estimate density from the least-frequent significant word
  const estimatedDensity = allPresent ? (minCount / totalWordCount) * 100 : 0

  return { exactCount: 0, wordLevelMatch: allPresent, effectiveDensity: estimatedDensity }
}

// ---------------------------------------------------------------------------
// Page type detection (for adapting SEO rule thresholds)
// ---------------------------------------------------------------------------

import type { PageType } from './types'

/**
 * Detect the page type from the slug (and optionally the collection) to adapt
 * SEO rule severity. Unified version used by both the analyzer and AI prompts.
 *
 * Priority order:
 * 1. Collection-based detection (posts → blog)
 * 2. Exact slug matches (home, legal)
 * 3. Pattern-based detection (local-seo, service, resource, agency, blog)
 * 4. Fallback → generic
 *
 * @param extraLocalSeoSlugs Additional local SEO slugs from SeoConfig
 */
export function detectPageType(
  slug: string,
  collection?: string,
  extraLocalSeoSlugs?: string[],
  locale?: 'fr' | 'en',
): PageType {
  // 1. Collection-based detection
  if (collection === 'posts') return 'blog'

  // 2. Home
  if (!slug || slug === '' || slug === 'home' || slug === 'accueil') return 'home'

  const s = slug.toLowerCase()

  // 3. Legal pages (explicit slug list + broad pattern — FR + EN)
  const allLegalSlugs = [...LEGAL_SLUGS_MAP.fr, ...LEGAL_SLUGS_MAP.en]
  if (allLegalSlugs.includes(s)) return 'legal'
  if (
    s.includes('mentions-legales') ||
    s.includes('politique-de-confidentialite') ||
    s.includes('politique-confidentialite') ||
    s.includes('cgv') ||
    s.includes('cgu') ||
    s.includes('accessibilite') ||
    s.includes('cookies')
  ) return 'legal'
  // Legal pages — EN patterns
  if (
    s.includes('privacy-policy') ||
    s.includes('terms-of-service') ||
    s.includes('terms-and-conditions') ||
    s.includes('cookie-policy') ||
    s === 'legal' ||
    s === 'privacy' ||
    s === 'terms' ||
    s === 'tos' ||
    s === 'gdpr'
  ) return 'legal'

  // 4. Contact (FR + EN)
  if (s === 'contact' || s.endsWith('/contact')) return 'contact'
  if (s === 'contact-us' || s === 'get-in-touch') return 'contact'

  // 5. Form pages (FR + EN)
  if (
    s.includes('devis') ||
    s.includes('inscription') ||
    s.includes('support')
  ) return 'form'
  if (s.includes('quote') || s.includes('signup') || s.includes('register') || s.includes('apply')) return 'form'

  // 6. Local SEO pages: explicit list + extra config slugs + pattern matching (FR)
  if (LOCAL_SEO_SLUGS.includes(s)) return 'local-seo'
  if (extraLocalSeoSlugs?.includes(s)) return 'local-seo'
  if (
    s.match(
      /^(agence-web|creation-site-internet|agence-digitale|agence-communication|creation-logo|webmaster|developpeur-web|referencement-seo|zone-intervention)-/,
    ) ||
    s.includes('agence-web-') ||
    s.includes('creation-site-') ||
    s.includes('developpeur-web-') ||
    s.includes('zone-intervention')
  ) return 'local-seo'
  // Local SEO — EN patterns
  if (
    s.match(/^(web-agency|web-design|web-developer|seo-agency|digital-agency|logo-design|webmaster)-/) ||
    s.includes('web-agency-') || s.includes('web-design-') || s.includes('web-developer-')
  ) return 'local-seo'

  // 7. Service sub-pages (FR + EN)
  if (s.startsWith('services/') || s.startsWith('nos-services') || s.startsWith('services-')) return 'service'
  if (s.startsWith('our-services')) return 'service'

  // 8. Resource pages (FR + EN)
  if (s.startsWith('ressources/') || s.startsWith('ressources-')) return 'resource'
  if (s.startsWith('resources/') || s.startsWith('resources-')) return 'resource'

  // 9. Agency (FR + EN)
  if (
    s.includes('a-propos') || s.includes('equipe') || s.includes('portfolio') ||
    s.startsWith('agence/') || s.startsWith('agence-') || s === 'agence'
  ) return 'agency'
  if (s.includes('about-us') || s === 'about') return 'agency'

  // 10. Blog (slug-based fallback when collection is not provided)
  if (s.startsWith('posts/') || s.startsWith('blog/')) return 'blog'

  return 'generic'
}

// ---------------------------------------------------------------------------
// Lexical extraction
// ---------------------------------------------------------------------------

/**
 * Recursively extract plain text from a Lexical JSON tree.
 * @param maxDepth Maximum recursion depth to prevent stack overflow (default: 50)
 */
export function extractTextFromLexical(
  node: unknown,
  maxDepth: number = MAX_RECURSION_DEPTH,
): string {
  return _extractText(node, 0, maxDepth)
}

function _extractText(node: unknown, depth: number, maxDepth: number): string {
  if (depth >= maxDepth || !node || typeof node !== 'object') return ''

  const n = node as Record<string, unknown>

  // Text node
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text
  }

  // Recurse into children
  if (Array.isArray(n.children)) {
    return n.children.map((child: unknown) => _extractText(child, depth + 1, maxDepth)).join(' ')
  }

  // Root wrapper: { root: { children: [...] } }
  if (n.root && typeof n.root === 'object') {
    return _extractText(n.root, depth + 1, maxDepth)
  }

  return ''
}

/**
 * Extract headings from a Lexical JSON tree.
 * Returns an array of { tag: 'h1' | 'h2' | ..., text: string }
 * @param maxDepth Maximum recursion depth to prevent stack overflow (default: 50)
 */
export function extractHeadingsFromLexical(
  node: unknown,
  maxDepth: number = MAX_RECURSION_DEPTH,
): Array<{ tag: string; text: string }> {
  return _extractHeadings(node, 0, maxDepth)
}

function _extractHeadings(
  node: unknown,
  depth: number,
  maxDepth: number,
): Array<{ tag: string; text: string }> {
  if (depth >= maxDepth || !node || typeof node !== 'object') return []

  const n = node as Record<string, unknown>
  const headings: Array<{ tag: string; text: string }> = []

  if (n.type === 'heading' && typeof n.tag === 'string') {
    headings.push({ tag: n.tag, text: extractTextFromLexical(n, maxDepth - depth) })
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      headings.push(..._extractHeadings(child, depth + 1, maxDepth))
    }
  }

  if (n.root && typeof n.root === 'object') {
    headings.push(..._extractHeadings(n.root, depth + 1, maxDepth))
  }

  return headings
}

/**
 * Extract links from a Lexical JSON tree.
 * Returns an array of { url: string, text: string }
 * @param maxDepth Maximum recursion depth to prevent stack overflow (default: 50)
 */
export function extractLinksFromLexical(
  node: unknown,
  maxDepth: number = MAX_RECURSION_DEPTH,
): Array<{ url: string; text: string }> {
  return _extractLinks(node, 0, maxDepth)
}

function _extractLinks(
  node: unknown,
  depth: number,
  maxDepth: number,
): Array<{ url: string; text: string }> {
  if (depth >= maxDepth || !node || typeof node !== 'object') return []

  const n = node as Record<string, unknown>
  const links: Array<{ url: string; text: string }> = []

  // Link node in Lexical
  if (n.type === 'link' || n.type === 'autolink') {
    const fields = n.fields as Record<string, unknown> | undefined
    const url = (fields?.url as string) || (n.url as string) || ''
    const text = extractTextFromLexical(n, maxDepth - depth)
    if (url) links.push({ url, text })
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      links.push(..._extractLinks(child, depth + 1, maxDepth))
    }
  }

  if (n.root && typeof n.root === 'object') {
    links.push(..._extractLinks(n.root, depth + 1, maxDepth))
  }

  return links
}

/**
 * Extract link URLs from Lexical (flat array — backward compat).
 */
export function extractLinkUrlsFromLexical(node: unknown): string[] {
  return extractLinksFromLexical(node).map((l) => l.url)
}

/**
 * Extract images from a Lexical JSON tree.
 * @param maxDepth Maximum recursion depth to prevent stack overflow (default: 50)
 */
export function extractImagesFromLexical(
  node: unknown,
  maxDepth: number = MAX_RECURSION_DEPTH,
): {
  total: number
  withAlt: number
  altTexts: string[]
} {
  return _extractImages(node, 0, maxDepth)
}

function _extractImages(
  node: unknown,
  depth: number,
  maxDepth: number,
): { total: number; withAlt: number; altTexts: string[] } {
  if (depth >= maxDepth || !node || typeof node !== 'object') {
    return { total: 0, withAlt: 0, altTexts: [] }
  }

  const n = node as Record<string, unknown>
  let total = 0
  let withAlt = 0
  const altTexts: string[] = []

  if (n.type === 'upload') {
    total++
    const value = n.value as Record<string, unknown> | undefined
    if (value?.alt && typeof value.alt === 'string' && value.alt.trim().length > 0) {
      withAlt++
      altTexts.push(value.alt.trim())
    }
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      const result = _extractImages(child, depth + 1, maxDepth)
      total += result.total
      withAlt += result.withAlt
      altTexts.push(...result.altTexts)
    }
  }

  if (n.root && typeof n.root === 'object') {
    const result = _extractImages(n.root, depth + 1, maxDepth)
    total += result.total
    withAlt += result.withAlt
    altTexts.push(...result.altTexts)
  }

  return { total, withAlt, altTexts }
}

/**
 * Check images in blocks (MediaBlock, Content columns, etc.).
 */
export function checkImagesInBlocks(blocks: unknown[]): {
  total: number
  withAlt: number
  altTexts: string[]
} {
  let total = 0
  let withAlt = 0
  const altTexts: string[] = []

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>

    // MediaBlock
    if (b.blockType === 'mediaBlock' || b.blockType === 'media') {
      const media = b.media as Record<string, unknown> | undefined
      if (media) {
        total++
        if (media.alt && typeof media.alt === 'string' && media.alt.trim().length > 0) {
          withAlt++
          altTexts.push(media.alt.trim())
        }
      }
    }

    // Content blocks may embed images via richText
    if (b.columns && Array.isArray(b.columns)) {
      for (const col of b.columns) {
        if (col && typeof col === 'object') {
          const colObj = col as Record<string, unknown>
          if (colObj.richText) {
            const imgs = extractImagesFromLexical(colObj.richText)
            total += imgs.total
            withAlt += imgs.withAlt
            altTexts.push(...imgs.altTexts)
          }
        }
      }
    }
  }

  return { total, withAlt, altTexts }
}

// ---------------------------------------------------------------------------
// Text analysis — word / sentence / syllable counting
// ---------------------------------------------------------------------------

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0).length
}

/**
 * Split text into sentences (French/English-aware).
 * Handles common abbreviations (M., Mme., Mr., Mrs., etc.) to avoid false splits.
 */
export function countSentences(text: string, locale?: 'fr' | 'en'): string[] {
  if (!text.trim()) return []

  const lang = locale || 'fr'

  let normalized = text

  if (lang === 'en') {
    // English abbreviations
    normalized = normalized
      .replace(/\bMr\.\s/g, 'Mr_ ')
      .replace(/\bMrs\.\s/g, 'Mrs_ ')
      .replace(/\bMs\.\s/g, 'Ms_ ')
      .replace(/\bDr\.\s/g, 'Dr_ ')
      .replace(/\bJr\.\s/g, 'Jr_ ')
      .replace(/\bSr\.\s/g, 'Sr_ ')
      .replace(/\betc\.\s/g, 'etc_ ')
      .replace(/\bvs\.\s/g, 'vs_ ')
      .replace(/\be\.g\.\s/g, 'eg_ ')
      .replace(/\bi\.e\.\s/g, 'ie_ ')
      .replace(/\bSt\.\s/g, 'St_ ')
      .replace(/\bInc\.\s/g, 'Inc_ ')
      .replace(/\bLtd\.\s/g, 'Ltd_ ')
      .replace(/\bCo\.\s/g, 'Co_ ')
      .replace(/\bNo\.\s/g, 'No_ ')
  } else {
    // French abbreviations
    normalized = normalized
      .replace(/\bM\.\s/g, 'M_ ')
      .replace(/\bMme\.\s/g, 'Mme_ ')
      .replace(/\bMlle\.\s/g, 'Mlle_ ')
      .replace(/\bDr\.\s/g, 'Dr_ ')
      .replace(/\betc\.\s/g, 'etc_ ')
      .replace(/\bcf\.\s/g, 'cf_ ')
      .replace(/\bex\.\s/g, 'ex_ ')
      .replace(/\bn°\s/g, 'n_ ')
  }

  // Split on sentence-ending punctuation followed by a space or end of string
  const raw = normalized.split(/(?<=[.!?])\s+/)

  return raw
    .map((s) => {
      // Restore abbreviations for both languages
      return s
        .replace(/Mr_/g, 'Mr.')
        .replace(/Mrs_/g, 'Mrs.')
        .replace(/Ms_/g, 'Ms.')
        .replace(/Jr_/g, 'Jr.')
        .replace(/Sr_/g, 'Sr.')
        .replace(/vs_/g, 'vs.')
        .replace(/eg_/g, 'e.g.')
        .replace(/ie_/g, 'i.e.')
        .replace(/St_/g, 'St.')
        .replace(/Inc_/g, 'Inc.')
        .replace(/Ltd_/g, 'Ltd.')
        .replace(/Co_/g, 'Co.')
        .replace(/No_/g, 'No.')
        .replace(/M_/g, 'M.')
        .replace(/Mme_/g, 'Mme.')
        .replace(/Mlle_/g, 'Mlle.')
        .replace(/Dr_/g, 'Dr.')
        .replace(/etc_/g, 'etc.')
        .replace(/cf_/g, 'cf.')
        .replace(/ex_/g, 'ex.')
        .replace(/n_/g, 'n°')
        .trim()
    })
    .filter((s) => s.length > 0)
}

/**
 * Count syllables in a French word (Kandel-Moles approximation).
 *
 * Rules:
 * 1. Count vowel groups (a, e, i, o, u, y, accented variants)
 * 2. Silent final 'e' does not count (except single-syllable words)
 * 3. Common diphthongs (eau, ou, ai, ei, au, oi, eu) count as 1 vowel group
 */
export function countSyllablesFR(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿæœ]/g, '')
  if (!lower) return 1

  // Count vowel groups
  const vowelGroups = lower.match(/[aeiouyàâäéèêëïîôùûüÿæœ]+/g)
  if (!vowelGroups) return 1

  let count = vowelGroups.length

  // Silent final 'e' (not counting monosyllabic words)
  if (/[^aeiouyàâäéèêëïîôùûüÿæœ]e$/.test(lower) && count > 1) {
    count--
  }

  // Diphthongs already counted as single vowel group by the regex,
  // but compound diphthongs like 'eau' may create extra groups
  const diphthongs = lower.match(/(?:eau|oeu|aie|oui)/g)
  if (diphthongs) {
    count -= diphthongs.length // correct for over-counting
  }

  return Math.max(1, count)
}

/**
 * Count syllables in an English word.
 * Handles silent-e, -ed/-es endings, common exceptions.
 */
export function countSyllablesEN(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!lower || lower.length <= 2) return 1

  // Common irregular words
  const special: Record<string, number> = {
    'the': 1, 'are': 1, 'were': 1, 'here': 1, 'there': 1,
    'where': 1, 'gone': 1, 'done': 1, 'once': 1, 'give': 1,
    'have': 1, 'come': 1, 'some': 1, 'love': 1, 'move': 1,
    'live': 1, 'like': 1, 'make': 1, 'take': 1, 'use': 1,
    'more': 1, 'fire': 2, 'hire': 2, 'tire': 2, 'wire': 2,
    'every': 3, 'different': 3, 'business': 3, 'beautiful': 3,
    'interesting': 4, 'comfortable': 4, 'experience': 4,
    'area': 3, 'idea': 3, 'real': 1, 'being': 2,
    'create': 2, 'created': 3, 'people': 2,
  }
  if (special[lower] !== undefined) return special[lower]

  let count = 0
  const vowels = 'aeiouy'
  let prevVowel = false

  for (let i = 0; i < lower.length; i++) {
    const isVowel = vowels.includes(lower[i])
    if (isVowel && !prevVowel) count++
    prevVowel = isVowel
  }

  // Silent-e at end (but not -le which adds a syllable like "table")
  if (lower.endsWith('e') && !lower.endsWith('le') && count > 1) {
    count--
  }

  // -ed ending: usually not a separate syllable (except -ted, -ded)
  if (lower.endsWith('ed') && lower.length > 3) {
    const beforeEd = lower[lower.length - 3]
    if (beforeEd !== 't' && beforeEd !== 'd') {
      if (count > 1) count--
    }
  }

  return Math.max(1, count)
}

/**
 * Calculate Flesch reading ease adapted for French (Kandel-Moles formula).
 * Flesch FR = 207 - 1.015 * (words/sentences) - 73.6 * (syllables/words)
 *
 * Returns a score from 0 (very difficult) to ~100 (very easy).
 */
export function calculateFleschFR(text: string): number {
  const sentences = countSentences(text)
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0)

  if (sentences.length === 0 || words.length === 0) return 0

  const totalSyllables = words.reduce((sum, w) => sum + countSyllablesFR(w), 0)

  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = totalSyllables / words.length

  const score = 207 - 1.015 * avgWordsPerSentence - 73.6 * avgSyllablesPerWord

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Calculate Flesch reading ease — bilingual.
 * FR: Kandel-Moles (207 - 1.015xASL - 73.6xASW)
 * EN: Flesch-Kincaid (206.835 - 1.015xASL - 84.6xASW)
 */
export function calculateFlesch(text: string, locale: 'fr' | 'en' = 'fr'): number {
  if (locale === 'fr') return calculateFleschFR(text)

  const sentences = countSentences(text, 'en')
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0)
  if (sentences.length === 0 || words.length === 0) return 0

  const totalSyllables = words.reduce((sum, w) => sum + countSyllablesEN(w), 0)
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = totalSyllables / words.length

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Detect passive voice in a French sentence.
 * Looks for "être" conjugations followed by a past participle,
 * while excluding common passé composé verbs (aller, venir, arriver, etc.)
 * that use "être" as auxiliary but are NOT passive voice.
 *
 * Also excludes state descriptions ("est basé à", "est situé à") that are
 * natural in French B2B copy and not true passive constructions.
 */
export function detectPassiveVoice(sentence: string, locale?: 'fr' | 'en'): boolean {
  if ((locale || 'fr') === 'en') {
    // English passive voice: be-verb + past participle
    const enPassiveRegex = /\b(is|are|was|were|been|being|be|gets|got|gotten)\s+(\w+(?:ed|en|wn|ht|lt|nt|pt|ft|ng|xt|un))\b/i
    return enPassiveRegex.test(sentence)
  }

  // Common past participles that use "être" as auxiliary (NOT passive voice)
  const ETRE_VERBS_PARTICIPLES =
    /\b(?:allé|allée|allés|allées|venu|venue|venus|venues|arrivé|arrivée|arrivés|arrivées|parti|partie|partis|parties|resté|restée|restés|restées|devenu|devenue|devenus|devenues|né|née|nés|nées|mort|morte|morts|mortes|tombé|tombée|tombés|tombées|passé|passée|passés|passées|sorti|sortie|sortis|sorties|entré|entrée|entrés|entrées|monté|montée|montés|montées|descendu|descendue|descendus|descendues|retourné|retournée|retournés|retournées)\b/i

  const passivePattern =
    /\b(?:est|sont|a\s+été|ont\s+été|sera|seront|fut|furent|était|étaient|serait|seraient|avait\s+été|avaient\s+été)\s+(\w+(?:é|ée|és|ées|i|ie|is|ies|u|ue|us|ues))\b/i

  const match = passivePattern.exec(sentence)
  if (!match) return false

  // Check if the matched participle is a "être" verb (passé composé, not passive)
  const participle = match[1]
  if (ETRE_VERBS_PARTICIPLES.test(participle)) return false

  return true
}

/**
 * French transition words / phrases.
 * Used to check whether sentences start with connective phrases.
 */
const TRANSITION_WORDS_FR: string[] = [
  // Addition
  'de plus',
  'en outre',
  'par ailleurs',
  'également',
  'aussi',
  'de même',
  "d'une part",
  "d'autre part",
  'qui plus est',
  'de surcroît',
  'non seulement',
  // Contrast
  'cependant',
  'néanmoins',
  'toutefois',
  'en revanche',
  'tandis que',
  'alors que',
  'bien que',
  'même si',
  'pourtant',
  'malgré tout',
  'au contraire',
  'or',
  // Cause / consequence
  'par conséquent',
  'en effet',
  'ainsi',
  'donc',
  'car',
  'puisque',
  'étant donné que',
  'en raison de',
  'à cause de',
  'grâce à',
  "c'est pourquoi",
  'de ce fait',
  // Purpose
  'afin de',
  'dans le but de',
  'pour que',
  'de manière à',
  // Sequence
  'puis',
  'ensuite',
  'enfin',
  'premièrement',
  'deuxièmement',
  'troisièmement',
  'finalement',
  'en conclusion',
  "tout d'abord",
  "d'abord",
  'pour commencer',
  'pour finir',
  // Illustration / emphasis
  'par exemple',
  "c'est-à-dire",
  'autrement dit',
  "en d'autres termes",
  'en fait',
  'en réalité',
  'surtout',
  'notamment',
  'en particulier',
  'à savoir',
  // Condition
  'à condition que',
  'pourvu que',
  'en cas de',
  'si',
  // Conclusion
  'bref',
  'en somme',
  'en résumé',
  'pour conclure',
  'en définitive',
  'somme toute',
  'tout compte fait',
]

/**
 * English transition words / phrases.
 * Used to check whether sentences start with connective phrases.
 */
const TRANSITION_WORDS_EN: string[] = [
  // Addition
  'furthermore', 'moreover', 'additionally', 'also', 'besides',
  'in addition', 'what is more', 'not only', 'likewise',
  // Contrast
  'however', 'nevertheless', 'nonetheless', 'on the other hand',
  'in contrast', 'whereas', 'although', 'even though', 'yet',
  'still', 'despite this', 'on the contrary', 'conversely',
  // Cause / consequence
  'therefore', 'consequently', 'as a result', 'thus', 'hence',
  'because', 'since', 'due to', 'owing to', 'thanks to',
  'for this reason', 'accordingly',
  // Purpose
  'in order to', 'so that', 'so as to', 'with the aim of',
  // Sequence
  'then', 'next', 'finally', 'first', 'firstly', 'secondly',
  'thirdly', 'lastly', 'in conclusion', 'to begin with',
  'first of all', 'to start with', 'to sum up', 'meanwhile',
  // Illustration / emphasis
  'for example', 'for instance', 'that is', 'in other words',
  'in fact', 'actually', 'especially', 'particularly', 'notably',
  'namely', 'specifically', 'indeed',
  // Condition
  'provided that', 'as long as', 'in case of', 'if',
  // Conclusion
  'in short', 'in summary', 'to conclude', 'overall',
  'all in all', 'in brief', 'all things considered',
]

/**
 * Check whether a sentence contains a transition word/phrase.
 */
export function hasTransitionWord(sentence: string, locale?: 'fr' | 'en'): boolean {
  const lower = sentence.toLowerCase().trim()
  const words = (locale || 'fr') === 'en' ? TRANSITION_WORDS_EN : TRANSITION_WORDS_FR
  return words.some((tw) => {
    return lower.startsWith(tw) || lower.includes(`, ${tw}`) || lower.includes(` ${tw} `)
  })
}

/**
 * Get the list of French stop words (for slug analysis).
 */
export function getStopWordsFR(): readonly string[] {
  return FRENCH_STOP_WORDS
}

/**
 * Compound expressions in French where stop words are meaningful.
 * These should NOT be flagged in slug analysis.
 * Checks if a stop word at position `idx` in slug parts is part of a known expression.
 */
export function isStopWordInCompoundExpression(
  parts: string[],
  idx: number,
  extraCompounds?: Array<readonly [string, string]>,
): boolean {
  const word = parts[idx]
  const nextWord = parts[idx + 1] || ''
  const prevWord = parts[idx - 1] || ''

  const allCompounds = extraCompounds
    ? [...STOP_WORD_COMPOUNDS, ...extraCompounds]
    : STOP_WORD_COMPOUNDS

  return allCompounds.some(
    ([a, b]) =>
      (word === a && nextWord === b) || (word === b && prevWord === a),
  )
}

/**
 * French action verbs commonly used in CTAs.
 */
export function getActionVerbsFR(): readonly string[] {
  return FRENCH_ACTION_VERBS
}

// ---------------------------------------------------------------------------
// Content structure helpers
// ---------------------------------------------------------------------------

/**
 * Check for long sections (>N words without a heading break).
 * Returns the number of sections that exceed the threshold.
 */
export function countLongSections(node: unknown, threshold: number = 300): number {
  if (!node || typeof node !== 'object') return 0

  const n = node as Record<string, unknown>
  const root = (n.root as Record<string, unknown>) || n

  if (!Array.isArray(root.children)) return 0

  let wordsSinceHeading = 0
  let longSections = 0

  for (const child of root.children) {
    const c = child as Record<string, unknown>

    if (c.type === 'heading') {
      wordsSinceHeading = 0
      continue
    }

    if (c.type === 'paragraph') {
      const text = extractTextFromLexical(c)
      wordsSinceHeading += countWords(text)

      if (wordsSinceHeading > threshold) {
        longSections++
        wordsSinceHeading = 0 // reset so we don't double-count
      }
    }
  }

  return longSections
}

/**
 * Extract lists (ol/ul) from a Lexical JSON tree.
 * Returns an array of { listType: 'bullet' | 'number', items: number }.
 */
export function extractListsFromLexical(
  node: unknown,
  maxDepth: number = MAX_RECURSION_DEPTH,
): Array<{ listType: string; items: number }> {
  return _extractLists(node, 0, maxDepth)
}

function _extractLists(
  node: unknown,
  depth: number,
  maxDepth: number,
): Array<{ listType: string; items: number }> {
  if (depth >= maxDepth || !node || typeof node !== 'object') return []

  const n = node as Record<string, unknown>
  const lists: Array<{ listType: string; items: number }> = []

  if (n.type === 'list') {
    const listType = n.listType === 'number' ? 'number' : 'bullet'
    const items = Array.isArray(n.children) ? n.children.length : 0
    lists.push({ listType, items })
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      lists.push(..._extractLists(child, depth + 1, maxDepth))
    }
  }

  if (n.root && typeof n.root === 'object') {
    lists.push(..._extractLists(n.root, depth + 1, maxDepth))
  }

  return lists
}

/**
 * Check heading hierarchy: no level skipping (e.g. h2 -> h4 without h3).
 */
export function checkHeadingHierarchy(headings: Array<{ tag: string; text: string }>): boolean {
  if (headings.length === 0) return true

  const levelMap: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }
  let maxLevel = 0

  for (const h of headings) {
    const level = levelMap[h.tag] || 0
    if (level > maxLevel + 1 && maxLevel > 0) {
      return false
    }
    if (level > maxLevel) {
      maxLevel = level
    }
  }

  return true
}
