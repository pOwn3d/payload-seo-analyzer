/**
 * AI SEO Optimize endpoint.
 *
 * One-click "scan → propose" flow:
 *  1. Runs the real SEO engine (analyzeSeo) on a page/post to detect failing/warning checks.
 *  2. Sends the content + detected issues to Claude (Anthropic API), instructing it to apply
 *     the SAME SEO 2026 rules the engine enforces, and to return STRUCTURED suggestions
 *     (meta title, meta description, optional focus keyword + a short rationale).
 *  3. Validates/clamps the suggestions SERVER-SIDE before returning, so whatever the UI
 *     applies is guaranteed rule-compliant (lengths, trimming) — the "respect SEO rules"
 *     guarantee does not rely on the LLM behaving.
 *
 * Scope is intentionally limited to META fields (title/description/focus keyword): the SEO
 * 2026 analysis flags mass AI-generated BODY content as a spam/penalty risk, so this endpoint
 * never rewrites page content.
 *
 * The Claude API key is read ONLY from the ANTHROPIC_API_KEY environment variable (never from
 * the client request). Without a key, the endpoint falls back to the heuristic generators, so
 * the feature degrades gracefully.
 *
 * Model: defaults to `claude-opus-4-8` (highest quality), overridable via SEO_AI_MODEL.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application should
 * implement rate limiting via its own middleware. Calls to the Anthropic API are billed to
 * the host's own API key.
 */

import type { Payload, PayloadHandler } from 'payload'
import { analyzeSeo } from '../index.js'
import { buildSeoInputFromDoc } from './validate.js'
import { loadMergedConfig } from '../helpers/loadMergedConfig.js'
import { parseJsonBody } from '../helpers/parseBody.js'
import { fetchWithRetry } from '../helpers/fetchWithRetry.js'
import { extractDocContent } from '../helpers/extractDocContent.js'
import {
  truncateWords,
  generateMetaTitle as heuristicTitle,
  generateMetaDescription as heuristicDescription,
} from '../helpers/metaGeneration.js'
import type { SeoConfig } from '../types.js'

// Default to Sonnet (quality/cost balance); set SEO_AI_MODEL=claude-opus-4-8 for max quality.
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// Server-side rule bounds — match the SEO engine's expectations so applied values are compliant.
const TITLE_HARD_MAX = 70
const DESC_HARD_MAX = 160
const KEYWORD_MAX = 60
const RATIONALE_MAX_ITEMS = 4
const RATIONALE_ITEM_MAX = 200

interface AiSuggestions {
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  rationale: string[]
}

// ---------------------------------------------------------------------------
// Claude API call — returns parsed, UNVALIDATED suggestions (validated by caller)
// ---------------------------------------------------------------------------

async function callClaudeOptimize(
  apiKey: string,
  model: string,
  params: {
    pageTitle: string
    slug: string
    focusKeyword: string
    currentMetaTitle: string
    currentMetaDescription: string
    issues: Array<{ label: string; message: string }>
    content: string
  },
): Promise<AiSuggestions | null> {
  const systemPrompt = `You are an SEO expert applying June 2026 best practices. You optimize ONLY a page's meta title and meta description (and may suggest a focus keyword). You NEVER rewrite body content.
Strict rules (these mirror the site's own SEO engine — follow them exactly):
- Meta title: natural and compelling, hard limit ${TITLE_HARD_MAX} characters, front-load the important words, do NOT keyword-stuff or repeat the brand/keyword.
- Meta description: 120-160 characters, one or two sentences, action-oriented, includes the focus keyword ONCE and naturally. No keyword stuffing.
- Write in the SAME language as the page content.
- Base everything on the ACTUAL content; never invent facts, prices, numbers, or claims not present in the content.
- If the focus keyword is missing, you MAY suggest one short keyword (2-4 words) matching the content's main topic; otherwise keep the existing one.
Return ONLY a JSON object (no markdown, no prose, no code fences) with EXACTLY this shape:
{"metaTitle": string, "metaDescription": string, "focusKeyword": string, "rationale": string[]}
"rationale": 2-4 short strings, in the page's language, explaining what you improved and why, referencing the detected issues.`

  const issuesText = params.issues.length
    ? params.issues.map((i) => `- ${i.label}: ${i.message}`).join('\n')
    : '- (no blocking issues — focus on making the meta tags more compelling and accurate)'

  const userPrompt = `Page title: ${params.pageTitle || '(none)'}
Slug: ${params.slug || '(none)'}
Current focus keyword: ${params.focusKeyword || '(none)'}
Current meta title: ${params.currentMetaTitle || '(empty)'}
Current meta description: ${params.currentMetaDescription || '(empty)'}

SEO issues detected by the engine (fix these):
${issuesText}

Page content (first 3000 chars):
${params.content.substring(0, 3000)}

Return the optimized JSON now:`

  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    stop_reason?: string
    content?: Array<{ type: string; text?: string }>
  }

  // Safety classifier declined — let the caller fall back to the heuristic generators.
  if (data.stop_reason === 'refusal') {
    return null
  }

  // Find the text block (robust whether or not thinking blocks are present).
  const text = (data.content?.find((b) => b.type === 'text')?.text || '').trim()
  if (!text) return null

  return parseSuggestions(text)
}

