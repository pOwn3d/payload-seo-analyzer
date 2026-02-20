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

import type { SeoCheck, SeoInput, AnalysisContext } from '../types'

// Regex patterns for price detection in French/European formats
const PRICE_REGEX = /(?:\d+(?:[.,]\d{1,2})?\s*(?:\u20AC|EUR|euros?|\$|USD))|(?:(?:\u20AC|EUR|euros?|\$|USD)\s*\d+(?:[.,]\d{1,2})?)|(?:\u00E0\s+partir\s+de\s+\d+)|(?:prix\s*:\s*\d+)|(?:tarif\s*:\s*\d+)/i

// Regex for availability keywords in French
const AVAILABILITY_REGEX = /(?:en\s+stock|disponible|rupture\s+de\s+stock|sur\s+commande|livraison|expedition|indisponible|pre-?commande|bient\u00F4t\s+disponible|delai|disponibilite)/i

export function checkEcommerce(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // 1. Product price mentioned in content
  const hasPriceInContent = PRICE_REGEX.test(ctx.fullText)
  checks.push({
    id: 'product-price-mentioned',
    label: 'Prix dans le contenu',
    status: hasPriceInContent ? 'pass' : 'warning',
    message: hasPriceInContent
      ? 'Le contenu mentionne un prix — Les utilisateurs peuvent identifier le cout du produit.'
      : 'Aucun prix detecte dans le contenu — Mentionnez le prix ou une indication tarifaire pour ameliorer le taux de conversion.',
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip: hasPriceInContent
      ? undefined
      : 'Ajoutez le prix du produit ou une mention "a partir de X\u20AC" dans la description.',
  })

  // 2. Product description word count (>= 100 words)
  const minProductWords = 100
  checks.push({
    id: 'product-short-description',
    label: 'Longueur description produit',
    status: ctx.wordCount >= minProductWords ? 'pass' : ctx.wordCount >= 50 ? 'warning' : 'fail',
    message:
      ctx.wordCount >= minProductWords
        ? `Description produit de ${ctx.wordCount} mots — Suffisamment detaillee pour le SEO.`
        : `Description produit de ${ctx.wordCount} mots (minimum recommande : ${minProductWords}) — Les descriptions longues ameliorent le positionnement et la conversion.`,
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip:
      ctx.wordCount >= minProductWords
        ? undefined
        : 'Enrichissez la description avec les caracteristiques, avantages, cas d\'utilisation et specifications du produit.',
  })

  // 3. Product has enough images (>= 2)
  const minImages = 2
  const imageCount = ctx.imageStats.total
  checks.push({
    id: 'product-has-images',
    label: 'Images produit',
    status: imageCount >= minImages ? 'pass' : imageCount >= 1 ? 'warning' : 'fail',
    message:
      imageCount >= minImages
        ? `${imageCount} image(s) trouvee(s) — Bon nombre d'images pour presenter le produit.`
        : imageCount >= 1
          ? `${imageCount} seule image trouvee (recommande : ${minImages}+) — Ajoutez des images supplementaires pour montrer le produit sous differents angles.`
          : `Aucune image trouvee — Les produits sans photo sont tres difficiles a vendre en ligne.`,
    category: 'critical',
    weight: 3,
    group: 'ecommerce',
    tip:
      imageCount >= minImages
        ? undefined
        : 'Ajoutez des photos sous differents angles, des zooms sur les details et une photo d\'ambiance.',
  })

  // 4. Product title includes brand/name
  const title = (input.metaTitle || '').toLowerCase()
  const focusKeyword = ctx.normalizedKeyword
  const hasBrandInTitle = focusKeyword ? title.includes(focusKeyword) : false
  checks.push({
    id: 'product-title-includes-brand',
    label: 'Marque dans le titre',
    status: hasBrandInTitle ? 'pass' : focusKeyword ? 'warning' : 'warning',
    message: hasBrandInTitle
      ? 'Le titre contient le mot-cle produit/marque — Bon pour le referencement produit.'
      : focusKeyword
        ? `Le titre ne contient pas le mot-cle "${focusKeyword}" — Incluez le nom du produit ou de la marque dans le titre.`
        : 'Aucun mot-cle focus defini — Definissez le nom du produit comme mot-cle focus pour optimiser le titre.',
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasBrandInTitle
      ? undefined
      : 'Placez le nom du produit ou de la marque au debut du meta titre.',
  })

  // 5. Meta description includes price
  const metaDesc = (input.metaDescription || '').toLowerCase()
  const hasPriceInMeta = PRICE_REGEX.test(metaDesc)
  checks.push({
    id: 'product-meta-includes-price',
    label: 'Prix dans la meta description',
    status: hasPriceInMeta ? 'pass' : 'warning',
    message: hasPriceInMeta
      ? 'La meta description mentionne le prix — Ameliore le taux de clic dans les resultats de recherche.'
      : 'La meta description ne mentionne pas le prix — Inclure le prix ou "a partir de X\u20AC" ameliore le CTR.',
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasPriceInMeta
      ? undefined
      : 'Ajoutez le prix ou une fourchette tarifaire dans votre meta description (ex: "a partir de 29\u20AC").',
  })

  // 6. Review readiness (structured data / review mentions)
  const reviewKeywords = /(?:avis|review|note|etoile|stars?|rating|\u00E9valuation|t\u00E9moignage|commentaire\s+client)/i
  const hasReviewContent = reviewKeywords.test(ctx.fullText)
  checks.push({
    id: 'product-review-readiness',
    label: 'Avis et evaluations',
    status: hasReviewContent ? 'pass' : 'warning',
    message: hasReviewContent
      ? 'Le contenu fait reference a des avis/evaluations — Bon signal de confiance pour les acheteurs.'
      : 'Aucune mention d\'avis ou d\'evaluations detectee — Les avis clients augmentent la confiance et le taux de conversion.',
    category: 'bonus',
    weight: 1,
    group: 'ecommerce',
    tip: hasReviewContent
      ? undefined
      : 'Ajoutez une section avis clients ou integrez des donnees structurees Review/AggregateRating.',
  })

  // 7. Availability status mentioned
  const hasAvailability = AVAILABILITY_REGEX.test(ctx.fullText)
  checks.push({
    id: 'product-availability',
    label: 'Disponibilite produit',
    status: hasAvailability ? 'pass' : 'warning',
    message: hasAvailability
      ? 'Information de disponibilite detectee — Les acheteurs savent si le produit est disponible.'
      : 'Aucune information de disponibilite detectee — Indiquez clairement si le produit est en stock, sur commande, etc.',
    category: 'important',
    weight: 2,
    group: 'ecommerce',
    tip: hasAvailability
      ? undefined
      : 'Ajoutez une mention de disponibilite (en stock, sur commande, delai de livraison).',
  })

  return checks
}
