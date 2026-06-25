/**
 * AI content brief (SEO 2026) — RankMath Content AI / Surfer-lite.
 *
 *   POST /ai-content-brief → { keyword, collection?, id?, locale? }
 *
 * Produces a structured writing brief for a target keyword: a heading outline (H2/H3),
 * entities/terms to cover, questions to answer (PAA-style), a recommended word count and
 * internal-link ideas. When collection+id are provided, the current page content is used as
 * context so the brief complements (not duplicates) what already exists.
 *
 * Gated behind `features.aiFeatures`. Key from ANTHROPIC_API_KEY (server only), model from
 * SEO_AI_MODEL (default claude-opus-4-8). No heuristic fallback — a brief needs the model.
 */
import type { PayloadHandler } from 'payload'
import type { SeoConfig } from '../types.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { fetchWithRetry } from '../helpers/fetchWithRetry.js'
import { extractDocContent } from '../helpers/extractDocContent.js'

// Default to Sonnet (quality/cost balance); set SEO_AI_MODEL=claude-opus-4-8 for max quality.
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export interface ContentBrief {
  outline: Array<{ level: 'h2' | 'h3'; text: string }>
  entities: string[]
  questions: string[]
  internalLinkIdeas: string[]
  recommendedWordCount: number
  notes: string[]
}

const trimList = (arr: unknown, max: number, itemMax = 160): string[] =>
  Array.isArray(arr)
    ? arr
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, max)
        .map((x) => (x.length > itemMax ? `${x.slice(0, itemMax - 1)}…` : x))
    : []

/** Defensively parse the model's JSON brief (tolerate code fences / surrounding prose). */
export function parseBrief(raw: string): ContentBrief | null {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  if (!s.startsWith('{')) {
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    s = s.slice(start, end + 1)
  }
  try {
    const p = JSON.parse(s) as Record<string, unknown>
    return sanitizeBrief({
      outline: Array.isArray(p.outline)
        ? (p.outline as unknown[]).map((o) => {
            const r = (o || {}) as Record<string, unknown>
            return { level: r.level === 'h3' ? 'h3' : 'h2', text: typeof r.text === 'string' ? r.text : '' }
          })
        : [],
      entities: trimList(p.entities, 30),
      questions: trimList(p.questions, 15),
      internalLinkIdeas: trimList(p.internalLinkIdeas, 10),
      recommendedWordCount: typeof p.recommendedWordCount === 'number' ? p.recommendedWordCount : 0,
      notes: trimList(p.notes, 6),
    })
  } catch {
    return null
  }
}

export function sanitizeBrief(b: ContentBrief): ContentBrief {
  return {
    outline: b.outline
      .filter((o) => o.text && o.text.trim())
      .slice(0, 25)
      .map((o) => ({ level: o.level === 'h3' ? 'h3' : 'h2', text: o.text.trim().slice(0, 160) })),
    entities: trimList(b.entities, 30),
    questions: trimList(b.questions, 15),
    internalLinkIdeas: trimList(b.internalLinkIdeas, 10),
    recommendedWordCount: Math.min(10000, Math.max(0, Math.round(b.recommendedWordCount || 0))),
    notes: trimList(b.notes, 6),
  }
}

async function callClaudeBrief(
  apiKey: string,
  model: string,
  language: string,
  params: { keyword: string; pageTitle?: string; existingContent?: string },
): Promise<ContentBrief | null> {
  const systemPrompt = `You are an SEO content strategist applying June 2026 best practices.
Produce a concise WRITING BRIEF for the target keyword so a writer can create a page that ranks AND is citable by AI engines.
Rules:
- Base the brief on genuine search intent for the keyword; cover entities and questions a complete page must address.
- Be specific and non-generic; no filler. Write in ${language === 'en' ? 'English' : 'French'}.
- Do not invent facts, brands, prices or statistics.
Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{"outline":[{"level":"h2"|"h3","text":string}],"entities":[string],"questions":[string],"internalLinkIdeas":[string],"recommendedWordCount":number,"notes":[string]}
- outline: 5-12 headings (logical H2/H3 structure).
- entities: 8-20 key terms/concepts to mention.
- questions: 4-10 questions the page should answer (People-Also-Ask style).
- internalLinkIdeas: 3-8 topics worth linking to internally.
- notes: up to 4 short strategic tips.`

  const userPrompt = `Target keyword: ${params.keyword}
${params.pageTitle ? `Existing page title: ${params.pageTitle}` : ''}
${params.existingContent ? `Existing content (first 2000 chars, complement it — don't repeat):\n${params.existingContent.substring(0, 2000)}` : ''}

Return the JSON brief now:`

  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error ${response.status}: ${body}`)
  }
  const data = (await response.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> }
  if (data.stop_reason === 'refusal') return null
  const text = (data.content?.find((b) => b.type === 'text')?.text || '').trim()
  if (!text) return null
  return parseBrief(text)
}

export function createAiContentBriefHandler(
  targetCollections?: string[],
  seoConfig?: SeoConfig,
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

      const body = await parseJsonBody(req)
      const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : ''
      if (!keyword) return Response.json({ error: 'Missing required field: keyword' }, { status: 400 })

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return Response.json(
          { error: 'AI not configured. Set ANTHROPIC_API_KEY to generate a content brief.', code: 'no_api_key' },
          { status: 400 },
        )
      }

      // Optional page context
      let pageTitle: string | undefined
      let existingContent: string | undefined
      const collection = typeof body.collection === 'string' ? body.collection : undefined
      const id = body.id != null ? String(body.id) : undefined
      if (collection && id && (!targetCollections || targetCollections.includes(collection))) {
        try {
          const doc = (await req.payload.findByID({ collection, id, depth: 1, overrideAccess: true })) as Record<string, unknown>
          pageTitle = (doc.title as string) || undefined
          existingContent = extractDocContent(doc).text || undefined
        } catch {
          // ignore — brief without page context
        }
      }

      const model = process.env.SEO_AI_MODEL || DEFAULT_MODEL
      const language = seoConfig?.locale === 'en' ? 'en' : 'fr'

      let brief: ContentBrief | null
      try {
        brief = await callClaudeBrief(apiKey, model, language, { keyword, pageTitle, existingContent })
      } catch (e) {
        req.payload.logger.error(`[seo] ai-content-brief Claude error: ${e instanceof Error ? e.message : 'unknown'}`)
        return Response.json({ error: 'Content brief generation failed.' }, { status: 502 })
      }
      if (!brief) return Response.json({ error: 'The model did not return a brief (possibly declined).' }, { status: 502 })

      return Response.json({ keyword, brief, model })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-content-brief error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
