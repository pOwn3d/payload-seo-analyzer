/**
 * SEO Rules — E-E-A-T signals (SEO 2026).
 *
 * Experience / Expertise / Authoritativeness / Trust is the #1 visibility lever in 2026,
 * but it is NOT a single algorithmic score. These checks detect on-page TRANSPARENCY
 * signals (attributed author, dates, cited sources, original data) — presented as good
 * practice, never as a guarantee of ranking. They are NON-SCORING in the SEO score
 * (weight 0) — E-E-A-T is a framework, not a direct ranking factor — and instead feed
 * the separate AI-readiness indicator (author/entity signals strongly affect AI citation).
 *
 * Translations are kept local (small) to avoid bloating the central i18n file.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'

const STRINGS = {
  fr: {
    authorLabel: 'Auteur attribué (E-E-A-T)',
    authorPass: 'Un auteur est attribué — bon signal de transparence E-E-A-T.',
    authorFail: 'Aucun auteur identifié — attribuez un auteur réel pour renforcer la confiance (E-E-A-T).',
    authorTip: 'Ajoutez un auteur avec une courte bio et un lien vers son profil (Person schema + sameAs).',
    authorEntityLabel: 'Entité auteur (profil / sameAs)',
    authorEntityPass: 'L\'auteur a un lien de profil — renforce l\'entité (sameAs) pour les moteurs et l\'IA.',
    authorEntityFail: 'L\'auteur n\'a pas de lien de profil — ajoutez une URL (LinkedIn, page auteur) comme sameAs.',
    aiAuthorEntityLabel: 'Entité auteur vérifiable (AI-readiness)',
    aiAuthorEntityPass: 'L\'auteur pointe vers une URL de profil reconnue (sameAs) — entité vérifiable, fort levier de citation par les IA.',
    aiAuthorEntityFail: 'Le lien auteur ne ressemble pas à un profil d\'entité (Wikidata, LinkedIn, ORCID, /author/…) — utilisez une URL sameAs vérifiable.',
    aiAuthorEntityTip: 'Liez l\'auteur à une entité non ambiguë (Wikidata, LinkedIn, ORCID, Crunchbase ou une page auteur dédiée) : c\'est le signal n°1 pour être cité par les moteurs IA.',
    aiEvidenceLabel: 'Preuves originales + sources (AI-readiness)',
    aiEvidencePass: 'Le contenu combine données originales/chiffrées ET sources externes citées — profil idéal pour être cité par les IA.',
    aiEvidenceFail: 'Combinez des données originales (chiffres, résultats) ET des sources externes citées — la combinaison est le signal le plus « citable » par les IA.',
    aiEvidenceTip: 'Les moteurs IA citent en priorité un contenu qui apporte des données de première main appuyées par des sources vérifiables.',
    datesLabel: 'Dates de publication / mise à jour',
    datesPass: 'Dates de publication et de mise à jour disponibles — bon pour la fraîcheur et la confiance.',
    datesFail: 'Date de publication ou de mise à jour manquante — exposez datePublished et dateModified.',
    sourcesLabel: 'Sources externes citées',
    sourcesPass: (n: number) => `${n} lien(s) vers des sources externes — renforce la crédibilité et l\'E-E-A-T.`,
    sourcesFail: 'Aucune source externe citée — liez des sources fiables pour appuyer vos affirmations.',
    sourcesTip: 'Citez des études, données officielles ou références sectorielles avec des liens sortants.',
    dataLabel: 'Données originales / chiffrées',
    dataPass: 'Le contenu présente des données chiffrées — signal d\'expertise et de contenu original.',
    dataFail: 'Peu de données chiffrées détectées — ajoutez des chiffres, statistiques ou résultats concrets.',
    dataTip: 'Le contenu démontrant une expérience de première main (données, chiffres, exemples vécus) est le levier de montée n°1 en 2026.',
  },
  en: {
    authorLabel: 'Attributed author (E-E-A-T)',
    authorPass: 'An author is attributed — good E-E-A-T transparency signal.',
    authorFail: 'No identified author — attribute a real author to strengthen trust (E-E-A-T).',
    authorTip: 'Add an author with a short bio and a link to their profile (Person schema + sameAs).',
    authorEntityLabel: 'Author entity (profile / sameAs)',
    authorEntityPass: 'The author has a profile link — strengthens the entity (sameAs) for search and AI.',
    authorEntityFail: 'The author has no profile link — add a URL (LinkedIn, author page) as sameAs.',
    aiAuthorEntityLabel: 'Verifiable author entity (AI-readiness)',
    aiAuthorEntityPass: 'The author points to a recognized profile URL (sameAs) — a verifiable entity, the top lever for AI citations.',
    aiAuthorEntityFail: 'The author link does not look like an entity profile (Wikidata, LinkedIn, ORCID, /author/…) — use a verifiable sameAs URL.',
    aiAuthorEntityTip: 'Tie the author to an unambiguous entity (Wikidata, LinkedIn, ORCID, Crunchbase or a dedicated author page): it is the #1 signal for being cited by AI engines.',
    aiEvidenceLabel: 'Original evidence + sources (AI-readiness)',
    aiEvidencePass: 'The content combines original/quantitative data AND cited external sources — the ideal profile to be quoted by AI engines.',
    aiEvidenceFail: 'Combine original data (figures, results) AND cited external sources — the combination is the most "quote-worthy" signal for AI engines.',
    aiEvidenceTip: 'AI engines preferentially cite content that brings first-hand data backed by verifiable sources.',
    datesLabel: 'Published / updated dates',
    datesPass: 'Published and modified dates available — good for freshness and trust.',
    datesFail: 'Published or modified date missing — expose datePublished and dateModified.',
    sourcesLabel: 'External sources cited',
    sourcesPass: (n: number) => `${n} link(s) to external sources — strengthens credibility and E-E-A-T.`,
    sourcesFail: 'No external source cited — link reliable sources to back your claims.',
    sourcesTip: 'Cite studies, official data or industry references with outbound links.',
    dataLabel: 'Original / quantitative data',
    dataPass: 'The content includes quantitative data — a signal of expertise and original content.',
    dataFail: 'Little quantitative data detected — add figures, statistics or concrete results.',
    dataTip: 'First-hand-experience content (data, figures, lived examples) is the #1 visibility lever in 2026.',
  },
} as const

/** Page types where E-E-A-T author signals are not expected. */
const EEAT_SKIP_PAGE_TYPES = new Set(['legal', 'contact', 'form', 'home'])

