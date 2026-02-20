/**
 * SEO Rules — Title tag checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { normalizeForComparison, keywordMatchesText } from '../helpers.js'
import { TITLE_LENGTH_MIN, TITLE_LENGTH_MAX, getPowerWords } from '../constants.js'
import { getTranslations } from '../i18n.js'

export function checkTitle(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const r = getTranslations(ctx.locale).rules.title
  const title = input.metaTitle || ''
  const titleLen = title.length
  const kw = ctx.normalizedKeyword

  // 1. Title present and non-empty
  if (!title) {
    checks.push({
      id: 'title-missing',
      label: r.missingLabel,
      status: 'fail',
      message: r.missingMessage,
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: r.missingTip,
    })
    return checks // no point checking further
  }

  // 2. Length TITLE_LENGTH_MIN-TITLE_LENGTH_MAX characters
  if (titleLen < TITLE_LENGTH_MIN) {
    checks.push({
      id: 'title-length',
      label: r.lengthLabel,
      status: 'warning',
      message: r.lengthShort(titleLen),
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: r.lengthShortTip,
    })
  } else if (titleLen > TITLE_LENGTH_MAX) {
    checks.push({
      id: 'title-length',
      label: r.lengthLabel,
      status: 'warning',
      message: r.lengthLong(titleLen),
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: r.lengthLongTip,
    })
  } else {
    checks.push({
      id: 'title-length',
      label: r.lengthLabel,
      status: 'pass',
      message: r.lengthPass(titleLen),
      category: 'critical',
      weight: 3,
      group: 'title',
    })
  }

  // 3. Focus keyword present in title (smart French matching)
  if (kw) {
    const titleNorm = normalizeForComparison(title)
    const kwPresent = keywordMatchesText(kw, titleNorm)

    checks.push({
      id: 'title-keyword',
      label: r.keywordLabel,
      status: kwPresent ? 'pass' : 'warning',
      message: kwPresent
        ? r.keywordPass(input.focusKeyword || kw)
        : r.keywordFail(input.focusKeyword || kw),
      category: 'critical',
      weight: 3,
      group: 'title',
    })

    // 4. Keyword in the first 50% of the title
    if (kwPresent) {
      const kwPos = titleNorm.indexOf(kw)
      const halfLen = Math.floor(titleLen / 2)
      const inFirstHalf = kwPos < halfLen

      checks.push({
        id: 'title-keyword-position',
        label: r.keywordPositionLabel,
        status: inFirstHalf ? 'pass' : 'warning',
        message: inFirstHalf
          ? r.keywordPositionPass
          : r.keywordPositionFail,
        category: 'important',
        weight: 2,
        group: 'title',
      })
    }
  }

  // 5. No duplicate brand name ("Brand | Brand")
  const titleParts = title.split(/\s+[|–—]\s+|\s+-\s+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
  const uniqueParts = new Set(titleParts)
  if (titleParts.length > 1 && uniqueParts.size < titleParts.length) {
    checks.push({
      id: 'title-duplicate-brand',
      label: r.duplicateBrandLabel,
      status: 'warning',
      message: r.duplicateBrandFail,
      category: 'important',
      weight: 2,
      group: 'title',
      tip: r.duplicateBrandTip,
    })
  } else {
    checks.push({
      id: 'title-duplicate-brand',
      label: r.duplicateBrandLabel,
      status: 'pass',
      message: r.duplicateBrandPass,
      category: 'important',
      weight: 2,
      group: 'title',
    })
  }

  // C2. Power words in title — boost CTR
  const titleNormForPower = normalizeForComparison(title)
  const foundPowerWords = getPowerWords(ctx.locale || 'fr').filter((pw) => titleNormForPower.includes(pw))

  if (foundPowerWords.length > 0) {
    checks.push({
      id: 'title-power-words',
      label: r.powerWordsLabel,
      status: 'pass',
      message: r.powerWordsPass(foundPowerWords.length, foundPowerWords.slice(0, 3).join(', ')),
      category: 'bonus',
      weight: 1,
      group: 'title',
    })
  } else {
    checks.push({
      id: 'title-power-words',
      label: r.powerWordsLabel,
      status: 'warning',
      message: r.powerWordsFail,
      category: 'bonus',
      weight: 1,
      group: 'title',
      tip: r.powerWordsTip,
    })
  }

  // Headline analyzer — Number in title (listicle-friendly, +36% CTR)
  const hasNumber = /\d/.test(title)
  checks.push({
    id: 'title-has-number',
    label: r.hasNumberLabel,
    status: hasNumber ? 'pass' : 'warning',
    message: hasNumber ? r.hasNumberPass : r.hasNumberFail,
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(hasNumber ? {} : { tip: r.hasNumberTip }),
  })

  // Headline analyzer — Question title (Featured Snippet friendly)
  const questionWords = ctx.locale === 'en'
    ? ['how', 'why', 'when', 'what', 'which', 'where', 'who', 'can', 'do', 'does', 'is', 'are', 'should']
    : ['comment', 'pourquoi', 'quand', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'ou', 'qui', 'que', 'est-ce']
  const titleLower = title.toLowerCase().trim()
  const isQuestion = questionWords.some(w => titleLower.startsWith(w + ' ') || titleLower.startsWith(w + '-'))
    || title.trim().endsWith('?')
  checks.push({
    id: 'title-is-question',
    label: r.isQuestionLabel,
    status: isQuestion ? 'pass' : 'warning',
    message: isQuestion ? r.isQuestionPass : r.isQuestionFail,
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(isQuestion ? {} : { tip: r.isQuestionTip }),
  })

  // Headline analyzer — Sentiment/emotional words
  const sentimentWords = ctx.locale === 'en'
    ? ['mistake', 'secret', 'incredible', 'danger', 'urgent', 'shocking', 'terrible', 'extraordinary', 'fascinating', 'astonishing', 'surprising', 'impressive', 'remarkable', 'crucial', 'vital', 'essential', 'forbidden', 'impossible', 'revolutionary']
    : ['erreur', 'secret', 'incroyable', 'danger', 'urgent', 'choquant', 'terrible', 'extraordinaire', 'fascinant', 'etonnant', 'surprenant', 'impressionnant', 'remarquable', 'crucial', 'vital', 'indispensable', 'interdit', 'impossible', 'revolutionnaire']
  const titleNormForSentiment = normalizeForComparison(title)
  const foundSentiment = sentimentWords.filter(w => titleNormForSentiment.includes(w))
  checks.push({
    id: 'title-sentiment',
    label: r.sentimentLabel,
    status: foundSentiment.length > 0 ? 'pass' : 'warning',
    message: foundSentiment.length > 0
      ? r.sentimentPass(foundSentiment.length, foundSentiment.slice(0, 3).join(', '))
      : r.sentimentFail,
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(foundSentiment.length > 0 ? {} : { tip: r.sentimentTip }),
  })

  return checks
}
