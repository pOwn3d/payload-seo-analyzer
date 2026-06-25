import { describe, it, expect } from 'vitest'
import {
  analyzeIndexationHygiene,
  computeNoindexStats,
  findDanglingCanonicals,
  findDuplicatedCanonicals,
  findMissingCanonicals,
  isInternalCanonical,
  isNoindexRecord,
  lastSegment,
  normalizeUrlKey,
  type IndexationDocRecord,
} from '../endpoints/indexationAudit'

// ── Small factory to keep test data terse ───────────────────────────────────
let counter = 0
function rec(partial: Partial<IndexationDocRecord> = {}): IndexationDocRecord {
  counter += 1
  return {
    collection: partial.collection ?? 'pages',
    id: partial.id ?? counter,
    slug: partial.slug ?? `doc-${counter}`,
    title: partial.title ?? `Doc ${counter}`,
    canonicalUrl: partial.canonicalUrl,
    robotsMeta: partial.robotsMeta,
    noindex: partial.noindex,
    nofollow: partial.nofollow,
  }
}

describe('isNoindexRecord', () => {
  it('prefers the explicit flag', () => {
    expect(isNoindexRecord(rec({ noindex: true }))).toBe(true)
    expect(isNoindexRecord(rec({ noindex: false, robotsMeta: 'noindex' }))).toBe(false)
  })
  it('falls back to parsing robotsMeta', () => {
    expect(isNoindexRecord(rec({ robotsMeta: 'noindex, nofollow' }))).toBe(true)
    expect(isNoindexRecord(rec({ robotsMeta: 'index, follow' }))).toBe(false)
    expect(isNoindexRecord(rec({}))).toBe(false)
  })
})

describe('normalizeUrlKey', () => {
  it('lowercases, strips trailing slash and fragments', () => {
    expect(normalizeUrlKey('/About/')).toBe('/about')
    expect(normalizeUrlKey('https://X.com/Page/#top')).toBe('https://x.com/page')
    expect(normalizeUrlKey('/about')).toBe('/about')
  })
  it('returns null for empty / root', () => {
    expect(normalizeUrlKey('')).toBeNull()
    expect(normalizeUrlKey('   ')).toBeNull()
    expect(normalizeUrlKey('/')).toBeNull()
    expect(normalizeUrlKey(undefined)).toBeNull()
  })
})

describe('lastSegment', () => {
  it('extracts the final path segment from slugs and URLs', () => {
    expect(lastSegment('blog/my-post')).toBe('my-post')
    expect(lastSegment('/posts/my-post/')).toBe('my-post')
    expect(lastSegment('https://x.com/a/b/c?q=1#h')).toBe('c')
    expect(lastSegment('contact')).toBe('contact')
  })
  it('returns null for root / empty', () => {
    expect(lastSegment('/')).toBeNull()
    expect(lastSegment('')).toBeNull()
    expect(lastSegment(undefined)).toBeNull()
  })
})

describe('isInternalCanonical', () => {
  it('treats relative canonicals as internal', () => {
    expect(isInternalCanonical('/about')).toBe(true)
    expect(isInternalCanonical('about/page')).toBe(true)
  })
  it('compares origins when a siteUrl is provided', () => {
    expect(isInternalCanonical('https://site.com/about', 'https://site.com')).toBe(true)
    expect(isInternalCanonical('https://other.com/about', 'https://site.com')).toBe(false)
  })
  it('is conservative for absolute URLs without a siteUrl', () => {
    expect(isInternalCanonical('https://site.com/about')).toBe(false)
  })
})

