/**
 * SEO Rules — GEO / Generative Engine Optimization (SEO 2026).
 *
 * Signals that make content easy for generative engines (AI Overviews, ChatGPT,
 * Perplexity) to EXTRACT and CITE: a concise answer-first lead, question-style
 * headings, and extractable structures (lists, tables), well-chunked content.
 *
 * These are DIRECTIONAL hints, NOT ranking factors: every check is weight 0 (it does
 * not move the SEO score). They feed the separate AI-readiness indicator. Per the
 * analysis debate, we deliberately avoid hard numeric thresholds presented as targets.
 *
 * Translations are kept local to avoid bloating the central i18n file.
 */
import type { SeoCheck, SeoInput, AnalysisContext } from '../types.js'
import { extractListsFromLexical, countLongSections } from '../helpers.js'

const QUESTION_WORDS: Record<'fr' | 'en', readonly string[]> = {
  fr: ['comment', 'pourquoi', 'quand', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'ou', 'où', 'qui', 'que', 'quoi', 'est-ce'],
  en: ['how', 'why', 'when', 'what', 'which', 'where', 'who', 'can', 'do', 'does', 'is', 'are', 'should'],
}

/**
 * Definition-snippet detectors: a concise "<term> is/désigne …" sentence near the top
 * is the passage generative engines extract most readily. Kept deliberately specific
 * (copula + determiner, or explicit defining verbs) to avoid matching ordinary prose.
 */
const FR_DEFINITION = /\b(est|sont)\s+(un|une|le|la|les|des|du|l['’])\b|\b(désigne|désignent|consiste\s+à|correspond\s+à|se\s+définit|signifie|représente|s['’]agit)\b/i
const EN_DEFINITION = /\b(is|are)\s+(a|an|the)\b|\b(refers\s+to|means|is\s+defined\s+as|consists\s+of|stands\s+for)\b/i

/** A paragraph longer than this (words, between two headings) reads as a wall of text. */
const CHUNK_WALL_THRESHOLD = 200
/** Minimum items for a numbered list to count as a HowTo procedure. */
const HOWTO_MIN_STEPS = 3
/** Minimum question-style headings to count as an FAQ block. */
const FAQ_MIN_QUESTIONS = 2

