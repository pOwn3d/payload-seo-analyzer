/**
 * SEO Rules — Accessibility checks (weight: 1-3, category: bonus/important/critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { normalizeForComparison } from '../helpers'

/** Patterns that indicate a generic/placeholder alt text */
const GENERIC_ALT_PATTERN = /^(image|photo|img|picture|screenshot|capture|untitled)\d*$/i

/** Patterns that indicate a file extension in alt text */
const FILE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i

/** Camera/device default filename patterns */
const CAMERA_FILENAME_PATTERN = /\b(IMG_\d+|DSC_\d+|DCIM|photo-\d+|image-\d+|screenshot-\d+)\b/i

export function checkAccessibility(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // 1. a11y-short-anchors — Links with text < 3 characters
  const shortAnchors = ctx.allLinks.filter(
    (link) => link.text.trim().length > 0 && link.text.trim().length < 3,
  )

  checks.push({
    id: 'a11y-short-anchors',
    label: 'Liens avec ancre courte',
    status: shortAnchors.length > 0 ? 'fail' : 'pass',
    message:
      shortAnchors.length > 0
        ? `${shortAnchors.length} lien(s) avec un texte d'ancre de moins de 3 caracteres (ex: "${shortAnchors[0].text.trim()}") — Les lecteurs d'ecran ne peuvent pas interpreter ces liens.`
        : 'Tous les liens ont un texte d\'ancre suffisamment long.',
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(shortAnchors.length > 0
      ? { tip: 'Remplacez les ancres courtes par un texte descriptif (ex: "en savoir plus sur nos services" au lieu de "->").' }
      : {}),
  })

  // 2. a11y-alt-quality — Alt text equals filename or is generic
  const genericAlts = ctx.imageStats.altTexts.filter((alt) => {
    const trimmed = alt.trim()
    if (GENERIC_ALT_PATTERN.test(trimmed)) return true
    if (FILE_EXTENSION_PATTERN.test(trimmed)) return true
    if (/^\d+$/.test(trimmed)) return true
    return false
  })

  checks.push({
    id: 'a11y-alt-quality',
    label: 'Qualite des textes alternatifs',
    status: genericAlts.length > 0 ? 'warning' : 'pass',
    message:
      genericAlts.length > 0
        ? `${genericAlts.length} image(s) avec un alt generique ou de type nom de fichier (ex: "${genericAlts[0]}") — Un alt descriptif ameliore l'accessibilite.`
        : 'Tous les textes alternatifs sont descriptifs.',
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(genericAlts.length > 0
      ? { tip: 'Redigez un alt qui decrit le contenu de l\'image (ex: "Logo de l\'entreprise" au lieu de "image1").' }
      : {}),
  })

  // 3. a11y-empty-headings — Empty headings (h2-h6)
  const emptyHeadings = ctx.allHeadings.filter(
    (h) => h.tag !== 'h1' && h.text.trim().length === 0,
  )

  checks.push({
    id: 'a11y-empty-headings',
    label: 'Titres vides',
    status: emptyHeadings.length > 0 ? 'fail' : 'pass',
    message:
      emptyHeadings.length > 0
        ? `${emptyHeadings.length} titre(s) vide(s) detecte(s) (${emptyHeadings.map((h) => h.tag).join(', ')}) — Les titres vides perturbent la navigation par lecteur d'ecran.`
        : 'Aucun titre vide detecte.',
    category: 'critical',
    weight: 3,
    group: 'accessibility',
    ...(emptyHeadings.length > 0
      ? { tip: 'Ajoutez du texte dans chaque titre ou supprimez les titres vides.' }
      : {}),
  })

  // 4. a11y-duplicate-links — Adjacent links to same URL
  let adjacentDuplicates = 0
  for (let i = 1; i < ctx.allLinks.length; i++) {
    if (ctx.allLinks[i].url === ctx.allLinks[i - 1].url) {
      adjacentDuplicates++
    }
  }

  checks.push({
    id: 'a11y-duplicate-links',
    label: 'Liens adjacents dupliques',
    status: adjacentDuplicates > 0 ? 'warning' : 'pass',
    message:
      adjacentDuplicates > 0
        ? `${adjacentDuplicates} paire(s) de liens adjacents pointant vers la meme URL — Fusionnez-les pour simplifier la navigation.`
        : 'Aucun lien adjacent duplique.',
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(adjacentDuplicates > 0
      ? { tip: 'Combinez les liens adjacents en un seul lien englobant (ex: image + texte dans un meme <a>).' }
      : {}),
  })

  // 5. a11y-all-caps — Headings in ALL CAPS
  const allCapsHeadings = ctx.allHeadings.filter(
    (h) =>
      h.text.trim().length > 3 &&
      h.text.trim() === h.text.trim().toUpperCase() &&
      /[A-Z]/.test(h.text),
  )

  checks.push({
    id: 'a11y-all-caps',
    label: 'Titres en majuscules',
    status: allCapsHeadings.length > 0 ? 'warning' : 'pass',
    message:
      allCapsHeadings.length > 0
        ? `${allCapsHeadings.length} titre(s) en MAJUSCULES (ex: "${allCapsHeadings[0].text.trim()}") — Les lecteurs d'ecran peuvent epeler chaque lettre.`
        : 'Aucun titre en majuscules detecte.',
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(allCapsHeadings.length > 0
      ? { tip: 'Utilisez la casse normale et appliquez text-transform: uppercase en CSS si besoin.' }
      : {}),
  })

  // 6. a11y-link-density — Link text ratio > 30% of content
  const totalLinkTextLength = ctx.allLinks.reduce(
    (sum, link) => sum + link.text.trim().length,
    0,
  )
  const textLength = ctx.fullText.length

  let linkDensityStatus: 'pass' | 'warning' | 'fail' = 'pass'
  let linkDensityMessage = ''

  if (textLength > 0) {
    const ratio = totalLinkTextLength / textLength

    if (ratio > 0.5) {
      linkDensityStatus = 'fail'
      linkDensityMessage = `Le texte des liens represente ${Math.round(ratio * 100)}% du contenu — Ratio trop eleve, la page ressemble a une page de spam.`
    } else if (ratio > 0.3) {
      linkDensityStatus = 'warning'
      linkDensityMessage = `Le texte des liens represente ${Math.round(ratio * 100)}% du contenu — Ratio eleve, reduisez le nombre de liens ou augmentez le contenu textuel.`
    } else {
      linkDensityMessage = `Le texte des liens represente ${Math.round(ratio * 100)}% du contenu — Ratio equilibre.`
    }
  } else {
    linkDensityMessage = 'Pas de contenu textuel pour calculer la densite de liens.'
  }

  checks.push({
    id: 'a11y-link-density',
    label: 'Densite de liens',
    status: linkDensityStatus,
    message: linkDensityMessage,
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(linkDensityStatus !== 'pass'
      ? { tip: 'Reduisez le nombre de liens ou enrichissez le contenu textuel pour equilibrer le ratio.' }
      : {}),
  })

  // 7. a11y-image-filename — Files named like camera defaults
  const cameraAlts = ctx.imageStats.altTexts.filter((alt) => {
    const trimmed = alt.trim()
    if (CAMERA_FILENAME_PATTERN.test(trimmed)) return true
    if (FILE_EXTENSION_PATTERN.test(trimmed)) return true
    return false
  })

  checks.push({
    id: 'a11y-image-filename',
    label: 'Noms de fichiers dans les alt',
    status: cameraAlts.length > 0 ? 'warning' : 'pass',
    message:
      cameraAlts.length > 0
        ? `${cameraAlts.length} image(s) avec un alt ressemblant a un nom de fichier (ex: "${cameraAlts[0]}") — Redigez une description du contenu de l'image.`
        : 'Aucun alt de type nom de fichier detecte.',
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(cameraAlts.length > 0
      ? { tip: 'Remplacez les noms de fichiers (IMG_001, DSC_234) par une description utile de l\'image.' }
      : {}),
  })

  // 8. a11y-alt-duplicates-context — Alt identical to adjacent heading
  const headingTextsNormalized = ctx.allHeadings.map((h) =>
    normalizeForComparison(h.text),
  )
  const redundantAlts = ctx.imageStats.altTexts.filter((alt) => {
    const normalizedAlt = normalizeForComparison(alt)
    if (!normalizedAlt) return false
    return headingTextsNormalized.includes(normalizedAlt)
  })

  checks.push({
    id: 'a11y-alt-duplicates-context',
    label: 'Alt identique a un titre',
    status: redundantAlts.length > 0 ? 'warning' : 'pass',
    message:
      redundantAlts.length > 0
        ? `${redundantAlts.length} image(s) dont l'alt est identique a un titre de la page (ex: "${redundantAlts[0]}") — L'information est redondante pour les lecteurs d'ecran.`
        : 'Aucun alt redondant avec les titres de la page.',
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(redundantAlts.length > 0
      ? { tip: 'Differenciez le texte alternatif des titres en decrivant specifiquement ce que montre l\'image.' }
      : {}),
  })

  return checks
}