describe('computeNoindexStats — mass noindex', () => {
  it('passes when nothing is noindex', () => {
    const stats = computeNoindexStats([rec(), rec(), rec()])
    expect(stats.severity).toBe('pass')
    expect(stats.count).toBe(0)
  })

  it('warns for some noindex below the mass threshold', () => {
    const docs = [
      ...Array.from({ length: 8 }, () => rec()),
      rec({ noindex: true }),
      rec({ noindex: true }),
    ] // 2/10 = 20% < 30%
    const stats = computeNoindexStats(docs)
    expect(stats.severity).toBe('warning')
    expect(stats.count).toBe(2)
    expect(stats.massNoindex).toBe(false)
  })

  it('fails (mass) when the proportion is abnormal on a large-enough corpus', () => {
    const docs = [
      ...Array.from({ length: 6 }, () => rec()),
      ...Array.from({ length: 4 }, () => rec({ robotsMeta: 'noindex' })),
    ] // 4/10 = 40% > 30%
    const stats = computeNoindexStats(docs)
    expect(stats.severity).toBe('fail')
    expect(stats.massNoindex).toBe(true)
    expect(stats.pct).toBeCloseTo(0.4)
  })

  it('never escalates to fail on a tiny corpus (avoids false alarms)', () => {
    const docs = [rec({ noindex: true }), rec({ noindex: true }), rec({ noindex: true })] // 3/3 = 100% but < minDocs
    const stats = computeNoindexStats(docs)
    expect(stats.severity).toBe('warning')
    expect(stats.massNoindex).toBe(false)
  })
})

describe('findDuplicatedCanonicals — cannibalization', () => {
  it('detects several docs pointing at the same canonical (homepage inheritance)', () => {
    const docs = [
      rec({ slug: 'a', canonicalUrl: 'https://site.com' }), // homepage canonical
      rec({ slug: 'blog', canonicalUrl: 'https://site.com' }),
      rec({ slug: 'posts', canonicalUrl: 'https://site.com/' }), // trailing slash → same key
    ]
    const stats = findDuplicatedCanonicals(docs)
    expect(stats.groups).toHaveLength(1)
    expect(stats.groups[0].count).toBe(3)
    expect(stats.docCount).toBe(3)
    expect(stats.severity).toBe('warning')
  })

  it('escalates to fail for a large duplicate group', () => {
    const docs = Array.from({ length: 6 }, (_, i) =>
      rec({ slug: `p-${i}`, canonicalUrl: '/landing' }),
    )
    const stats = findDuplicatedCanonicals(docs)
    expect(stats.groups[0].count).toBe(6)
    expect(stats.severity).toBe('fail')
  })

  it('ignores noindex docs and unique canonicals', () => {
    const docs = [
      rec({ slug: 'a', canonicalUrl: '/a' }),
      rec({ slug: 'b', canonicalUrl: '/b' }),
      rec({ slug: 'dup1', canonicalUrl: '/shared', noindex: true }),
      rec({ slug: 'dup2', canonicalUrl: '/shared', noindex: true }),
    ]
    const stats = findDuplicatedCanonicals(docs)
    expect(stats.groups).toHaveLength(0)
    expect(stats.severity).toBe('pass')
  })
})

describe('findMissingCanonicals — partial coverage', () => {
  it('flags docs missing a canonical only when the collection otherwise uses them', () => {
    const docs = [
      rec({ collection: 'pages', slug: 'a', canonicalUrl: '/a' }),
      rec({ collection: 'pages', slug: 'b', canonicalUrl: '/b' }),
      rec({ collection: 'pages', slug: 'c' }), // missing → anomaly
    ]
    const stats = findMissingCanonicals(docs)
    expect(stats.severity).toBe('warning')
    expect(stats.count).toBe(1)
    expect(stats.docs[0].slug).toBe('c')
    expect(stats.byCollection[0]).toMatchObject({ collection: 'pages', total: 3, withCanonical: 2, missing: 1 })
  })

  it('does NOT flag a collection that never uses canonicals (framework-managed)', () => {
    const docs = [rec({ slug: 'a' }), rec({ slug: 'b' }), rec({ slug: 'c' })]
    const stats = findMissingCanonicals(docs)
    expect(stats.severity).toBe('pass')
    expect(stats.count).toBe(0)
  })

  it('does NOT flag a collection with full coverage', () => {
    const docs = [rec({ canonicalUrl: '/a' }), rec({ canonicalUrl: '/b' })]
    expect(findMissingCanonicals(docs).count).toBe(0)
  })

  it('excludes noindex docs from the missing-canonical check', () => {
    const docs = [
      rec({ collection: 'pages', canonicalUrl: '/a' }),
      rec({ collection: 'pages', canonicalUrl: '/b' }),
      rec({ collection: 'pages', noindex: true }), // noindex → not expected to have canonical
    ]
    expect(findMissingCanonicals(docs).count).toBe(0)
  })
})

