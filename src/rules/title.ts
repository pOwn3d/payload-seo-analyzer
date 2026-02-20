/**
 * SEO Rules — Title tag checks (weight: 3, category: critical)
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types'
import { normalizeForComparison, keywordMatchesText } from '../helpers'
import { TITLE_LENGTH_MIN, TITLE_LENGTH_MAX, POWER_WORDS_FR } from '../constants'

export function checkTitle(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []
  const title = input.metaTitle || ''
  const titleLen = title.length
  const kw = ctx.normalizedKeyword

  // 1. Title present and non-empty
  if (!title) {
    checks.push({
      id: 'title-missing',
      label: 'Meta title',
      status: 'fail',
      message: 'Meta title manquant — Ajoutez un titre pour le referencement.',
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: 'Redigez un titre de 30-60 caracteres contenant le mot-cle principal et le nom de marque.',
    })
    return checks // no point checking further
  }

  // 2. Length TITLE_LENGTH_MIN-TITLE_LENGTH_MAX characters
  if (titleLen < TITLE_LENGTH_MIN) {
    checks.push({
      id: 'title-length',
      label: 'Longueur du title',
      status: 'warning',
      message: `Meta title (${titleLen} car.) — Trop court. Visez 30 a 60 caracteres.`,
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: 'Ajoutez des mots descriptifs ou le nom de marque pour atteindre 30 caracteres minimum.',
    })
  } else if (titleLen > TITLE_LENGTH_MAX) {
    checks.push({
      id: 'title-length',
      label: 'Longueur du title',
      status: 'warning',
      message: `Meta title (${titleLen} car.) — Trop long, sera coupe dans Google. Reduisez a 60 max.`,
      category: 'critical',
      weight: 3,
      group: 'title',
      tip: 'Google tronque au-dela de ~60 caracteres. Supprimez les mots superflus et gardez l\'essentiel.',
    })
  } else {
    checks.push({
      id: 'title-length',
      label: 'Longueur du title',
      status: 'pass',
      message: `Meta title (${titleLen} car.) — Longueur ideale.`,
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
      label: 'Mot-cle dans le title',
      status: kwPresent ? 'pass' : 'warning',
      message: kwPresent
        ? `Le mot-cle "${input.focusKeyword}" est present dans le meta title.`
        : `Le mot-cle "${input.focusKeyword}" n'est pas dans le meta title — Ajoutez-le pour un meilleur referencement.`,
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
        label: 'Position du mot-cle',
        status: inFirstHalf ? 'pass' : 'warning',
        message: inFirstHalf
          ? 'Le mot-cle est place en debut de title — Position ideale.'
          : 'Le mot-cle est en fin de title — Placez-le au debut pour un meilleur impact.',
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
      label: 'Nom de marque duplique',
      status: 'warning',
      message:
        'Le title contient une partie dupliquee (ex: "Marque | Marque") — Supprimez le doublon.',
      category: 'important',
      weight: 2,
      group: 'title',
      tip: 'Verifiez que le generateur de meta title n\'ajoute pas automatiquement le nom de marque si vous l\'avez deja inclus.',
    })
  } else {
    checks.push({
      id: 'title-duplicate-brand',
      label: 'Nom de marque duplique',
      status: 'pass',
      message: 'Pas de duplication dans le title.',
      category: 'important',
      weight: 2,
      group: 'title',
    })
  }

  // C2. Power words in title — boost CTR
  const titleNormForPower = normalizeForComparison(title)
  const foundPowerWords = POWER_WORDS_FR.filter((pw) => titleNormForPower.includes(pw))

  if (foundPowerWords.length > 0) {
    checks.push({
      id: 'title-power-words',
      label: 'Mots puissants dans le title',
      status: 'pass',
      message: `Le title contient ${foundPowerWords.length} mot(s) puissant(s) : ${foundPowerWords.slice(0, 3).join(', ')}`,
      category: 'bonus',
      weight: 1,
      group: 'title',
    })
  } else {
    checks.push({
      id: 'title-power-words',
      label: 'Mots puissants dans le title',
      status: 'warning',
      message: 'Le title ne contient aucun mot puissant — Ajoutez un mot comme "gratuit", "guide", "complet" pour booster le CTR.',
      category: 'bonus',
      weight: 1,
      group: 'title',
      tip: 'Les mots puissants (gratuit, exclusif, guide, complet, essentiel...) attirent l\'attention dans les resultats de recherche.',
    })
  }

  // Headline analyzer — Number in title (listicle-friendly, +36% CTR)
  const hasNumber = /\d/.test(title)
  checks.push({
    id: 'title-has-number',
    label: 'Nombre dans le title',
    status: hasNumber ? 'pass' : 'warning',
    message: hasNumber
      ? 'Le title contient un nombre — Les titres avec chiffres generent +36% de CTR.'
      : 'Aucun nombre dans le title — Les titres avec chiffres (ex: "5 astuces", "Top 10") attirent plus de clics.',
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(hasNumber ? {} : { tip: 'Ajoutez un nombre pour creer un titre de type liste (ex: "7 conseils pour...", "Les 3 erreurs a eviter").' }),
  })

  // Headline analyzer — Question title (Featured Snippet friendly)
  const questionWords = ['comment', 'pourquoi', 'quand', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'ou', 'qui', 'que', 'est-ce']
  const titleLower = title.toLowerCase().trim()
  const isQuestion = questionWords.some(w => titleLower.startsWith(w + ' ') || titleLower.startsWith(w + '-'))
    || title.trim().endsWith('?')
  checks.push({
    id: 'title-is-question',
    label: 'Title interrogatif',
    status: isQuestion ? 'pass' : 'warning',
    message: isQuestion
      ? 'Le title est formule en question — Ideal pour les Featured Snippets Google.'
      : 'Le title n\'est pas une question — Les titres interrogatifs favorisent les extraits en vedette.',
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(isQuestion ? {} : { tip: 'Reformulez en question si pertinent (ex: "Comment optimiser votre SEO ?").' }),
  })

  // Headline analyzer — Sentiment/emotional words
  const sentimentWords = ['erreur', 'secret', 'incroyable', 'danger', 'urgent', 'choquant', 'terrible', 'extraordinaire', 'fascinant', 'etonnant', 'surprenant', 'impressionnant', 'remarquable', 'crucial', 'vital', 'indispensable', 'interdit', 'impossible', 'revolutionnaire']
  const titleNormForSentiment = normalizeForComparison(title)
  const foundSentiment = sentimentWords.filter(w => titleNormForSentiment.includes(w))
  checks.push({
    id: 'title-sentiment',
    label: 'Mots emotionnels dans le title',
    status: foundSentiment.length > 0 ? 'pass' : 'warning',
    message: foundSentiment.length > 0
      ? `Le title contient ${foundSentiment.length} mot(s) emotionnel(s) : ${foundSentiment.slice(0, 3).join(', ')}`
      : 'Le title ne contient aucun mot emotionnel — Les mots a forte emotion augmentent le taux de clic.',
    category: 'bonus',
    weight: 1,
    group: 'title',
    ...(foundSentiment.length > 0 ? {} : { tip: 'Ajoutez un mot emotionnel pour capter l\'attention (ex: "erreur", "secret", "incroyable").' }),
  })

  return checks
}