const STRINGS = {
  fr: {
    answerLabel: 'Réponse en tête (answer-first)',
    answerPass: 'Le contenu démarre par une accroche concise — favorise l\'extraction par l\'IA.',
    answerFail: 'Le contenu ne démarre pas par une réponse concise — placez une réponse directe en tête de page/section.',
    answerTip: 'Format BLUF (Bottom Line Up Front) : répondez à l\'intention en 1-2 phrases avant de développer.',
    questionsLabel: 'Titres en question',
    questionsPass: (n: number) => `${n} sous-titre(s) formulé(s) en question — structure Q→R idéale pour l\'IA.`,
    questionsFail: 'Aucun titre en question — formulez certains H2/H3 en questions (les moteurs IA citent les paires question/réponse).',
    structureLabel: 'Contenu extractible (listes / tableaux)',
    structurePass: 'Listes ou tableaux détectés — unités facilement extraites et citées par l\'IA.',
    structureFail: 'Aucune liste ni tableau — structurez les énumérations et comparaisons en listes/tableaux.',
    chunkLabel: 'Contenu découpé (scannable)',
    chunkPass: 'Contenu bien découpé en sections — facilite l\'extraction de passages.',
    chunkFail: 'Contenu peu découpé — ajoutez des sous-titres pour créer des passages auto-suffisants.',
    faqLabel: 'Structure FAQ / HowTo (Q→R ou étapes)',
    faqPass: 'Structure FAQ/Q→R ou étapes (HowTo) détectée — formats repris verbatim par ChatGPT/Perplexity.',
    faqFail: 'Aucune structure FAQ ni HowTo — regroupez des paires question/réponse ou des étapes numérotées.',
    faqTip: 'Ajoutez une section FAQ (≥2 questions) ou une procédure en liste numérotée (HowTo) — les moteurs IA les extraient mot pour mot.',
    defLabel: 'Définition extractible en tête',
    defPass: 'Phrase de définition concise en tête — facilite l\'extraction d\'un snippet par l\'IA.',
    defFail: 'Aucune définition concise en tête — ajoutez une phrase « X est / désigne … » près du début.',
    defTip: 'Donnez une définition directe en une phrase (« Le SEO est … ») dans les premières lignes : c\'est le passage que l\'IA cite le plus.',
    chunkDensLabel: 'Paragraphes courts autonomes',
    chunkDensPass: 'Paragraphes courts et autonomes — chaque passage s\'extrait isolément.',
    chunkDensFail: 'Certains passages sont des pavés longs — découpez-les en paragraphes courts auto-suffisants.',
    chunkDensTip: 'Visez des paragraphes auto-suffisants (une idée par paragraphe) : l\'IA cite des passages isolés, pas des murs de texte.',
  },
  en: {
    answerLabel: 'Answer-first lead',
    answerPass: 'Content opens with a concise lead — helps AI extraction.',
    answerFail: 'Content does not open with a concise answer — put a direct answer at the top of the page/section.',
    answerTip: 'BLUF (Bottom Line Up Front): answer the intent in 1-2 sentences before expanding.',
    questionsLabel: 'Question-style headings',
    questionsPass: (n: number) => `${n} heading(s) phrased as questions — ideal Q→A structure for AI.`,
    questionsFail: 'No question headings — phrase some H2/H3 as questions (AI engines cite question/answer pairs).',
    structureLabel: 'Extractable content (lists / tables)',
    structurePass: 'Lists or tables detected — units easily extracted and cited by AI.',
    structureFail: 'No list or table — structure enumerations and comparisons as lists/tables.',
    chunkLabel: 'Chunked content (scannable)',
    chunkPass: 'Content is well chunked into sections — helps passage extraction.',
    chunkFail: 'Content is barely chunked — add subheadings to create self-contained passages.',
    faqLabel: 'FAQ / HowTo structure (Q→A or steps)',
    faqPass: 'FAQ/Q→A or HowTo steps detected — formats quoted verbatim by ChatGPT/Perplexity.',
    faqFail: 'No FAQ or HowTo structure — group question/answer pairs or numbered steps.',
    faqTip: 'Add an FAQ section (≥2 questions) or a numbered HowTo procedure — AI engines extract them word for word.',
    defLabel: 'Extractable definition up top',
    defPass: 'Concise definition sentence up top — helps the AI extract a snippet.',
    defFail: 'No concise definition up top — add an "X is / refers to …" sentence near the start.',
    defTip: 'Give a one-sentence direct definition ("SEO is …") in the first lines: it is the passage AI cites most.',
    chunkDensLabel: 'Short self-contained paragraphs',
    chunkDensPass: 'Short, self-contained paragraphs — each passage extracts on its own.',
    chunkDensFail: 'Some passages are long walls of text — split them into short self-contained paragraphs.',
    chunkDensTip: 'Aim for self-contained paragraphs (one idea each): AI cites isolated passages, not walls of text.',
  },
} as const

const GEO_SKIP_PAGE_TYPES = new Set(['legal', 'contact', 'form', 'home'])

function isQuestionHeading(text: string, locale: 'fr' | 'en'): boolean {
  const t = text.trim().toLowerCase()
  if (t.endsWith('?')) return true
  const words = QUESTION_WORDS[locale] ?? QUESTION_WORDS.fr
  return words.some((w) => t.startsWith(w + ' ') || t.startsWith(w + '-'))
}

/** Gather Lexical roots from all input sources (hero, content, blocks, columns). */
function collectLexicalSources(input: SeoInput): unknown[] {
  const sources: unknown[] = []
  if (input.heroRichText) sources.push(input.heroRichText)
  if (input.content) sources.push(input.content)
  if (Array.isArray(input.blocks)) {
    for (const b of input.blocks) {
      if (!b || typeof b !== 'object') continue
      const blk = b as Record<string, unknown>
      if (blk.richText) sources.push(blk.richText)
      if (Array.isArray(blk.columns)) {
        for (const c of blk.columns) {
          if (c && typeof c === 'object' && (c as Record<string, unknown>).richText) {
            sources.push((c as Record<string, unknown>).richText)
          }
        }
      }
    }
  }
  return sources
}

/** Recursively check whether a Lexical tree contains a node of the given type. */
function containsLexicalType(node: unknown, type: string, depth = 0): boolean {
  if (depth > 50 || !node || typeof node !== 'object') return false
  const n = node as Record<string, unknown>
  if (n.type === type) return true
  const root = (n.root as Record<string, unknown>) || n
  const children = (root.children as unknown[]) || (n.children as unknown[])
  if (Array.isArray(children)) {
    for (const c of children) {
      if (containsLexicalType(c, type, depth + 1)) return true
    }
  }
  return false
}

