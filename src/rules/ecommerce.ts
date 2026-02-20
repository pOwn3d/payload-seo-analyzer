/**
 * SEO Rules — E-commerce checks: product-specific SEO validation.
 * Only runs when input.isProduct === true.
 *
 * Checks:
 *   1. product-price-mentioned       (weight: 2) — content mentions a price
 *   2. product-short-description     (weight: 2) — description >= 100 words
 *   3. product-has-images            (weight: 3) — at least 2 images
 *   4. product-title-includes-brand  (weight: 1) — title includes product brand/name
 *   5. product-meta-includes-price   (weight: 1) — meta desc mentions price
 *   6. product-review-readiness      (weight: 1) — review/rating data available
 *   7. product-availability          (weight: 2) — availability status mentioned
 */

import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { getTranslations } from '../i18n.js'

// Regex patterns for price detection in French/European formats
const PRICE_REGEX = /(?:\d+(?:[.,]\d{1,2})?\s*(?:\u20AC|EUR|euros?|\$|USD))|(?:(?:\u20AC|EUR|euros?|\$|USD)\s*\d+(?:[.,]\d{1,2})?)|(?:\u00E0\s+partir\s+de\s+\d+)|(?:prix\s*:\s*\d+)|(?:tarif\s*:\s*\d+)/i

// Regex for availability keywords in French
const AVAILABILITY_REGEX = /(?:en\s+stock|disponible|rupture\s+de\s+stock|sur\s+commande|livraison|expedition|indisponible|pre-?commande|bient\u00F4t\s+disponible|delai|disponibilite)/i

export function checkEcommerce(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.ecommerce

  // 1. Product price mentioned in content
  const hasPriceInContent = PRICE_REGEX.test(ctx.fullText)
  checks.push({
    id: 'product-price-mentioned',
    label: r.priceLabel,
    status: hasPriceInContent ? 'pass' : 'warning',
    message: hasPriceInContent ? r.pricePass : r.priceFail,
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip: hasPriceInContent ? undefined : r.priceTip,
  })

  // 2. Product description word count (>= 100 words)
  const minProductWords = 100
  checks.push({
    id: 'product-short-description',
    label: r.descriptionLabel,
    status: ctx.wordCount >= minProductWords ? 'pass' : ctx.wordCount >= 50 ? 'warning' : 'fail',
    message:
      ctx.wordCount >= minProductWords
        ? r.descriptionPass(ctx.wordCount)
        : r.descriptionFail(ctx.wordCount, minProductWords),
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip: ctx.wordCount >= minProductWords ? undefined : r.descriptionTip,
  })

  // 3. Product has enough images (>= 2)
  const minImages = 2
  const imageCount = ctx.imageStats.total
  checks.push({
    id: 'product-has-images',
    label: r.imagesLabel,
    status: imageCount >= minImages ? 'pass' : imageCount >= 1 ? 'warning' : 'fail',
    message:
      imageCount >= minImages
        ? r.imagesPass(imageCount)
        : imageCount >= 1
          ? r.imagesWarn(imageCount, minImages)
          : r.imagesFail,
    category: 'critical',
    weight: 3,
    group: 'ecommerce',
    tip: imageCount >= minImages ? undefined : r.imagesTip,
  })

  // 4. Product title includes brand/name
  const title = (input.metaTitle || '').toLowerCase()
  const focusKeyword = ctx.normalizedKeyword
  const hasBrandInTitle = focusKeyword ? title.includes(focusKeyword) : false
  checks.push({
    id: 'product-title-includes-brand',
    label: r.brandLabel,
    status: hasBrandInTitle ? 'pass' : 'warning',
    message: hasBrandInTitle
      ? r.brandPass
      : focusKeyword
        ? r.brandFailKw(focusKeyword)
        : r.brandFailNoKw,
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasBrandInTitle ? undefined : r.brandTip,
  })

  // 5. Meta description includes price
  const metaDesc = (input.metaDescription || '').toLowerCase()
  const hasPriceInMeta = PRICE_REGEX.test(metaDesc)
  checks.push({
    id: 'product-meta-includes-price',
    label: r.metaPriceLabel,
    status: hasPriceInMeta ? 'pass' : 'warning',
    message: hasPriceInMeta ? r.metaPricePass : r.metaPriceFail,
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasPriceInMeta ? undefined : r.metaPriceTip,
  })

  // 6. Review readiness (structured data / review mentions)
  const reviewKeywords = /(?:avis|review|note|etoile|stars?|rating|\u00E9valuation|t\u00E9moignage|commentaire\s+client)/i
  const hasReviewContent = reviewKeywords.test(ctx.fullText)
  checks.push({
    id: 'product-review-readiness',
    label: r.reviewLabel,
    status: hasReviewContent ? 'pass' : 'warning',
    message: hasReviewContent ? r.reviewPass : r.reviewFail,
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasReviewContent ? undefined : r.reviewTip,
  })

  // 7. Availability status mentioned
  const hasAvailability = AVAILABILITY_REGEX.test(ctx.fullText)
  checks.push({
    id: 'product-availability',
    label: r.availabilityLabel,
    status: hasAvailability ? 'pass' : 'warning',
    message: hasAvailability ? r.availabilityPass : r.availabilityFail,
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip: hasAvailability ? undefined : r.availabilityTip,
  })

  return checks
}
