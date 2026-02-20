/**
 * SEO Rules — Content checks (weight: 2, category: important)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { normalizeForComparison, keywordMatchesText, countKeywordOccurrences, extractListsFromLexical } from '../helpers'
import {
  MIN_WORDS_POST,
  MIN_WORDS_FORM,
  MIN_WORDS_LEGAL,
  MIN_WORDS_GENERIC,
  MIN_WORDS_THIN,
  KEYWORD_DENSITY_MAX,
  KEYWORD_DENSITY_WARN,
  KEYWORD_DENSITY_MIN,
  PLACEHOLDER_PATTERNS,
} from '../constants'

export function checkContent(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const { fullText, wordCount, normalizedKeyword, isPost, pageType } = ctx

  // Adapted min words by page type
  const isFormPage = pageType === 'form' || pageType === 'contact'
  const isLegalPage = pageType === 'legal'
  const minWords = isPost ? MIN_WORDS_POST : isFormPage ? MIN_WORDS_FORM : isLegalPage ? MIN_WORDS_LEGAL : MIN_WORDS_GENERIC
  const minLabel = isPost
    ? '800 mots (article)'
    : isFormPage
      ? '150 mots (page formulaire)'
      : isLegalPage
        ? '200 mots (page legale)'
        : '300 mots (page)'

  // 20. Minimum word count
  if (wordCount < MIN_WORDS_THIN) {
    checks.push({
      id: 'content-wordcount',
      label: 'Volume de contenu',
      status: 'fail',
      message: `Seulement ${wordCount} mots — Visez au moins ${minLabel} pour un bon referencement.`,
      category: 'important',
      weight: 2,
      group: 'content',
      tip: 'Ajoutez des sections avec des sous-titres H2, des exemples concrets, une FAQ ou des temoignages.',
    })
  } else if (wordCount < minWords) {
    checks.push({
      id: 'content-wordcount',
      label: 'Volume de contenu',
      status: 'warning',
      message: `${wordCount} mots — Correct mais insuffisant. Visez ${minLabel}.`,
      category: 'important',
      weight: 2,
      group: 'content',
      tip: 'Developpez le contenu avec des paragraphes explicatifs, des exemples ou une section FAQ.',
    })
  } else {
    checks.push({
      id: 'content-wordcount',
      label: 'Volume de contenu',
      status: 'pass',
      message: `${wordCount} mots — Volume de contenu suffisant.`,
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // 21. Focus keyword in the first paragraph (smart French matching)
  if (normalizedKeyword && fullText.trim()) {
    // First ~500 characters or up to first newline / sentence-ending period
    const firstParagraph = normalizeForComparison(fullText.trim().slice(0, 500))
    // Split on sentence-ending periods (followed by space/end) or newlines,
    // but NOT mid-word dots like in "node.js", "next.js", "vue.js", etc.
    const firstParaWords = firstParagraph.split(/\.(?=\s|$)|\n/).slice(0, 2).join(' ')
    const kwInFirstPara = keywordMatchesText(normalizedKeyword, firstParaWords)

    checks.push({
      id: 'content-keyword-intro',
      label: 'Mot-cle dans l\'introduction',
      status: kwInFirstPara ? 'pass' : 'warning',
      message: kwInFirstPara
        ? 'Le mot-cle apparait dans le premier paragraphe — Bonne pratique.'
        : `Ajoutez le mot-cle "${input.focusKeyword}" dans les premieres phrases du contenu.`,
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // 22-23. Keyword density (0.5% - 2.5%) with smart French matching
  if (normalizedKeyword && wordCount > 0) {
    const fullTextLower = normalizeForComparison(fullText)
    const { exactCount, wordLevelMatch, effectiveDensity } =
      countKeywordOccurrences(normalizedKeyword, fullTextLower, wordCount)

    const density = effectiveDensity

    if (density > KEYWORD_DENSITY_MAX) {
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'fail',
        message: `Densite du mot-cle : ${density.toFixed(1)}% — Trop eleve (>3%), risque de suroptimisation (keyword stuffing).`,
        category: 'critical',
        weight: 3,
        group: 'content',
      })
    } else if (density > KEYWORD_DENSITY_WARN) {
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'warning',
        message: `Densite du mot-cle : ${density.toFixed(1)}% — Legerement elevee. Restez entre 0,5% et 2,5%.`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else if (density >= KEYWORD_DENSITY_MIN) {
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'pass',
        message: exactCount > 0
          ? `Densite du mot-cle : ${density.toFixed(1)}% — Equilibre ideal.`
          : `Les composants du mot-cle sont presents dans le contenu (densite estimee : ${density.toFixed(1)}%).`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else if (wordLevelMatch) {
      // Individual words present but low density
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'warning',
        message: `Les composants du mot-cle sont presents mais peu frequents (densite estimee : ${density.toFixed(1)}%). Renforcez leur presence.`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else if (exactCount > 0) {
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'warning',
        message: `Densite du mot-cle : ${density.toFixed(1)}% — Trop faible. Visez 0,5% a 2,5%.`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else {
      checks.push({
        id: 'content-keyword-density',
        label: 'Densite du mot-cle',
        status: 'fail',
        message: `Le mot-cle "${input.focusKeyword}" n'apparait jamais dans le contenu.`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    }
  }

  // 24. No placeholder content
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some((p) => p.test(fullText))

  checks.push({
    id: 'content-no-placeholder',
    label: 'Contenu placeholder',
    status: hasPlaceholder ? 'fail' : 'pass',
    message: hasPlaceholder
      ? 'Du contenu placeholder a ete detecte (lorem ipsum, TODO, etc.) — Remplacez par du vrai contenu.'
      : 'Aucun contenu placeholder detecte.',
    category: 'critical',
    weight: 3,
    group: 'content',
    ...(hasPlaceholder && { tip: 'Recherchez "lorem", "TODO", "TBD" dans l\'editeur et remplacez par du vrai contenu metier.' }),
  })

  // 25. Not thin content (>MIN_WORDS_THIN words of unique text)
  if (wordCount > 0 && wordCount <= MIN_WORDS_THIN) {
    checks.push({
      id: 'content-thin',
      label: 'Contenu trop fin',
      status: 'warning',
      message: `Seulement ${wordCount} mots de contenu — Les pages avec moins de 100 mots risquent d'etre ignorees par Google.`,
      category: 'important',
      weight: 2,
      group: 'content',
      tip: 'Developpez le contenu avec des paragraphes explicatifs, des exemples concrets ou une FAQ.',
    })
  } else if (wordCount > MIN_WORDS_THIN) {
    checks.push({
      id: 'content-thin',
      label: 'Contenu substantiel',
      status: 'pass',
      message: 'Le contenu est suffisamment riche pour etre indexe.',
      category: 'important',
      weight: 2,
      group: 'content',
    })
  }

  // C1. Keyword distribution — check keyword presence in 3 content tiers
  if (normalizedKeyword && wordCount >= 100) {
    const fullTextNorm = normalizeForComparison(fullText)
    const thirdLen = Math.floor(fullTextNorm.length / 3)
    const tier1 = fullTextNorm.slice(0, thirdLen)
    const tier2 = fullTextNorm.slice(thirdLen, thirdLen * 2)
    const tier3 = fullTextNorm.slice(thirdLen * 2)

    const tiersWithKw = [tier1, tier2, tier3].filter(
      (t) => keywordMatchesText(normalizedKeyword, t),
    ).length

    if (tiersWithKw >= 2) {
      checks.push({
        id: 'content-keyword-distribution',
        label: 'Distribution du mot-cle',
        status: 'pass',
        message: `Mot-cle present dans ${tiersWithKw}/3 sections du contenu — Bonne repartition.`,
        category: 'important',
        weight: 2,
        group: 'content',
      })
    } else if (tiersWithKw === 1) {
      checks.push({
        id: 'content-keyword-distribution',
        label: 'Distribution du mot-cle',
        status: 'warning',
        message: `Mot-cle present dans seulement 1/3 du contenu — Repartissez-le dans tout le texte.`,
        category: 'important',
        weight: 2,
        group: 'content',
        tip: 'Utilisez le mot-cle naturellement dans l\'introduction, le corps et la conclusion du texte.',
      })
    } else {
      checks.push({
        id: 'content-keyword-distribution',
        label: 'Distribution du mot-cle',
        status: 'fail',
        message: 'Mot-cle absent des sections du contenu — Il doit apparaitre dans au moins 2 des 3 tiers.',
        category: 'important',
        weight: 2,
        group: 'content',
        tip: 'Inserez le mot-cle dans l\'introduction, dans au moins un sous-titre H2 et dans la conclusion.',
      })
    }
  }

  // C3. Presence of lists (ol/ul) — improves readability and featured snippets
  if (wordCount > 500) {
    // Collect lists from all Lexical sources
    const allLists: Array<{ listType: string; items: number }> = []

    if (input.heroRichText) {
      allLists.push(...extractListsFromLexical(input.heroRichText))
    }
    if (input.content) {
      allLists.push(...extractListsFromLexical(input.content))
    }
    if (input.blocks && Array.isArray(input.blocks)) {
      for (const block of input.blocks) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        if (b.richText) allLists.push(...extractListsFromLexical(b.richText))
        if (b.columns && Array.isArray(b.columns)) {
          for (const col of b.columns) {
            if (col && typeof col === 'object') {
              const c = col as Record<string, unknown>
              if (c.richText) allLists.push(...extractListsFromLexical(c.richText))
            }
          }
        }
      }
    }

    if (allLists.length > 0) {
      checks.push({
        id: 'content-has-lists',
        label: 'Listes dans le contenu',
        status: 'pass',
        message: `${allLists.length} liste(s) detectee(s) — Les listes ameliorent la lisibilite et les chances de featured snippet.`,
        category: 'bonus',
        weight: 1,
        group: 'content',
      })
    } else {
      checks.push({
        id: 'content-has-lists',
        label: 'Listes dans le contenu',
        status: 'warning',
        message: 'Aucune liste detectee — Ajoutez des listes a puces ou numerotees pour structurer le contenu.',
        category: 'bonus',
        weight: 1,
        group: 'content',
        tip: 'Utilisez des listes pour enumerer des etapes, des avantages ou des fonctionnalites. Google les utilise souvent pour les featured snippets.',
      })
    }
  }

  return checks
}