export function checkGeo(input: SeoInput, ctx: AnalysisContext): SeoCheck[] {
  const checks: SeoCheck[] = []

  if (GEO_SKIP_PAGE_TYPES.has(ctx.pageType) || ctx.wordCount < 150) return checks

  const s = STRINGS[ctx.locale] ?? STRINGS.fr
  const locale = ctx.locale

  // 1. Answer-first lead — heuristic: the first sentence is concise (BLUF).
  const firstSentence = (ctx.sentences[0] || '').trim()
  const firstSentenceWords = firstSentence ? firstSentence.split(/\s+/).length : 0
  const answerFirst = firstSentenceWords > 0 && firstSentenceWords <= 30
  checks.push({
    id: 'geo-answer-first',
    label: s.answerLabel,
    status: answerFirst ? 'pass' : 'warning',
    message: answerFirst ? s.answerPass : s.answerFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
    ...(answerFirst ? {} : { tip: s.answerTip }),
  })

  // 2. Question-style headings (Q→A structure is highly citable)
  const questionHeadings = ctx.allHeadings.filter(
    (h) => h.tag !== 'h1' && isQuestionHeading(h.text, locale),
  ).length
  checks.push({
    id: 'geo-question-headings',
    label: s.questionsLabel,
    status: questionHeadings > 0 ? 'pass' : 'warning',
    message: questionHeadings > 0 ? s.questionsPass(questionHeadings) : s.questionsFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
  })

  // 3. Extractable structures — lists or tables
  const sources = collectLexicalSources(input)
  const allLists = sources.flatMap((src) => extractListsFromLexical(src))
  const hasList = allLists.length > 0
  const hasTable = sources.some((src) => containsLexicalType(src, 'table'))
  const structured = hasList || hasTable
  checks.push({
    id: 'geo-extractable-structure',
    label: s.structureLabel,
    status: structured ? 'pass' : 'warning',
    message: structured ? s.structurePass : s.structureFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
  })

  // 4. Chunked content — roughly one subheading per ~300 words
  const subheadings = ctx.allHeadings.filter((h) => h.tag !== 'h1').length
  const expected = Math.max(1, Math.floor(ctx.wordCount / 300))
  const chunked = subheadings >= expected
  checks.push({
    id: 'geo-chunked',
    label: s.chunkLabel,
    status: chunked ? 'pass' : 'warning',
    message: chunked ? s.chunkPass : s.chunkFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
  })

  // 5. FAQ / HowTo structure — Q→A pairs (≥2 question headings) or a numbered
  //    procedure. AI engines (ChatGPT, Perplexity) lift these formats verbatim.
  const isFaq = questionHeadings >= FAQ_MIN_QUESTIONS
  const hasHowToSteps = allLists.some((l) => l.listType === 'number' && l.items >= HOWTO_MIN_STEPS)
  const faqOrHowTo = isFaq || hasHowToSteps
  checks.push({
    id: 'geo-faq-howto',
    label: s.faqLabel,
    status: faqOrHowTo ? 'pass' : 'warning',
    message: faqOrHowTo ? s.faqPass : s.faqFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
    ...(faqOrHowTo ? {} : { tip: s.faqTip }),
  })

  // 6. Definition snippet — a concise "X is / désigne …" sentence near the top is
  //    the passage generative engines most readily extract and cite.
  const definitionRe = locale === 'en' ? EN_DEFINITION : FR_DEFINITION
  const hasDefinition = ctx.sentences.slice(0, 3).some((sentence) => {
    const sen = sentence.trim()
    const words = sen ? sen.split(/\s+/).length : 0
    return words > 0 && words <= 35 && definitionRe.test(sen)
  })
  checks.push({
    id: 'geo-definition',
    label: s.defLabel,
    status: hasDefinition ? 'pass' : 'warning',
    message: hasDefinition ? s.defPass : s.defFail,
    category: 'bonus',
    weight: 0,
    group: 'geo',
    ...(hasDefinition ? {} : { tip: s.defTip }),
  })

  // 7. Extractable chunks — short, self-contained paragraphs (no walls of text).
  //    Only evaluated when there is paragraph-level structure to inspect.
  if (sources.length > 0) {
    const longSections = sources.reduce<number>(
      (sum, src) => sum + countLongSections(src, CHUNK_WALL_THRESHOLD),
      0,
    )
    const extractableChunks = longSections === 0
    checks.push({
      id: 'geo-extractable-chunks',
      label: s.chunkDensLabel,
      status: extractableChunks ? 'pass' : 'warning',
      message: extractableChunks ? s.chunkDensPass : s.chunkDensFail,
      category: 'bonus',
      weight: 0,
      group: 'geo',
      ...(extractableChunks ? {} : { tip: s.chunkDensTip }),
    })
  }

  return checks
}