/** Defensively parse the model's JSON (strip accidental code fences, tolerate extra prose). */
export function parseSuggestions(raw: string): AiSuggestions | null {
  let s = raw.trim()
  // Strip markdown code fences if the model added them despite instructions.
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  // If there is surrounding prose, isolate the first {...} block.
  if (!s.startsWith('{')) {
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    s = s.slice(start, end + 1)
  }
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>
    return {
      metaTitle: typeof parsed.metaTitle === 'string' ? parsed.metaTitle : '',
      metaDescription: typeof parsed.metaDescription === 'string' ? parsed.metaDescription : '',
      focusKeyword: typeof parsed.focusKeyword === 'string' ? parsed.focusKeyword : '',
      rationale: Array.isArray(parsed.rationale)
        ? parsed.rationale.filter((r): r is string => typeof r === 'string')
        : [],
    }
  } catch {
    return null
  }
}

/**
 * Validate + clamp suggestions to the SEO rules. This is the guarantee that whatever the UI
 * applies is compliant, independent of the LLM. `currentFocusKeyword` is preserved when the
 * model didn't need to suggest a new one (we only fill an EMPTY focus keyword).
 */
export function sanitizeSuggestions(s: AiSuggestions, currentFocusKeyword: string): AiSuggestions {
  const metaTitle = truncateWords(s.metaTitle.trim(), TITLE_HARD_MAX)
  const metaDescription = truncateWords(s.metaDescription.trim(), DESC_HARD_MAX)

  // Only ever fill an empty focus keyword — never overwrite an editor's existing choice.
  let focusKeyword = currentFocusKeyword
  if (!currentFocusKeyword.trim()) {
    const suggested = s.focusKeyword.trim()
    if (suggested && suggested.length <= KEYWORD_MAX) {
      focusKeyword = suggested
    }
  }

  const rationale = s.rationale
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, RATIONALE_MAX_ITEMS)
    .map((r) => (r.length > RATIONALE_ITEM_MAX ? `${r.slice(0, RATIONALE_ITEM_MAX - 1)}…` : r))

  return { metaTitle, metaDescription, focusKeyword, rationale }
}

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

export interface OptimizeMetaResult {
  ok: boolean
  error?: string
  status?: number
  title?: string
  method?: 'ai' | 'heuristic'
  model?: string
  score?: number
  current?: { metaTitle: string; metaDescription: string; focusKeyword: string }
  suggestions?: AiSuggestions
  issues?: Array<{ label: string; message: string }>
}

/**
 * Core "scan → propose (meta)" for one document, reusable by the single endpoint and the bulk
 * pipeline. Pure server logic — no auth/HTTP. The caller pre-loads `mergedConfig` (once for a
 * whole batch). Suggestions are already sanitized/clamped to the SEO rules.
 */