describe('findDanglingCanonicals — broken internal canonical', () => {
  it('flags an internal canonical whose slug no doc owns', () => {
    const docs = [
      rec({ slug: 'about', canonicalUrl: '/about' }), // self → fine
      rec({ slug: 'team', canonicalUrl: '/ghost-page' }), // dangling
    ]
    const stats = findDanglingCanonicals(docs)
    expect(stats.count).toBe(1)
    expect(stats.docs[0].slug).toBe('team')
    expect(stats.severity).toBe('warning')
  })

  it('does not flag self-canonicals or known targets', () => {
    const docs = [
      rec({ slug: 'about', canonicalUrl: '/about' }),
      rec({ slug: 'contact', canonicalUrl: '/about' }), // points to a known slug → not dangling
    ]
    expect(findDanglingCanonicals(docs).count).toBe(0)
  })

  it('never flags the homepage / root canonical', () => {
    const docs = [rec({ slug: 'foo', canonicalUrl: '/' }), rec({ slug: 'bar', canonicalUrl: 'https://site.com' })]
    expect(findDanglingCanonicals(docs, { siteUrl: 'https://site.com' }).count).toBe(0)
  })

  it('skips absolute canonicals on another origin (external) and unknown-origin ones without siteUrl', () => {
    const docs = [
      rec({ slug: 'a', canonicalUrl: 'https://other.com/ghost' }),
      rec({ slug: 'b', canonicalUrl: 'https://anything.com/ghost' }),
    ]
    expect(findDanglingCanonicals(docs, { siteUrl: 'https://site.com' }).count).toBe(0)
    expect(findDanglingCanonicals(docs).count).toBe(0)
  })

  it('detects dangling same-origin absolute canonicals when siteUrl is given', () => {
    const docs = [
      rec({ slug: 'a', canonicalUrl: 'https://site.com/a' }),
      rec({ slug: 'b', canonicalUrl: 'https://site.com/missing' }), // dangling
    ]
    expect(findDanglingCanonicals(docs, { siteUrl: 'https://site.com' }).count).toBe(1)
  })

  it('ignores noindex docs', () => {
    const docs = [rec({ slug: 'a', canonicalUrl: '/ghost', noindex: true })]
    expect(findDanglingCanonicals(docs).count).toBe(0)
  })
})

describe('analyzeIndexationHygiene — composition', () => {
  it('aggregates categories and derives the worst overall severity', () => {
    const docs = [
      // 6 clean indexable pages
      ...Array.from({ length: 6 }, (_, i) => rec({ slug: `clean-${i}`, canonicalUrl: `/clean-${i}` })),
      // mass noindex → 4 of 10 = 40% → fail
      ...Array.from({ length: 4 }, (_, i) => rec({ slug: `hidden-${i}`, noindex: true })),
    ]
    const report = analyzeIndexationHygiene(docs, { siteUrl: 'https://site.com' })
    expect(report.totalDocs).toBe(10)
    expect(report.noindex.severity).toBe('fail')
    expect(report.overallSeverity).toBe('fail')
    expect(report.counters.noindexCount).toBe(4)
  })

  it('reports pass when everything is clean', () => {
    const docs = Array.from({ length: 5 }, (_, i) => rec({ slug: `p-${i}`, canonicalUrl: `/p-${i}` }))
    const report = analyzeIndexationHygiene(docs)
    expect(report.overallSeverity).toBe('pass')
    expect(report.counters).toMatchObject({
      noindexCount: 0,
      duplicatedCanonicalGroups: 0,
      missingCanonicalCount: 0,
      danglingCanonicalCount: 0,
    })
  })

  it('surfaces canonical cannibalization as a warning-level overall', () => {
    const docs = [
      rec({ slug: 'a', canonicalUrl: '/home' }),
      rec({ slug: 'b', canonicalUrl: '/home' }),
      rec({ slug: 'home', canonicalUrl: '/home' }),
    ]
    const report = analyzeIndexationHygiene(docs)
    expect(report.canonical.duplicated.groups).toHaveLength(1)
    expect(report.overallSeverity).toBe('warning')
  })
})
