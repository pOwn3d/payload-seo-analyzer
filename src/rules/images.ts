/**
 * SEO Rules — Images checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { ALT_TEXT_MIN_RATIO, ALT_TEXT_MIN_LENGTH } from '../constants.js'
import { getTranslations } from '../i18n.js'

// ---------------------------------------------------------------------------
// Image metadata extraction helpers
// ---------------------------------------------------------------------------

/** Optimized image formats */
const OPTIMIZED_FORMATS = new Set(['webp', 'avif'])

/** Generic filename patterns (case-insensitive) */
const GENERIC_FILENAME_PATTERNS = [
  /^img[_-]?\d/i,
  /^image[_-]?\d/i,
  /^screenshot/i,
  /^capture/i,
  /^photo[_-]?\d/i,
  /^dsc[_-]?\d/i,
  /^dcim/i,
  /^unnamed/i,
  /^untitled/i,
  /^file[_-]?\d/i,
  /^pic[_-]?\d/i,
]

interface ImageMeta {
  filename?: string
  width?: number
  height?: number
  mimeType?: string
  url?: string
}

/** Extract image metadata from a media object */
function extractImageMeta(media: unknown): ImageMeta | null {
  if (!media || typeof media !== 'object') return null
  const m = media as Record<string, unknown>
  if (!m.url && !m.filename) return null

  return {
    filename: typeof m.filename === 'string' ? m.filename : undefined,
    width: typeof m.width === 'number' ? m.width : undefined,
    height: typeof m.height === 'number' ? m.height : undefined,
    mimeType: typeof m.mimeType === 'string' ? m.mimeType : undefined,
    url: typeof m.url === 'string' ? m.url : undefined,
  }
}

/** Collect all image metadata from input data */
function collectImageMetas(input: SeoInput): ImageMeta[] {
  const metas: ImageMeta[] = []

  // Hero media
  if (input.heroMedia) {
    const meta = extractImageMeta(input.heroMedia)
    if (meta) metas.push(meta)
  }

  // Meta image
  if (input.metaImage) {
    const meta = extractImageMeta(input.metaImage)
    if (meta) metas.push(meta)
  }

  // Block images
  if (input.blocks && Array.isArray(input.blocks)) {
    for (const block of input.blocks) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>

      // MediaBlock
      if ((b.blockType === 'mediaBlock' || b.blockType === 'media') && b.media) {
        const meta = extractImageMeta(b.media)
        if (meta) metas.push(meta)
      }

      // Content columns with media
      if (b.columns && Array.isArray(b.columns)) {
        for (const col of b.columns) {
          if (col && typeof col === 'object') {
            const colObj = col as Record<string, unknown>
            if (colObj.media) {
              const meta = extractImageMeta(colObj.media)
              if (meta) metas.push(meta)
            }
          }
        }
      }
    }
  }

  return metas
}

/** Get file extension from filename or URL */
function getFileExtension(meta: ImageMeta): string {
  const source = meta.filename || meta.url || ''
  const match = source.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/)
  return match ? match[1]!.toLowerCase() : ''
}

/** Check if filename is generic */
function isGenericFilename(filename: string): boolean {
  // Strip extension
  const name = filename.replace(/\.[^.]+$/, '')
  return GENERIC_FILENAME_PATTERNS.some((pattern) => pattern.test(name))
}