export async function optimizeDocMeta(
  payload: Payload,
  opts: { collection: string; id: string; mergedConfig: SeoConfig; apiKey?: string; model?: string },
): Promise<OptimizeMetaResult> {
  const { collection, id, mergedConfig } = opts

  let doc: Record<string, unknown>
  try {
    doc = (await payload.findByID({ collection, id, depth: 1, overrideAccess: true })) as Record<string, unknown>
  } catch {
    return { ok: false, error: `Document not found: ${collection}/${id}`, status: 404 }
  }

  // 1. SCAN
  const seoInput = buildSeoInputFromDoc(doc, collection)
  const analysis = analyzeSeo(seoInput, mergedConfig)
  const metaGroups = new Set(['title', 'meta-description', 'content', 'url', 'headings'])
  const issues = analysis.checks
    .filter((c) => (c.status === 'fail' || c.status === 'warning') && metaGroups.has(c.group))
    .map((c) => ({ label: c.label, message: c.message }))
    .slice(0, 12)

  const pageTitle = (doc.title as string) || ''
  const slug = (doc.slug as string) || ''
  const currentFocusKeyword = (doc.focusKeyword as string) || ''
  const currentMetaTitle = seoInput.metaTitle || ''
  const currentMetaDescription = seoInput.metaDescription || ''
  const content = extractDocContent(doc).text

  // 2. PROPOSE — Claude if configured, else heuristic fallback
  const apiKey = opts.apiKey
  const model = opts.model || DEFAULT_MODEL

  let suggestions: AiSuggestions
  let method: 'ai' | 'heuristic'
  const heuristicFallback = (): AiSuggestions => ({
    metaTitle: heuristicTitle(pageTitle, currentFocusKeyword, slug),
    metaDescription: heuristicDescription(content, currentFocusKeyword, slug),
    focusKeyword: currentFocusKeyword,
    rationale: [],
  })

  if (apiKey) {
    try {
      const aiResult = await callClaudeOptimize(apiKey, model, {
        pageTitle,
        slug,
        focusKeyword: currentFocusKeyword,
        currentMetaTitle,
        currentMetaDescription,
        issues,
        content,
      })
      if (aiResult) {
        suggestions = aiResult
        method = 'ai'
      } else {
        suggestions = heuristicFallback()
        method = 'heuristic'
      }
    } catch (error) {
      payload.logger.error(`[seo] ai-optimize Claude API error: ${error instanceof Error ? error.message : 'unknown'}`)
      suggestions = heuristicFallback()
      method = 'heuristic'
    }
  } else {
    suggestions = heuristicFallback()
    method = 'heuristic'
  }

  // 3. VALIDATE/CLAMP server-side — guarantees applied values respect the rules
  const sanitized = sanitizeSuggestions(suggestions, currentFocusKeyword)

  return {
    ok: true,
    title: pageTitle,
    method,
    ...(method === 'ai' ? { model } : {}),
    score: analysis.score,
    current: {
      metaTitle: currentMetaTitle,
      metaDescription: currentMetaDescription,
      focusKeyword: currentFocusKeyword,
    },
    suggestions: sanitized,
    issues,
  }
}

export function createAiOptimizeHandler(
  targetCollections?: string[],
  seoConfig?: SeoConfig,
  localeMapping?: Record<string, 'fr' | 'en'>,
): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await parseJsonBody(req)
      const collection = typeof body.collection === 'string' ? body.collection.trim() : undefined
      const id =
        typeof body.id === 'string' || typeof body.id === 'number' ? String(body.id).trim() : undefined

      if (!collection || !id) {
        return Response.json({ error: 'Missing required fields: collection, id' }, { status: 400 })
      }

      if (targetCollections && !targetCollections.includes(collection)) {
        return Response.json({ error: 'Collection not allowed' }, { status: 403 })
      }

      const { config: mergedConfig } = await loadMergedConfig(req.payload, seoConfig, {
        reqLocale: req.locale as string | undefined,
        localeMapping,
      })

      const r = await optimizeDocMeta(req.payload, {
        collection,
        id,
        mergedConfig,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.SEO_AI_MODEL,
      })

      if (!r.ok) {
        return Response.json({ error: r.error }, { status: r.status || 500 })
      }

      return Response.json({
        method: r.method,
        ...(r.method === 'ai' ? { model: r.model } : {}),
        score: r.score,
        current: r.current,
        suggestions: r.suggestions,
        issues: r.issues,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[seo] ai-optimize error: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