/** Recognized entity / profile hosts that make an author URL a strong `sameAs` anchor. */
const PROFILE_HOST_RE =
  /(?:wikidata\.org|wikipedia\.org|linkedin\.com|crunchbase\.com|orcid\.org|github\.com|twitter\.com|x\.com|scholar\.google\.|researchgate\.net|muckrack\.com|about\.me|mastodon)/i

/** Path shapes that typically denote an author/profile page on a site. */
const PROFILE_PATH_RE = /\/(?:author|auteur|team|equipe|profile|profil|about|members?|users?|u|a)\//i

/**
 * Whether an author URL looks like a verifiable entity profile (a real `sameAs` anchor),
 * not just any link. Offline heuristic — recognized entity host OR a profile-shaped path.
 */
function looksLikeProfileUrl(url: string): boolean {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return false
  return PROFILE_HOST_RE.test(u) || PROFILE_PATH_RE.test(u)
}

export function checkEeat(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  // E-E-A-T is relevant for substantive content pages, not utility/legal pages.
  if (EEAT_SKIP_PAGE_TYPES.has(ctx.pageType) || ctx.wordCount < 100) return checks

  const s = STRINGS[ctx.locale] ?? STRINGS.fr

  // 1. Attributed author
  const hasAuthor = !!(input.author && input.author.trim())
  checks.push({
    id: 'eeat-author',
    label: s.authorLabel,
    status: hasAuthor ? 'pass' : 'warning',
    message: hasAuthor ? s.authorPass : s.authorFail,
    category: 'important',
    weight: 0,
    group: 'eeat',
    ...(hasAuthor ? {} : { tip: s.authorTip }),
  })

  // 2. Author entity link (sameAs) — only meaningful when an author exists
  if (hasAuthor) {
    const hasLink = !!(input.authorUrl && input.authorUrl.trim())
    checks.push({
      id: 'eeat-author-entity',
      label: s.authorEntityLabel,
      status: hasLink ? 'pass' : 'warning',
      message: hasLink ? s.authorEntityPass : s.authorEntityFail,
      category: 'bonus',
      weight: 0,
      group: 'eeat',
    })

    // 2b. AI-readiness: the author URL is a VERIFIABLE entity profile (sameAs-grade),
    // not just any link. Non-scoring (weight 0) — feeds the AI-citation indicator.
    const verifiableEntity = hasLink && looksLikeProfileUrl(input.authorUrl!)
    checks.push({
      id: 'eeat-ai-author-entity',
      label: s.aiAuthorEntityLabel,
      status: verifiableEntity ? 'pass' : 'warning',
      message: verifiableEntity ? s.aiAuthorEntityPass : s.aiAuthorEntityFail,
      category: 'bonus',
      weight: 0,
      group: 'eeat',
      ...(verifiableEntity ? {} : { tip: s.aiAuthorEntityTip }),
    })
  }

  // 3. Published + modified dates
  const datesOk = !!input.publishedAt && !!input.updatedAt
  checks.push({
    id: 'eeat-dates',
    label: s.datesLabel,
    status: datesOk ? 'pass' : 'warning',
    message: datesOk ? s.datesPass : s.datesFail,
    category: 'bonus',
    weight: 0,
    group: 'eeat',
  })

  // 4. External sources / citations
  const externalLinks = ctx.allLinks.filter((l) => /^https?:\/\//i.test(l.url))
  const hasSources = externalLinks.length > 0
  checks.push({
    id: 'eeat-sources',
    label: s.sourcesLabel,
    status: hasSources ? 'pass' : 'warning',
    message: hasSources ? s.sourcesPass(externalLinks.length) : s.sourcesFail,
    category: 'bonus',
    weight: 0,
    group: 'eeat',
    ...(hasSources ? {} : { tip: s.sourcesTip }),
  })

  // 5. Original / quantitative data (heuristic: percentages or several numbers)
  const hasPercent = /\d+([.,]\d+)?\s?%/.test(ctx.fullText)
  const numberCount = (ctx.fullText.match(/\b\d{2,}\b/g) || []).length
  const hasData = hasPercent || numberCount >= 3
  checks.push({
    id: 'eeat-original-data',
    label: s.dataLabel,
    status: hasData ? 'pass' : 'warning',
    message: hasData ? s.dataPass : s.dataFail,
    category: 'bonus',
    weight: 0,
    group: 'eeat',
    ...(hasData ? {} : { tip: s.dataTip }),
  })

  // 6. AI-readiness: original data BACKED BY cited sources. The combination — first-hand
  // figures + verifiable references — is the most "quote-worthy" signal for AI answer
  // engines. Non-scoring (weight 0); feeds the AI-citation indicator only.
  const aiEvidence = hasData && hasSources
  checks.push({
    id: 'eeat-ai-evidence',
    label: s.aiEvidenceLabel,
    status: aiEvidence ? 'pass' : 'warning',
    message: aiEvidence ? s.aiEvidencePass : s.aiEvidenceFail,
    category: 'bonus',
    weight: 0,
    group: 'eeat',
    ...(aiEvidence ? {} : { tip: s.aiEvidenceTip }),
  })

  return checks
}