export function checkImages(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.images
  const { imageStats, normalizedKeyword, isPost, pageType } = ctx

  // Legal, contact and form pages don't need images — auto-pass
  if (pageType === 'legal' || pageType === 'contact' || pageType === 'form') {
    if (imageStats.total > 0) {
      // Still check alt text if images exist
      const altRate = imageStats.withAlt / imageStats.total
      const missing = imageStats.total - imageStats.withAlt
      checks.push({
        id: 'images-alt',
        label: r.altLabel,
        status: altRate === 1 ? 'pass' : 'warning',
        message: altRate === 1
          ? r.altAllPass(imageStats.total)
          : r.altSomeFail(missing, imageStats.total),
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
    checks.push({
      id: 'images-present',
      label: r.presentLabel,
      status: 'pass',
      message: r.presentUtilityPass,
      category: 'bonus',
      weight: 1,
      group: 'images',
    })
    return checks
  }

  // 26. Alt text on all images (>= 80%)
  if (imageStats.total > 0) {
    const altRate = imageStats.withAlt / imageStats.total
    const missing = imageStats.total - imageStats.withAlt

    if (altRate >= ALT_TEXT_MIN_RATIO) {
      checks.push({
        id: 'images-alt',
        label: r.altLabel,
        status: altRate === 1 ? 'pass' : 'warning',
        message:
          altRate === 1
            ? r.altAllPass(imageStats.total)
            : r.altSomeFail(missing, imageStats.total),
        category: 'important',
        weight: 2,
        group: 'images',
      })
    } else {
      checks.push({
        id: 'images-alt',
        label: r.altLabel,
        status: 'fail',
        message: r.altMostFail(missing, imageStats.total),
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
  }

  // 27. Focus keyword in at least 1 alt text (or descriptive alt present)
  if (normalizedKeyword && imageStats.altTexts.length > 0) {
    const kwNorm = normalizedKeyword // already accent-stripped
    const kwInAlt = imageStats.altTexts.some((alt) => {
      const altNorm = alt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Exact keyword match (accent-insensitive)
      if (altNorm.includes(kwNorm)) return true
      // Word-level: any significant keyword word (>3 chars) in alt
      const kwWords = kwNorm.split(/\s+/).filter((w) => w.length > 3)
      if (kwWords.length > 0 && kwWords.some((w) => altNorm.includes(w))) return true
      // Descriptive alt (>ALT_TEXT_MIN_LENGTH chars) is acceptable
      return alt.trim().length >= ALT_TEXT_MIN_LENGTH
    })

    checks.push({
      id: 'images-alt-keyword',
      label: r.altKeywordLabel,
      status: kwInAlt ? 'pass' : 'warning',
      message: kwInAlt ? r.altKeywordPass : r.altKeywordFail,
      category: 'bonus',
      weight: 1,
      group: 'images',
    })
  }

  // 28. At least 1 image/media present
  if (imageStats.total === 0) {
    checks.push({
      id: 'images-present',
      label: r.presentLabel,
      status: 'warning',
      message: r.presentFail,
      category: 'important',
      weight: 2,
      group: 'images',
    })
  } else {
    checks.push({
      id: 'images-present',
      label: r.presentLabel,
      status: 'pass',
      message: r.presentPass(imageStats.total),
      category: 'important',
      weight: 2,
      group: 'images',
    })
  }

  // 29. Image quantity quality (4+ excellent, 1-3 ok, 0 fail for posts)
  if (isPost) {
    if (imageStats.total >= 1) {
      checks.push({
        id: 'images-quantity',
        label: r.quantityLabel,
        status: 'pass',
        message: r.quantityPass(imageStats.total),
        category: 'bonus',
        weight: 1,
        group: 'images',
      })
    } else {
      checks.push({
        id: 'images-quantity',
        label: r.quantityLabel,
        status: 'fail',
        message: r.quantityFail,
        category: 'important',
        weight: 2,
        group: 'images',
      })
    }
  }

  // ---------------------------------------------------------------------------
  // New image optimization checks (only if images exist)
  // ---------------------------------------------------------------------------

  if (imageStats.total > 0) {
    const imageMetas = collectImageMetas(_input)

    // 30. Image format check — flag non-WebP/AVIF
    if (imageMetas.length > 0) {
      const nonOptimized = imageMetas.filter((m) => {
        // Check mimeType first
        if (m.mimeType) {
          const mime = m.mimeType.toLowerCase()
          if (mime.includes('webp') || mime.includes('avif')) return false
        }
        // Fallback to extension
        const ext = getFileExtension(m)
        if (!ext) return false // Unknown format — don't flag
        return !OPTIMIZED_FORMATS.has(ext)
      })

      checks.push({
        id: 'image-format',
        label: r.formatLabel,
        status: nonOptimized.length === 0 ? 'pass' : 'warning',
        message: nonOptimized.length === 0
          ? r.formatPass
          : r.formatFail(nonOptimized.length),
        category: 'bonus',
        weight: 1,
        group: 'images',
      })
    }

    // 31. Image dimensions — flag images without width/height
    if (imageMetas.length > 0) {
      const missingDimensions = imageMetas.filter(
        (m) => m.width === undefined || m.height === undefined,
      )

      checks.push({
        id: 'image-dimensions',
        label: r.dimensionsLabel,
        status: missingDimensions.length === 0 ? 'pass' : 'warning',
        message: missingDimensions.length === 0
          ? r.dimensionsPass
          : r.dimensionsFail(missingDimensions.length),
        category: 'bonus',
        weight: 1,
        group: 'images',
      })
    }

    // 32. Image filename — flag generic filenames
    if (imageMetas.length > 0) {
      const genericNames = imageMetas.filter((m) => {
        const filename = m.filename || ''
        if (!filename) return false
        return isGenericFilename(filename)
      })

      checks.push({
        id: 'image-filename',
        label: r.filenameLabel,
        status: genericNames.length === 0 ? 'pass' : 'warning',
        message: genericNames.length === 0
          ? r.filenamePass
          : r.filenameFail(genericNames.length),
        category: 'bonus',
        weight: 1,
        group: 'images',
      })
    }
  }

  return checks
}
