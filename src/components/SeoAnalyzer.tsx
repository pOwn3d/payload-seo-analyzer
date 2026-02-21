'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAllFormFields } from '@payloadcms/ui'
import {
  analyzeSeo,
  extractTextFromLexical,
  type SeoAnalysis,
  type SeoCheck,
  type CheckCategory,
  type RuleGroup,
} from '../index.js'
import { SeoSocialPreview } from './SeoSocialPreview.js'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT, type DashboardTranslations } from '../dashboard-i18n.js'

// ---------------------------------------------------------------------------
// Color palette (neubrutalist — matches custom.scss)
// ---------------------------------------------------------------------------
const C = {
  cyan: '#00E5FF',
  yellow: '#FFD600',
  orange: '#FF8A00',
  black: '#000',
  white: '#fff',
  green: '#22c55e',
  red: '#ef4444',
  bg: '#fafafa',
  textPrimary: 'var(--theme-text, #1a1a1a)',
  textSecondary: 'var(--theme-elevation-600, #6b7280)',
  border: 'var(--theme-border-color, #000)',
  inputBg: 'var(--theme-input-bg, #fff)',
  surfaceBg: 'var(--theme-elevation-0, #fff)',
  surface50: 'var(--theme-elevation-50, #f9fafb)',
}

// ---------------------------------------------------------------------------
// Styles (inline — neubrutalist)
// ---------------------------------------------------------------------------
const styles = {
  wrapper: {
    fontFamily: 'var(--font-body, Inter, system-ui, sans-serif)',
  } as React.CSSProperties,

  scoreRing: (_color: string) =>
    ({
      position: 'relative',
      width: 90,
      height: 90,
      borderRadius: '50%',
      border: `3px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: C.surfaceBg,
      boxShadow: '3px 3px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
      flexShrink: 0,
    }) as React.CSSProperties,

  scoreNumber: {
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1,
  } as React.CSSProperties,

  scoreLabel: {
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginTop: 2,
  } as React.CSSProperties,

  levelBadge: (bg: string, color: string) =>
    ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 800,
      backgroundColor: bg,
      color,
      border: `2px solid ${C.border}`,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
    }) as React.CSSProperties,

  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    cursor: 'pointer',
    borderRadius: 8,
    border: `2px solid ${C.border}`,
    fontWeight: 800,
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    transition: 'background-color 0.15s',
    userSelect: 'none' as const,
    marginBottom: 6,
  } as React.CSSProperties,

  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    cursor: 'pointer',
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    userSelect: 'none' as const,
    marginBottom: 4,
    marginTop: 4,
    backgroundColor: 'var(--theme-elevation-50, #f9fafb)',
    border: '1px solid var(--theme-elevation-200, #e5e7eb)',
  } as React.CSSProperties,

  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 4,
  } as React.CSSProperties,

  statusIcon: {
    flexShrink: 0,
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    fontWeight: 900,
    fontSize: 11,
  } as React.CSSProperties,
}

// ---------------------------------------------------------------------------
// Group labels (i18n)
// ---------------------------------------------------------------------------
function getGroupLabels(t: DashboardTranslations): Record<RuleGroup, string> {
  return {
    'title': t.seoAnalyzer.groupTitle,
    'meta-description': t.seoAnalyzer.groupDescription,
    'url': t.seoAnalyzer.groupUrlSlug,
    'headings': t.seoAnalyzer.groupHeadings,
    'content': t.seoAnalyzer.groupContent,
    'images': t.seoAnalyzer.groupImages,
    'linking': t.seoAnalyzer.groupLinks,
    'social': t.seoAnalyzer.groupSocial,
    'schema': t.seoAnalyzer.groupStructuredData,
    'readability': t.seoAnalyzer.groupReadability,
    'quality': t.seoAnalyzer.groupQuality,
    'secondary-keywords': t.seoAnalyzer.groupSecondaryKeywords,
    'cornerstone': t.seoAnalyzer.groupCornerstone,
    'freshness': t.seoAnalyzer.groupFreshness,
    'technical': t.seoAnalyzer.groupTechnical,
    'accessibility': t.seoAnalyzer.groupAccessibility,
    'ecommerce': t.seoAnalyzer.groupEcommerce,
  }
}

// Ordered display of groups within each category
const GROUP_ORDER: RuleGroup[] = [
  'title',
  'meta-description',
  'quality',
  'content',
  'url',
  'headings',
  'readability',
  'images',
  'linking',
  'social',
  'schema',
  'secondary-keywords',
  'cornerstone',
  'freshness',
  'technical',
  'accessibility',
  'ecommerce',
]

// ---------------------------------------------------------------------------
// Score level helpers
// ---------------------------------------------------------------------------
function getLevelColor(level: SeoAnalysis['level']): string {
  switch (level) {
    case 'excellent':
      return C.green
    case 'good':
      return C.yellow
    case 'ok':
      return C.orange
    case 'poor':
      return C.red
    default:
      return C.red
  }
}

function getLevelLabel(level: SeoAnalysis['level'], t: DashboardTranslations): string {
  switch (level) {
    case 'excellent':
      return t.seoAnalyzer.levelExcellent
    case 'good':
      return t.seoAnalyzer.levelGood
    case 'ok':
      return t.seoAnalyzer.levelFair
    case 'poor':
      return t.seoAnalyzer.levelNeedsImprovement
    default:
      return ''
  }
}

function getCategoryLabel(cat: CheckCategory, t: DashboardTranslations): string {
  switch (cat) {
    case 'critical':
      return t.seoAnalyzer.categoryCritical
    case 'important':
      return t.seoAnalyzer.categoryImportant
    case 'bonus':
      return t.seoAnalyzer.categoryBonus
    default:
      return ''
  }
}

function getCategoryBg(cat: CheckCategory): string {
  switch (cat) {
    case 'critical':
      return 'rgba(239,68,68,0.08)'
    case 'important':
      return 'rgba(255,138,0,0.08)'
    case 'bonus':
      return 'rgba(0,229,255,0.08)'
    default:
      return 'transparent'
  }
}

function getStatusIcon(status: SeoCheck['status']): { symbol: string; bg: string; color: string } {
  switch (status) {
    case 'pass':
      return { symbol: '\u2713', bg: 'rgba(34,197,94,0.15)', color: '#16a34a' }
    case 'warning':
      return { symbol: '!', bg: 'rgba(255,138,0,0.15)', color: '#d97706' }
    case 'fail':
      return { symbol: '\u2717', bg: 'rgba(239,68,68,0.15)', color: '#dc2626' }
    default:
      return { symbol: '?', bg: '#eee', color: '#999' }
  }
}

// ---------------------------------------------------------------------------
// Group sub-section (within a category)
// ---------------------------------------------------------------------------
function GroupSubSection({
  group,
  checks,
  t,
}: {
  group: RuleGroup
  checks: SeoCheck[]
  t: DashboardTranslations
}) {
  const [open, setOpen] = useState(true)

  const passCount = checks.filter((c) => c.status === 'pass').length
  const failCount = checks.filter((c) => c.status === 'fail').length
  const total = checks.length

  // Summary icon for the group header
  const groupStatus = failCount > 0 ? 'fail' : passCount === total ? 'pass' : 'warning'
  const groupIcon = getStatusIcon(groupStatus)

  return (
    <div style={{ marginBottom: 2 }}>
      <div onClick={() => setOpen(!open)} style={styles.groupHeader}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textPrimary }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 900,
              backgroundColor: groupIcon.bg,
              color: groupIcon.color,
            }}
          >
            {groupIcon.symbol}
          </span>
          {getGroupLabels(t)[group] || group}
          <span
            style={{
              fontWeight: 600,
              fontSize: 10,
              color: C.textSecondary,
              textTransform: 'none' as const,
            }}
          >
            {passCount}/{total}
          </span>
        </span>
        <span
          style={{
            fontSize: 10,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            color: C.textSecondary,
          }}
        >
          {'\u25B6'}
        </span>
      </div>

      {open && (
        <div style={{ paddingLeft: 8 }}>
          {checks.map((check) => {
            const icon = getStatusIcon(check.status)
            return (
              <div
                key={check.id}
                style={{
                  ...styles.checkItem,
                  backgroundColor:
                    check.status === 'fail'
                      ? 'rgba(239,68,68,0.05)'
                      : check.status === 'warning'
                        ? 'rgba(255,138,0,0.05)'
                        : 'transparent',
                }}
              >
                <span
                  style={{
                    ...styles.statusIcon,
                    backgroundColor: icon.bg,
                    color: icon.color,
                  }}
                >
                  {icon.symbol}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      marginBottom: 2,
                      color: C.textPrimary,
                    }}
                  >
                    {check.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    {check.message}
                  </div>
                  {check.tip && check.status !== 'pass' && (
                    <div
                      style={{
                        fontSize: 10,
                        color: C.textSecondary,
                        lineHeight: 1.4,
                        marginTop: 4,
                        paddingLeft: 8,
                        borderLeft: '2px solid var(--theme-elevation-200, #e5e7eb)',
                        fontStyle: 'italic',
                      }}
                    >
                      {check.tip}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category accordion (with sub-groups)
// ---------------------------------------------------------------------------
function CategorySection({
  category,
  checks,
  defaultOpen,
  t,
}: {
  category: CheckCategory
  checks: SeoCheck[]
  defaultOpen: boolean
  t: DashboardTranslations
}) {
  const [open, setOpen] = useState(defaultOpen)

  const passCount = checks.filter((c) => c.status === 'pass').length
  const total = checks.length

  // Group checks by their rule group, preserving display order
  const groupedChecks = useMemo(() => {
    const groups: Array<{ group: RuleGroup; checks: SeoCheck[] }> = []
    const seen = new Set<RuleGroup>()

    for (const ruleGroup of GROUP_ORDER) {
      const groupChecks = checks.filter((c) => c.group === ruleGroup)
      if (groupChecks.length > 0 && !seen.has(ruleGroup)) {
        groups.push({ group: ruleGroup, checks: groupChecks })
        seen.add(ruleGroup)
      }
    }

    // Add any groups not in GROUP_ORDER (safety net)
    for (const check of checks) {
      if (!seen.has(check.group)) {
        const groupChecks = checks.filter((c) => c.group === check.group)
        groups.push({ group: check.group, checks: groupChecks })
        seen.add(check.group)
      }
    }

    return groups
  }, [checks])

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...styles.categoryHeader,
          backgroundColor: getCategoryBg(category),
        }}
      >
        <span style={{ color: C.textPrimary }}>
          {getCategoryLabel(category, t)}{' '}
          <span
            style={{
              fontWeight: 700,
              fontSize: 11,
              color: C.textSecondary,
              textTransform: 'none' as const,
            }}
          >
            ({passCount}/{total})
          </span>
        </span>
        <span
          style={{
            fontSize: 14,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            color: C.textSecondary,
          }}
        >
          {'\u25B6'}
        </span>
      </div>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {groupedChecks.map(({ group, checks: groupChecks }) => (
            <GroupSubSection key={group} group={group} checks={groupChecks} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keyword duplicate check hook
// ---------------------------------------------------------------------------
interface KeywordUsage {
  used: boolean
  pages: Array<{ title: string; slug: string; collection: string }>
}

function useKeywordDuplicateCheck(
  keyword: string | undefined,
  documentId: string | undefined,
): KeywordUsage | null {
  const [result, setResult] = useState<KeywordUsage | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevKeyword = useRef<string | undefined>(undefined)

  const checkKeyword = useCallback(
    async (kw: string) => {
      try {
        const params = new URLSearchParams({ keyword: kw })
        if (documentId) params.set('excludeId', documentId)
        const res = await fetch(`/api/seo-plugin/check-keyword?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          setResult({ used: data.used, pages: data.pages || [] })
        }
      } catch {
        // Silently fail — non-critical feature
      }
    },
    [documentId],
  )

  useEffect(() => {
    const kw = keyword?.trim()
    if (!kw || kw === prevKeyword.current) return
    prevKeyword.current = kw

    // Debounce 800ms
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      checkKeyword(kw)
    }, 800)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [keyword, checkKeyword])

  return result
}

