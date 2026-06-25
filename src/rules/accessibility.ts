/**
 * SEO Rules — Accessibility checks (weight: 1-3, category: bonus/important/critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { normalizeForComparison } from '../helpers.js'
import { getTranslations } from '../i18n.js'

/** Patterns that indicate a generic/placeholder alt text */
const GENERIC_ALT_PATTERN = /^(image|photo|img|picture|screenshot|capture|untitled)\d*$/i

/** Patterns that indicate a file extension in alt text */
const FILE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i

/** Camera/device default filename patterns */
const CAMERA_FILENAME_PATTERN = /\b(IMG_\d+|DSC_\d+|DCIM|photo-\d+|image-\d+|screenshot-\d+)\b/i

export function checkAccessibility(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.accessibility

  // 1. a11y-short-anchors — Links with text < 3 characters
  const shortAnchors = ctx.allLinks.filter(
    (link) => link.text.trim().length > 0 && link.text.trim().length < 3,
  )

  checks.push({
    id: 'a11y-short-anchors',
    label: r.shortAnchorsLabel,
    status: shortAnchors.length > 0 ? 'fail' : 'pass',
    message:
      shortAnchors.length > 0
        ? r.shortAnchorsFail(shortAnchors.length, shortAnchors[0].text.trim())
        : r.shortAnchorsPass,
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(shortAnchors.length > 0 ? { tip: r.shortAnchorsTip } : {}),
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
    label: r.altQualityLabel,
    status: genericAlts.length > 0 ? 'warning' : 'pass',
    message:
      genericAlts.length > 0
        ? r.altQualityFail(genericAlts.length, genericAlts[0])
        : r.altQualityPass,
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(genericAlts.length > 0 ? { tip: r.altQualityTip } : {}),
  })

  // 3. a11y-empty-headings — Empty headings (h2-h6)
  const emptyHeadings = ctx.allHeadings.filter(
    (h) => h.tag !== 'h1' && h.text.trim().length === 0,
  )

  checks.push({
    id: 'a11y-empty-headings',
    label: r.emptyHeadingsLabel,
    status: emptyHeadings.length > 0 ? 'fail' : 'pass',
    message:
      emptyHeadings.length > 0
        ? r.emptyHeadingsFail(emptyHeadings.length, emptyHeadings.map((h) => h.tag).join(', '))
        : r.emptyHeadingsPass,
    category: 'critical',
    weight: 3,
    group: 'accessibility',
    ...(emptyHeadings.length > 0 ? { tip: r.emptyHeadingsTip } : {}),
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
    label: r.duplicateLinksLabel,
    status: adjacentDuplicates > 0 ? 'warning' : 'pass',
    message:
      adjacentDuplicates > 0
        ? r.duplicateLinksFail(adjacentDuplicates)
        : r.duplicateLinksPass,
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(adjacentDuplicates > 0 ? { tip: r.duplicateLinksTip } : {}),
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
    label: r.allCapsLabel,
    status: allCapsHeadings.length > 0 ? 'warning' : 'pass',
    message:
      allCapsHeadings.length > 0
        ? r.allCapsFail(allCapsHeadings.length, allCapsHeadings[0].text.trim())
        : r.allCapsPass,
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(allCapsHeadings.length > 0 ? { tip: r.allCapsTip } : {}),
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
    const pct = Math.round(ratio * 100)

    if (ratio > 0.5) {
      linkDensityStatus = 'fail'
      linkDensityMessage = r.linkDensityFail(pct)
    } else if (ratio > 0.3) {
      linkDensityStatus = 'warning'
      linkDensityMessage = r.linkDensityWarn(pct)
    } else {
      linkDensityMessage = r.linkDensityPass(pct)
    }
  } else {
    linkDensityMessage = r.linkDensityNoContent
  }

  checks.push({
    id: 'a11y-link-density',
    label: r.linkDensityLabel,
    status: linkDensityStatus,
    message: linkDensityMessage,
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(linkDensityStatus !== 'pass' ? { tip: r.linkDensityTip } : {}),
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
    label: r.imageFilenameLabel,
    status: cameraAlts.length > 0 ? 'warning' : 'pass',
    message:
      cameraAlts.length > 0
        ? r.imageFilenameFail(cameraAlts.length, cameraAlts[0])
        : r.imageFilenamePass,
    category: 'important',
    weight: 2,
    group: 'accessibility',
    ...(cameraAlts.length > 0 ? { tip: r.imageFilenameTip } : {}),
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
    label: r.altDuplicatesLabel,
    status: redundantAlts.length > 0 ? 'warning' : 'pass',
    message:
      redundantAlts.length > 0
        ? r.altDuplicatesFail(redundantAlts.length, redundantAlts[0])
        : r.altDuplicatesPass,
    category: 'bonus',
    weight: 1,
    group: 'accessibility',
    ...(redundantAlts.length > 0 ? { tip: r.altDuplicatesTip } : {}),
  })

  return checks
}
