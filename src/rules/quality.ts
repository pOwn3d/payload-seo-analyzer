/**
 * SEO Rules — Content quality checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { MIN_WORDS_QUALITY_FAIL, MIN_WORDS_QUALITY_WARN } from '../constants.js'
import { getTranslations } from '../i18n.js'

/** Minimum length of a repeated block for it to count as duplicate content. */
const DUPLICATE_BLOCK_LENGTH = 30

/**
 * Cap on slice comparisons, so a pathological input can never make this loop
 * expensive. Real duplicate content is found in the first few comparisons.
 */
const MAX_VERIFICATIONS = 2_000

/**
 * Detect a tandem repeat: a block of at least 30 characters immediately
 * followed by an identical copy — the same thing `/(.{30,})\1/i` matched.
 *
 * That regex was replaced because its backreference backtracked
 * catastrophically on the NON-matching path, which is the normal case: 428 ms
 * at 1 000 words, 4.7 s at 2 500, 11.6 s at 4 000 — and this rule runs on every
 * keystroke in the editor.
 *
 * Here every 30-character window is indexed once. When a window is seen again
 * `p` characters later, the two blocks of length `p` are compared: if they are
 * equal, the text repeats itself with period `p >= 30`, which is exactly a
 * tandem repeat. Expected linear time.
 */
function hasTandemRepeat(text: string): boolean {
  const len = text.length
  if (len < DUPLICATE_BLOCK_LENGTH * 2) return false

  const lower = text.toLowerCase() // the original pattern was case-insensitive
  const firstSeenAt = new Map<string, number>()
  let verifications = 0

  for (let i = 0; i + DUPLICATE_BLOCK_LENGTH <= len; i++) {
    const window = lower.slice(i, i + DUPLICATE_BLOCK_LENGTH)
    const previous = firstSeenAt.get(window)

    if (previous === undefined) {
      firstSeenAt.set(window, i)
      continue
    }

    const period = i - previous
    if (period < DUPLICATE_BLOCK_LENGTH || previous + 2 * period > len) continue

    if (++verifications > MAX_VERIFICATIONS) break
    if (lower.slice(previous, i) === lower.slice(i, i + period)) return true
  }

  return false
}

export function checkQuality(_input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.quality
  const { fullText, wordCount } = ctx

  // 45. No duplicate/placeholder content detected
  const placeholderPatterns = [
    /\b(lorem ipsum|dolor sit amet|consectetur adipiscing)\b/i,
    /\b(texte de remplacement|contenu temporaire|texte generique)\b/i,
    /\b(titre de la page|description de la page)\b/i,
  ]

  const hasDuplicateContent =
    hasTandemRepeat(fullText) || placeholderPatterns.some((p) => p.test(fullText))

  checks.push({
    id: 'quality-no-duplicate',
    label: r.noDuplicateLabel,
    status: hasDuplicateContent ? 'fail' : 'pass',
    message: hasDuplicateContent ? r.noDuplicateFail : r.noDuplicatePass,
    category: 'critical',
    weight: 3,
    group: 'quality',
  })

  // 46. Substantial content (not thin content)
  if (wordCount < MIN_WORDS_QUALITY_FAIL) {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'fail',
      message: r.substantialFail(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else if (wordCount < MIN_WORDS_QUALITY_WARN) {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'warning',
      message: r.substantialWarn(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  } else {
    checks.push({
      id: 'quality-substantial',
      label: r.substantialLabel,
      status: 'pass',
      message: r.substantialPass(wordCount),
      category: 'critical',
      weight: 3,
      group: 'quality',
    })
  }

  return checks
}