// ---------------------------------------------------------------------------
// Internal linking suggestions hook
// ---------------------------------------------------------------------------
interface LinkSuggestion {
  title: string
  slug: string
  collection: string
  score: number
  contextPhrase: string
  matchType: 'keyword' | 'title' | 'slug'
}

function useInternalLinkSuggestions(
  documentId: string | undefined,
  collection: string | undefined,
  textContent: string,
): { suggestions: LinkSuggestion[]; loading: boolean } {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevContentRef = useRef<string>('')

  useEffect(() => {
    const trimmed = textContent.trim()
    if (!trimmed || trimmed.length < 50) {
      setSuggestions([])
      return
    }

    // Only re-fetch if content changed significantly (first 500 chars)
    const contentKey = trimmed.substring(0, 500)
    if (contentKey === prevContentRef.current) return
    prevContentRef.current = contentKey

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/seo-plugin/suggest-links', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            collection: collection || 'pages',
            content: trimmed,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
        }
      } catch {
        // Non-critical feature
      }
      setLoading(false)
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [textContent, documentId, collection])

  return { suggestions, loading }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const SeoAnalyzer: React.FC = () => {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  const [formFields] = useAllFormFields()
  const initialScoreRef = useRef<number | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(true)
  const [cannibalizationExpanded, setCannibalizationExpanded] = useState(false)
  const [linkingSectionOpen, setLinkingSectionOpen] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState<{ metaTitle: string; metaDescription: string } | null>(null)
  const [aiCopied, setAiCopied] = useState<'title' | 'desc' | null>(null)

  // Helper to get field value from form state
  const getFieldValue = useCallback(
    (path: string): unknown => {
      if (!formFields) return undefined
      const field = formFields[path]
      return field?.value ?? undefined
    },
    [formFields],
  )

  // Extract focusKeyword, cornerstone flag and document ID
  const focusKeyword = getFieldValue('focusKeyword') as string | undefined
  const isCornerstone = getFieldValue('isCornerstone') as boolean | undefined
  const documentId = getFieldValue('id') as string | undefined
  const updatedAt = getFieldValue('updatedAt') as string | undefined
  const contentLastReviewed = getFieldValue('contentLastReviewed') as string | undefined

  // Check if the primary keyword is already used by another document
  const keywordUsage = useKeywordDuplicateCheck(focusKeyword, documentId)

  // Extract secondary keywords from form state (array field: focusKeywords.N.keyword)
  const focusKeywords: string[] = useMemo(() => {
    if (!formFields) return []
    const keywords: string[] = []
    let idx = 0
    while (true) {
      const kw = getFieldValue(`focusKeywords.${idx}.keyword`) as string | undefined
      if (kw === undefined && idx > 0) break
      if (kw && kw.trim()) keywords.push(kw.trim())
      idx++
      if (idx > 10) break // safety
    }
    return keywords
  }, [formFields, getFieldValue])

  // Extract values from form state and run analysis
  const { analysis, wordCount } = useMemo(() => {
    if (!formFields) return { analysis: { score: 0, level: 'poor' as const, checks: [] }, wordCount: 0 }

    const metaTitle = getFieldValue('meta.title') as string | undefined
    const metaDescription = getFieldValue('meta.description') as string | undefined
    const metaImage = getFieldValue('meta.image')
    const slug = getFieldValue('slug') as string | undefined

    // Hero fields (Pages)
    const heroRichText = getFieldValue('hero.richText')
    const heroMedia = getFieldValue('hero.media')

    // Hero CTA links (linkGroup: hero.links.N.link)
    const heroLinks: Record<string, unknown>[] = []
    let heroLinkIdx = 0
    while (true) {
      const linkType = getFieldValue(`hero.links.${heroLinkIdx}.link.type`) as string | undefined
      if (linkType === undefined && heroLinkIdx > 0) break
      if (linkType !== undefined) {
        const linkUrl = getFieldValue(`hero.links.${heroLinkIdx}.link.url`) as string | undefined
        const linkLabel = getFieldValue(`hero.links.${heroLinkIdx}.link.label`) as string | undefined
        const linkRef = getFieldValue(`hero.links.${heroLinkIdx}.link.reference`)
        heroLinks.push({ link: { type: linkType, url: linkUrl, label: linkLabel, reference: linkRef } })
      }
      heroLinkIdx++
      if (heroLinkIdx > 10) break
    }

    // Post content (Lexical richText)
    const content = getFieldValue('content')

    // Detect if we're editing a post (content field present means post)
    const isPost = !!content

    // heroTitle: for posts = document title (rendered as <h1> by PostHero)
    // for pages = not needed for H1 counting (allHeadings handles it)
    const pageTitle = getFieldValue('title') as string | undefined
    let heroTitle: string | undefined
    if (isPost) {
      heroTitle = pageTitle
    } else if (heroRichText) {
      const text = extractTextFromLexical(heroRichText)
      if (text.trim()) heroTitle = text.trim().split('\n')[0]
    }

    // Layout blocks (Pages)
    const blocks: unknown[] = []

    // Collect blocks from layout — form state stores them as layout.0, layout.1, etc.
    let blockIdx = 0
    while (true) {
      const blockType = getFieldValue(`layout.${blockIdx}.blockType`) as string | undefined
      if (!blockType) break

      const block: Record<string, unknown> = { blockType }

      // For Content blocks with columns (+ enableLink/link for link extraction)
      let colIdx = 0
      const columns: Record<string, unknown>[] = []
      while (true) {
        const colRichText = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.richText`)
        if (colRichText === undefined && colIdx > 0) break
        if (colRichText !== undefined) {
          const enableLink = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.enableLink`) as boolean | undefined
          const colEntry: Record<string, unknown> = { richText: colRichText }
          if (enableLink) {
            colEntry.enableLink = true
            const linkType = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.link.type`) as string | undefined
            const linkUrl = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.link.url`) as string | undefined
            const linkLabel = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.link.label`) as string | undefined
            const linkRef = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.link.reference`)
            colEntry.link = { type: linkType, url: linkUrl, label: linkLabel, reference: linkRef }
          }
          columns.push(colEntry)
        }
        colIdx++
        if (colIdx > 20) break // safety
      }
      if (columns.length > 0) block.columns = columns

      // For blocks with direct richText
      const richText = getFieldValue(`layout.${blockIdx}.richText`)
      if (richText) block.richText = richText

      // MediaBlock
      const media = getFieldValue(`layout.${blockIdx}.media`)
      if (media) block.media = media

      // Services block — extract titles, descriptions and links
      if (blockType === 'services') {
        const services: Record<string, unknown>[] = []
        let svcIdx = 0
        while (true) {
          const svcTitle = getFieldValue(`layout.${blockIdx}.services.${svcIdx}.title`) as string | undefined
          if (svcTitle === undefined && svcIdx > 0) break
          if (svcTitle !== undefined) {
            const svcDesc = getFieldValue(`layout.${blockIdx}.services.${svcIdx}.description`) as string | undefined
            const svcLink = getFieldValue(`layout.${blockIdx}.services.${svcIdx}.link`) as string | undefined
            services.push({ title: svcTitle, description: svcDesc || '', link: svcLink || '' })
          }
          svcIdx++
          if (svcIdx > 50) break // safety
        }
        if (services.length > 0) block.services = services
      }

      // CTA block — extract linkGroup links
      if (blockType === 'cta' || blockType === 'callToAction') {
        const links: Record<string, unknown>[] = []
        let linkIdx = 0
        while (true) {
          const linkType = getFieldValue(`layout.${blockIdx}.links.${linkIdx}.link.type`) as string | undefined
          if (linkType === undefined && linkIdx > 0) break
          if (linkType !== undefined) {
            const linkUrl = getFieldValue(`layout.${blockIdx}.links.${linkIdx}.link.url`) as string | undefined
            const linkLabel = getFieldValue(`layout.${blockIdx}.links.${linkIdx}.link.label`) as string | undefined
            const linkRef = getFieldValue(`layout.${blockIdx}.links.${linkIdx}.link.reference`)
            links.push({ link: { type: linkType, url: linkUrl, label: linkLabel, reference: linkRef } })
          }
          linkIdx++
          if (linkIdx > 10) break
        }
        if (links.length > 0) block.links = links
      }

      // LatestPosts block — extract CTA link
      if (blockType === 'latestPosts') {
        const ctaLink = getFieldValue(`layout.${blockIdx}.ctaLink`) as string | undefined
        const ctaLabel = getFieldValue(`layout.${blockIdx}.ctaLabel`) as string | undefined
        if (ctaLink) {
          block.ctaLink = ctaLink
          block.ctaLabel = ctaLabel || ''
        }
      }

      // Portfolio block — extract project links
      if (blockType === 'portfolio') {
        const projects: Record<string, unknown>[] = []
        let projIdx = 0
        while (true) {
          const projTitle = getFieldValue(`layout.${blockIdx}.projects.${projIdx}.title`) as string | undefined
          if (projTitle === undefined && projIdx > 0) break
          if (projTitle !== undefined) {
            const projLink = getFieldValue(`layout.${blockIdx}.projects.${projIdx}.link`) as string | undefined
            projects.push({ title: projTitle, link: projLink || '' })
          }
          projIdx++
          if (projIdx > 50) break
        }
        if (projects.length > 0) block.projects = projects
      }

      // Testimonials block — extract quotes for word count
      if (blockType === 'testimonials') {
        const testimonials: Record<string, unknown>[] = []
        let tIdx = 0
        while (true) {
          const quote = getFieldValue(`layout.${blockIdx}.testimonials.${tIdx}.quote`) as string | undefined
          if (quote === undefined && tIdx > 0) break
          if (quote !== undefined) {
            testimonials.push({ quote })
          }
          tIdx++
          if (tIdx > 20) break // safety
        }
        if (testimonials.length > 0) block.testimonials = testimonials
      }

      blocks.push(block)
      blockIdx++
      if (blockIdx > 100) break // safety
    }

    const result = analyzeSeo({
      metaTitle,
      metaDescription,
      metaImage,
      slug,
      focusKeyword,
      focusKeywords: focusKeywords.length > 0 ? focusKeywords : undefined,
      heroTitle,
      heroRichText,
      heroLinks: heroLinks.length > 0 ? heroLinks : undefined,
      heroMedia: heroMedia || undefined,
      blocks: blocks.length > 0 ? blocks : undefined,
      content: content || undefined,
      isPost,
      isCornerstone: !!isCornerstone,
      updatedAt: updatedAt || undefined,
      contentLastReviewed: contentLastReviewed || undefined,
    })

    // Compute word count from the content check (reuse the check message or compute separately)
    let wc = 0
    const wcCheck = result.checks.find((c) => c.id === 'content-wordcount')
    if (wcCheck) {
      const match = wcCheck.message.match(/(\d+)\s*(?:mots|words)/)
      if (match) wc = parseInt(match[1], 10)
    }

    return { analysis: result, wordCount: wc }
  }, [formFields, focusKeyword, focusKeywords, isCornerstone, updatedAt, contentLastReviewed, getFieldValue])

  // Social preview data — extracted from form state
  const socialPreviewData = useMemo(() => {
    const metaTitle = getFieldValue('meta.title') as string | undefined
    const metaDescription = getFieldValue('meta.description') as string | undefined
    const metaImage = getFieldValue('meta.image')
    const slug = getFieldValue('slug') as string | undefined

    // Try to build image URL from meta image
    let imageUrl: string | undefined
    if (metaImage && typeof metaImage === 'object' && 'url' in metaImage) {
      imageUrl = (metaImage as { url?: string }).url || undefined
    }

    // Detect hostname from window
    let hostname = 'example.com'
    if (typeof window !== 'undefined') {
      hostname = window.location.hostname
    }

    return { metaTitle, metaDescription, imageUrl, hostname, slug }
  }, [formFields, getFieldValue])

  // Internal linking — extract text content for suggestions
  const textContentForLinks = useMemo(() => {
    if (!formFields) return ''
    const parts: string[] = []

    // Hero richText
    const heroRichText = getFieldValue('hero.richText')
    if (heroRichText) parts.push(extractTextFromLexical(heroRichText))

    // Layout blocks
    let blockIdx = 0
    while (blockIdx < 100) {
      const blockType = getFieldValue(`layout.${blockIdx}.blockType`) as string | undefined
      if (!blockType) break

      // RichText blocks
      const richText = getFieldValue(`layout.${blockIdx}.richText`)
      if (richText) parts.push(extractTextFromLexical(richText))

      // Columns
      let colIdx = 0
      while (colIdx < 20) {
        const colRichText = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.richText`)
        if (colRichText === undefined && colIdx > 0) break
        if (colRichText) parts.push(extractTextFromLexical(colRichText))
        colIdx++
      }

      blockIdx++
    }

    // Post content
    const content = getFieldValue('content')
    if (content) parts.push(extractTextFromLexical(content))

    return parts.join(' ')
  }, [formFields, getFieldValue])

  // Detect collection from current URL
  const currentCollection = useMemo(() => {
    if (typeof window === 'undefined') return 'pages'
    const match = window.location.pathname.match(/\/collections\/([^/]+)\//)
    return match ? match[1] : 'pages'
  }, [])

  const { suggestions: linkSuggestions, loading: linkSuggestionsLoading } =
    useInternalLinkSuggestions(documentId, currentCollection, textContentForLinks)

  // Reading time: ~200 words per minute, minimum 1 minute
  const readingTime = Math.max(1, Math.round(wordCount / 200))

  // Feature 1: Capture initial score on first valid analysis
  useEffect(() => {
    if (initialScoreRef.current === null && analysis.checks.length > 0) {
      initialScoreRef.current = analysis.score
    }
  }, [analysis.score, analysis.checks.length])

  const scoreDelta = initialScoreRef.current !== null ? analysis.score - initialScoreRef.current : null

  const levelColor = getLevelColor(analysis.level)
  const levelLabel = getLevelLabel(analysis.level, t)

  // Group checks by category
  const criticalChecks = analysis.checks.filter((c) => c.category === 'critical')
  const importantChecks = analysis.checks.filter((c) => c.category === 'important')
  const bonusChecks = analysis.checks.filter((c) => c.category === 'bonus')

  // Summary stats
  const totalChecks = analysis.checks.length
  const passChecks = analysis.checks.filter((c) => c.status === 'pass').length
  const failChecks = analysis.checks.filter((c) => c.status === 'fail').length
  const warnChecks = analysis.checks.filter((c) => c.status === 'warning').length

  // Feature 2: Smart Suggestions based on failed/warning checks
  const suggestions = useMemo(() => {
    const items: Array<{ icon: string; text: string; checkId: string }> = []

    // Collect failed and warning checks sorted by priority
    const prioritized: SeoCheck[] = []
    const critFails = analysis.checks.filter((c) => c.category === 'critical' && c.status === 'fail')
    const impFails = analysis.checks.filter((c) => c.category === 'important' && c.status === 'fail')
    const critWarns = analysis.checks.filter((c) => c.category === 'critical' && c.status === 'warning')
    const impWarns = analysis.checks.filter((c) => c.category === 'important' && c.status === 'warning')
    prioritized.push(...critFails, ...impFails, ...critWarns, ...impWarns)

    for (const check of prioritized) {
      if (items.length >= 5) break

      // Avoid duplicate suggestions for same group
      const alreadyHasGroup = items.some((s) => {
        const existingCheck = analysis.checks.find((c) => c.id === s.checkId)
        return existingCheck?.group === check.group
      })
      if (alreadyHasGroup) continue

      let text = ''
      let icon = ''

      if (check.id.startsWith('title-length') || check.id.startsWith('title-')) {
        const match = check.message.match(/(\d+)\s*caract|\b(\d+)\s*char/)
        const charCount = match ? (match[1] || match[2]) : '?'
        text = `${t.seoAnalyzer.adjustTitle} (${t.seoAnalyzer.currently} ${charCount} ${t.seoAnalyzer.titleCharactersIdeal})`
        icon = '\u270D'
      } else if (check.id.startsWith('meta-desc')) {
        text = t.seoAnalyzer.writeMetaDesc
        icon = '\u2709'
      } else if (check.id === 'content-wordcount') {
        text = t.seoAnalyzer.enrichContent
        icon = '\u270D'
      } else if (check.id === 'keyword-in-title') {
        text = t.seoAnalyzer.includeKeywordInTitle
        icon = '\uD83C\uDFAF'
      } else if (check.id === 'keyword-in-meta') {
        text = t.seoAnalyzer.includeKeywordInDesc
        icon = '\uD83C\uDFAF'
      } else if (check.id.startsWith('images-alt') || check.id === 'images-alt') {
        text = t.seoAnalyzer.addAltText
        icon = '\uD83D\uDDBC'
      } else if (check.id.startsWith('linking-internal') || check.id === 'linking-internal') {
        text = t.seoAnalyzer.addInternalLinks
        icon = '\uD83D\uDD17'
      } else {
        // Generic: use tip or message
        text = check.tip || check.message
        icon = check.status === 'fail' ? '\u26A0' : '\u2139'
      }

      if (text) {
        items.push({ icon, text, checkId: check.id })
      }
    }

    return items
  }, [analysis.checks, t])

  return (
    <div style={styles.wrapper}>
      {/* Header with score ring */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          padding: '16px',
          borderRadius: 12,
          border: `2px solid ${C.border}`,
          backgroundColor: C.surfaceBg,
          boxShadow: '3px 3px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
        }}
      >
        <div style={styles.scoreRing(levelColor)}>
          {/* SVG ring progress */}
          <svg
            width="90"
            height="90"
            viewBox="0 0 90 90"
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <circle
              cx="45"
              cy="45"
              r="40"
              fill="none"
              stroke="var(--theme-elevation-200, #e5e7eb)"
              strokeWidth="4"
            />
            <circle
              cx="45"
              cy="45"
              r="40"
              fill="none"
              stroke={levelColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(analysis.score / 100) * 251.2} 251.2`}
              transform="rotate(-90 45 45)"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
          <span style={{ ...styles.scoreNumber, color: levelColor }}>{analysis.score}</span>
          <span style={{ ...styles.scoreLabel, color: C.textSecondary }}>{t.seoAnalyzer.outOf100}</span>
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: C.textPrimary,
              }}
            >
              {t.seoAnalyzer.seoScore}
            </div>
            {/* Feature 1: Score delta badge */}
            {scoreDelta !== null && scoreDelta !== 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 900,
                  border: `2px solid ${C.border}`,
                  backgroundColor: scoreDelta > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: scoreDelta > 0 ? C.green : C.red,
                  boxShadow: '1px 1px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
                }}
              >
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={styles.levelBadge(levelColor, levelColor === C.yellow ? C.black : C.white)}>
              {levelLabel}
            </div>
            {isCornerstone && (
              <div style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 900,
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: `2px solid ${C.border}`,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.04em',
              }}>
                {t.seoAnalyzer.cornerstoneLabel}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.textSecondary,
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            {passChecks} / {totalChecks} {t.seoAnalyzer.checksPassed}
            {failChecks > 0 && (
              <span style={{ color: C.red, fontWeight: 700 }}>
                {' '}
                ({failChecks} {t.seoAnalyzer.errorsCount})
              </span>
            )}
            {failChecks === 0 && warnChecks > 0 && (
              <span style={{ color: C.orange, fontWeight: 700 }}>
                {' '}
                ({warnChecks} {t.seoAnalyzer.warningsCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reading time + word count info bar */}
      {wordCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid var(--theme-elevation-200, #e5e7eb)`,
            backgroundColor: C.surface50,
            fontSize: 11,
            color: C.textSecondary,
          }}
        >
          <span style={{ fontWeight: 700, color: C.textPrimary }}>
            {t.seoAnalyzer.readingTime.replace('{n}', String(readingTime))}
          </span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{wordCount} {t.seoAnalyzer.wordsLabel}</span>
          {focusKeywords.length > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>{focusKeywords.length} {t.seoAnalyzer.secondaryKeywords}</span>
            </>
          )}
        </div>
      )}

      {/* AI Meta Generation */}
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={aiGenerating}
          onClick={async () => {
            setAiGenerating(true)
            setAiResult(null)
            try {
              const title = getFieldValue('title') as string || ''
              const slug = getFieldValue('slug') as string || ''
              const content = getFieldValue('content')
              const heroRichTextVal = getFieldValue('hero.richText')

              // Extract text from content for the AI endpoint
              let textContent = ''
              if (content) textContent += extractTextFromLexical(content)
              if (heroRichTextVal) textContent += ' ' + extractTextFromLexical(heroRichTextVal)

              // Also extract from layout blocks
              let blockIdx = 0
              while (blockIdx < 100) {
                const blockType = getFieldValue(`layout.${blockIdx}.blockType`) as string | undefined
                if (!blockType) break
                const rt = getFieldValue(`layout.${blockIdx}.richText`)
                if (rt) textContent += ' ' + extractTextFromLexical(rt)
                let colIdx = 0
                while (colIdx < 20) {
                  const colRt = getFieldValue(`layout.${blockIdx}.columns.${colIdx}.richText`)
                  if (colRt === undefined && colIdx > 0) break
                  if (colRt) textContent += ' ' + extractTextFromLexical(colRt)
                  colIdx++
                }
                blockIdx++
              }

              const res = await fetch('/api/seo-plugin/ai-generate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title,
                  focusKeyword: focusKeyword || '',
                  content: textContent.trim(),
                  slug,
                }),
              })
              if (res.ok) {
                const data = await res.json()
                setAiResult(data)
              }
            } catch {
              // Silently fail
            }
            setAiGenerating(false)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: `2px solid ${C.border}`,
            backgroundColor: C.cyan,
            color: C.black,
            fontWeight: 800,
            fontSize: 12,
            cursor: aiGenerating ? 'wait' : 'pointer',
            opacity: aiGenerating ? 0.7 : 1,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            justifyContent: 'center',
            boxShadow: '2px 2px 0 0 var(--theme-border-color, rgba(0,0,0,1))',
          }}
        >
          {aiGenerating ? t.common.generating : `\u2728 ${t.seoAnalyzer.generateMeta}`}
        </button>

        {/* AI Results panel */}
        {aiResult && (
          <div
            style={{
              marginTop: 8,
              padding: '12px 14px',
              borderRadius: 8,
              border: `2px solid ${C.border}`,
              backgroundColor: C.surfaceBg,
            }}
          >
            {/* Generated meta title */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase' as const }}>
                  {t.seoAnalyzer.metaTitle}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: aiResult.metaTitle.length >= 50 && aiResult.metaTitle.length <= 60 ? C.green : C.orange,
                    }}
                  >
                    {aiResult.metaTitle.length}/60
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResult.metaTitle)
                      setAiCopied('title')
                      setTimeout(() => setAiCopied(null), 1500)
                    }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase' as const,
                      backgroundColor: aiCopied === 'title' ? C.green : C.surface50,
                      color: aiCopied === 'title' ? C.white : C.textPrimary,
                      border: `1px solid ${C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    {aiCopied === 'title' ? '\u2713' : t.common.copy}
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid var(--theme-elevation-200, #e5e7eb)`,
                  backgroundColor: C.surface50,
                  fontSize: 12,
                  color: C.textPrimary,
                  lineHeight: 1.5,
                }}
              >
                {aiResult.metaTitle || t.seoAnalyzer.emptyValue}
              </div>
            </div>

            {/* Generated meta description */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase' as const }}>
                  {t.seoAnalyzer.metaDescription}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: aiResult.metaDescription.length >= 120 && aiResult.metaDescription.length <= 160 ? C.green : C.orange,
                    }}
                  >
                    {aiResult.metaDescription.length}/160
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResult.metaDescription)
                      setAiCopied('desc')
                      setTimeout(() => setAiCopied(null), 1500)
                    }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase' as const,
                      backgroundColor: aiCopied === 'desc' ? C.green : C.surface50,
                      color: aiCopied === 'desc' ? C.white : C.textPrimary,
                      border: `1px solid ${C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    {aiCopied === 'desc' ? '\u2713' : t.common.copy}
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid var(--theme-elevation-200, #e5e7eb)`,
                  backgroundColor: C.surface50,
                  fontSize: 12,
                  color: C.textPrimary,
                  lineHeight: 1.5,
                }}
              >
                {aiResult.metaDescription || t.seoAnalyzer.emptyValue}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature 2: Smart Suggestions */}
      {suggestions.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 8,
            border: `2px solid ${C.border}`,
            backgroundColor: C.surfaceBg,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 12,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              backgroundColor: 'rgba(0,229,255,0.08)',
              userSelect: 'none' as const,
              color: C.textPrimary,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {'\uD83D\uDCA1'} {t.seoAnalyzer.improvementSuggestions}
              <span style={{ fontWeight: 600, fontSize: 10, color: C.textSecondary, textTransform: 'none' as const }}>
                ({suggestions.length})
              </span>
            </span>
            <span
              style={{
                fontSize: 10,
                transition: 'transform 0.2s',
                display: 'inline-block',
                transform: suggestionsOpen ? 'rotate(90deg)' : 'none',
                color: C.textSecondary,
              }}
            >
              {'\u25B6'}
            </span>
          </div>
          {suggestionsOpen && (
            <div style={{ padding: '8px 14px 12px' }}>
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    lineHeight: 1.5,
                    marginBottom: 4,
                    cursor: 'default',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : C.surface50,
                    color: C.textPrimary,
                  }}
                >
                  <span style={{ flexShrink: 0, fontSize: 13, lineHeight: 1.4 }}>
                    {suggestion.icon}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {suggestion.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feature 3: Enhanced Keyword Cannibalization Warning */}
      {keywordUsage && keywordUsage.used && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 8,
            border: `2px solid ${keywordUsage.pages.length > 2 ? C.red : C.orange}`,
            backgroundColor: keywordUsage.pages.length > 2 ? 'rgba(239,68,68,0.08)' : 'rgba(255,138,0,0.08)',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 900,
              backgroundColor: keywordUsage.pages.length > 2 ? 'rgba(239,68,68,0.2)' : 'rgba(255,138,0,0.2)',
              color: keywordUsage.pages.length > 2 ? '#dc2626' : '#d97706',
            }}
          >
            !
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, color: C.textPrimary }}>
                {t.seoAnalyzer.seoCannibalization}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                  backgroundColor: keywordUsage.pages.length > 2 ? C.red : C.orange,
                  color: C.white,
                  border: `1px solid ${C.border}`,
                }}
              >
                {keywordUsage.pages.length > 2 ? t.seoAnalyzer.highRisk : t.cannibalization.warning}
              </span>
            </div>
            <div style={{ color: C.textSecondary }}>
              &quot;{focusKeyword}&quot; —{' '}
              <strong style={{ color: C.textPrimary }}>{keywordUsage.pages.length} {t.cannibalization.pages}</strong>.
              {keywordUsage.pages.length > 2
                ? ` ${t.seoAnalyzer.duplicationHarmsRanking}`
                : ` ${t.seoAnalyzer.diluteRanking}`}
            </div>
            <div style={{ marginTop: 6 }}>
              <div
                onClick={() => setCannibalizationExpanded(!cannibalizationExpanded)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.cyan,
                  userSelect: 'none' as const,
                  padding: '2px 0',
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    transform: cannibalizationExpanded ? 'rotate(90deg)' : 'none',
                  }}
                >
                  {'\u25B6'}
                </span>
                {t.seoAnalyzer.viewPages} ({keywordUsage.pages.length})
              </div>
              {cannibalizationExpanded && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '6px 0',
                    borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
                  }}
                >
                  {keywordUsage.pages.map((page, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '4px 0',
                        borderBottom: idx < keywordUsage.pages.length - 1 ? '1px solid var(--theme-elevation-100, #f3f4f6)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {page.title}
                        </div>
                        <div style={{ fontSize: 10, color: C.textSecondary, opacity: 0.7 }}>
                          {page.collection === 'pages' ? t.common.page : t.common.article} — /{page.slug}
                        </div>
                      </div>
                      <a
                        href={`/admin/collections/${page.collection}/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.03em',
                          backgroundColor: C.cyan,
                          color: C.black,
                          border: `1px solid ${C.border}`,
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {t.common.edit} {'\u2197'}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, fontStyle: 'italic', fontSize: 10, color: C.textSecondary }}>
              {t.seoAnalyzer.uniqueKeywordAdvice}
            </div>
          </div>
        </div>
      )}

      {/* Social Preview */}
      <SeoSocialPreview
        metaTitle={socialPreviewData.metaTitle}
        metaDescription={socialPreviewData.metaDescription}
        imageUrl={socialPreviewData.imageUrl}
        hostname={socialPreviewData.hostname}
      />

      {/* Internal Linking Suggestions */}
      {(linkSuggestions.length > 0 || linkSuggestionsLoading) && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 8,
            border: `2px solid ${C.border}`,
            backgroundColor: C.surfaceBg,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setLinkingSectionOpen(!linkingSectionOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 12,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              backgroundColor: 'rgba(34,197,94,0.08)',
              userSelect: 'none' as const,
              color: C.textPrimary,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {'\uD83D\uDD17'} {t.seoAnalyzer.suggestedInternalLinks}
              <span style={{ fontWeight: 600, fontSize: 10, color: C.textSecondary, textTransform: 'none' as const }}>
                {linkSuggestionsLoading ? '...' : `(${linkSuggestions.length})`}
              </span>
            </span>
            <span
              style={{
                fontSize: 10,
                transition: 'transform 0.2s',
                display: 'inline-block',
                transform: linkingSectionOpen ? 'rotate(90deg)' : 'none',
                color: C.textSecondary,
              }}
            >
              {'\u25B6'}
            </span>
          </div>
          {linkingSectionOpen && (
            <div style={{ padding: '8px 14px 12px' }}>
              {linkSuggestionsLoading && (
                <div style={{ fontSize: 11, color: C.textSecondary, padding: '8px 0', textAlign: 'center' }}>
                  {t.seoAnalyzer.analyzingContent}
                </div>
              )}
              {!linkSuggestionsLoading && linkSuggestions.map((link, idx) => (
                <div
                  key={`${link.collection}-${link.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px',
                    borderRadius: 6,
                    fontSize: 11,
                    marginBottom: 4,
                    backgroundColor: idx % 2 === 0 ? 'transparent' : C.surface50,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: C.textPrimary }}>
                        {link.title}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor:
                            link.matchType === 'keyword' ? 'rgba(34,197,94,0.15)' :
                            link.matchType === 'title' ? 'rgba(0,229,255,0.15)' :
                            'rgba(255,138,0,0.15)',
                          color:
                            link.matchType === 'keyword' ? '#16a34a' :
                            link.matchType === 'title' ? '#0891b2' :
                            '#d97706',
                          textTransform: 'uppercase' as const,
                        }}
                      >
                        {link.matchType}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textSecondary, fontFamily: 'monospace' }}>
                      /{link.slug}
                    </div>
                    {link.contextPhrase && (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.textSecondary,
                          marginTop: 4,
                          fontStyle: 'italic',
                          lineHeight: 1.4,
                        }}
                      >
                        {link.contextPhrase}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`/${link.slug}`)
                      setCopiedSlug(link.slug)
                      setTimeout(() => setCopiedSlug(null), 1500)
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.03em',
                      backgroundColor: copiedSlug === link.slug ? C.green : C.cyan,
                      color: copiedSlug === link.slug ? C.white : C.black,
                      border: `1px solid ${C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedSlug === link.slug ? '\u2713' : t.common.copy}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Check categories */}
      {criticalChecks.length > 0 && (
        <CategorySection category="critical" checks={criticalChecks} defaultOpen={true} t={t} />
      )}
      {importantChecks.length > 0 && (
        <CategorySection category="important" checks={importantChecks} defaultOpen={true} t={t} />
      )}
      {bonusChecks.length > 0 && (
        <CategorySection category="bonus" checks={bonusChecks} defaultOpen={false} t={t} />
      )}
    </div>
  )
}

export default SeoAnalyzer
