<!-- Header Banner -->
<div align="center">

  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=700&lines=%40consilioweb%2Fseo-analyzer;Payload+CMS+SEO+Plugin;50%2B+Checks+%7C+French+Readability;Admin+Dashboard+Suite" alt="Typing SVG" />
  </a>

  <br><br>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/Payload%20CMS-3.x-0F172A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&logoColor=white" alt="Payload CMS 3">
  <img src="https://img.shields.io/badge/SEO-50%2B%20Checks-10B981?style=for-the-badge" alt="50+ Checks">
  <img src="https://img.shields.io/badge/French-Readability-3B82F6?style=for-the-badge" alt="French Readability">
  <img src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge" alt="MIT License">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## About

> **@consilioweb/seo-analyzer** — A comprehensive SEO analysis plugin for Payload CMS 3 with 50+ checks, French readability scoring, native Lexical JSON support, and a full admin dashboard suite.

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/seo.png" width="50"/><br>
      <b>50+ SEO Checks</b><br>
      <sub>17 rule groups</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/dashboard-layout.png" width="50"/><br>
      <b>9 Admin Views</b><br>
      <sub>Full dashboard suite</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/france.png" width="50"/><br>
      <b>French Readability</b><br>
      <sub>Flesch-Kincaid FR</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/api-settings.png" width="50"/><br>
      <b>20+ Endpoints</b><br>
      <sub>REST API</sub>
    </td>
  </tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Overview

`@consilioweb/seo-analyzer` adds a complete SEO toolkit directly into your Payload CMS admin panel. It runs **50+ on-page SEO checks** in real time as editors write content, with specialized support for **French-language readability** (Flesch-Kincaid / Kandel-Moles adaptation) and **native parsing of Payload's Lexical rich text** format.

The plugin provides **9 dedicated admin views**, **5 auto-managed collections**, **20+ API endpoints**, and automatic behaviors like slug-change redirect creation and score history tracking — all configured through a single plugin call.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Admin Views](#admin-views)
- [API Endpoints](#api-endpoints)
- [SEO Rules Reference](#seo-rules-reference)
- [Collections](#collections)
- [Fields Added to Collections](#fields-added-to-collections)
- [Programmatic Usage](#programmatic-usage)
- [Page Type Detection](#page-type-detection)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [License](#license)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Features

### SEO Analysis Engine (50+ Checks)

The core analyzer runs **17 rule groups** covering every aspect of on-page SEO:

- **Title** — length (30-60 chars), keyword presence and position, duplicate brand detection, power words, numbers, questions, emotional words
- **Meta Description** — length (120-160 chars), keyword presence, call-to-action verbs
- **URL / Slug** — length, format validation, keyword presence, French stop word detection
- **Headings** — unique H1, keyword in H1/H2, heading hierarchy, H1 vs title differentiation, heading frequency
- **Content** — word count by page type, keyword in introduction, keyword density (0.5%-2.5%), placeholder detection, thin content, keyword distribution across content tiers, list detection
- **Images** — alt text coverage (80%+ threshold), keyword in alt, image presence and quantity
- **Linking** — internal links (3+ recommended), external links, generic anchor detection, empty link detection
- **Social** — OG image, title truncation on social platforms, description length for Facebook/LinkedIn
- **Schema** — structured data readiness (title + description + image)
- **Readability** — Flesch FR score, long sentences, long paragraphs, passive voice, transition words, consecutive same-start sentences, long sections without subheadings
- **Quality** — duplicate/placeholder content detection, substantial content validation
- **Secondary Keywords** — presence in title, description, content, and H2/H3 headings (up to 3 secondary keywords)
- **Cornerstone** — enhanced checks for pillar content (1500+ words, 5+ internal links, mandatory keyword)
- **Freshness** — content age tracking, review dates, year references, thin content aging penalty
- **Technical** — canonical URL validation, robots meta directives (noindex/nofollow)
- **Accessibility** — short anchors, alt text quality, empty headings, duplicate adjacent links, all-caps headings, link density ratio, camera filename detection, alt-heading redundancy
- **E-commerce** — price detection, product description length, image count, brand in title, price in meta, review readiness, availability status

### French Readability (Flesch-Kincaid FR)

Adapted Flesch-Kincaid formula for French text using the **Kandel-Moles coefficients**. French naturally produces lower Flesch scores than English due to longer words (suffixes like `-tion`, `-ment`, `-ité`) and structurally longer sentences. The thresholds are calibrated accordingly:

| Level | Score | Equivalent in English |
|-------|-------|-----------------------|
| Pass | >= 40 | ~55-65 |
| Warning | >= 25 | ~35-45 |
| Fail | < 25 | < 35 |

Includes French-specific **passive voice detection** (excludes passé composé with être-verbs) and a curated list of **30+ French transition words**.

### Native Lexical JSON Support

Natively parses Payload CMS Lexical rich text JSON structures with:

- Recursive text extraction (configurable max depth, default: 50)
- Heading extraction with tag and text
- Link extraction (internal/external) with anchor text
- Image extraction with alt text analysis
- List detection (ordered/unordered) for featured snippet optimization
- Support for nested blocks, columns, and all standard Payload block types

### Admin Dashboard Suite (9 Views)

| View | Path | Description |
|------|------|-------------|
| **SEO Dashboard** | `/admin/seo` | Sortable table of all pages/posts with scores, inline editing, bulk actions, filters |
| **Sitemap Audit** | `/admin/sitemap-audit` | Orphan pages, weak pages, broken internal links, hub detection, link graph analysis |
| **SEO Configuration** | `/admin/seo-config` | Site name, ignored slugs, disabled rules, custom thresholds, sitemap and breadcrumb settings |
| **Redirect Manager** | `/admin/redirects` | Full CRUD for 301/302 redirects with CSV import, test tool, and bulk operations |
| **Cannibalization** | `/admin/cannibalization` | Detect keyword cannibalization across pages sharing the same focus keyword |
| **Performance** | `/admin/performance` | Google Search Console data import (CSV/XLSX), trend charts, position tracking |
| **Keyword Research** | `/admin/keyword-research` | Keyword suggestions based on existing content, gap analysis |
| **Schema Builder** | `/admin/schema-builder` | Visual JSON-LD schema.org structured data generation |
| **Link Graph** | `/admin/link-graph` | Internal link structure visualization with hub and orphan detection |

### Editor Sidebar Components

- **SeoAnalyzer** — Real-time SEO scoring widget in the document editor sidebar with pass/warning/fail indicators, actionable tips, and grouped checks
- **Score History Chart** — Inline score trend visualization over time
- **Content Decay Section** — Freshness and aging indicators
- **Social Preview** — Facebook and Twitter card preview

### Automatic Behaviors

- **Auto-redirect on slug change** — Creates a 301 redirect when a document's slug is modified (with redirect chain detection)
- **Score history tracking** — Records SEO score snapshots on every document save via afterChange hook
- **Cache warm-up** — Pre-loads collection data on startup and hourly for instant dashboard response
- **SEO Logs (404 monitoring)** — Tracks 404 errors with hit count, referrer, and user agent for proactive redirect management

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Installation

```bash
pnpm add @consilioweb/seo-analyzer
```

Or with npm/yarn:

```bash
npm install @consilioweb/seo-analyzer
yarn add @consilioweb/seo-analyzer
```

### Peer Dependencies

The plugin requires Payload CMS 3.x. The following peer dependencies are optional but recommended for full admin UI features:

| Package | Version | Required |
|---------|---------|----------|
| `payload` | `^3.0.0` | **Yes** |
| `@payloadcms/next` | `^3.0.0` | Optional (admin views) |
| `@payloadcms/ui` | `^3.0.0` | Optional (admin UI) |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional (admin UI) |
| `xlsx` | `>=0.18.0` | Optional (XLSX import in Performance view) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Quick Start

Add the plugin to your `payload.config.ts`:

```ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@consilioweb/seo-analyzer'

export default buildConfig({
  // ... your existing config
  plugins: [
    seoPlugin({
      collections: ['pages', 'posts'],
    }),
  ],
})
```

That's it. The plugin will automatically:

1. Add SEO fields (`focusKeyword`, `focusKeywords`, `isCornerstone`) and the SeoAnalyzer sidebar widget to the specified collections
2. Create 5 managed collections for score history, performance data, settings, redirects, and 404 logs
3. Register 20+ API endpoints under `/api/seo-plugin/`
4. Add 9 admin views with a collapsible navigation group
5. Attach `beforeChange` (auto-redirect) and `afterChange` (score tracking) hooks to target collections
6. Start background cache warm-up on server init

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Configuration

### `SeoPluginConfig`

```ts
seoPlugin({
  // All options are optional — sensible defaults are used
  collections: ['pages', 'posts'],
  addDashboardView: true,
  addSitemapAuditView: true,
  disabledRules: [],
  overrideWeights: {},
  thresholds: {},
  localSeoSlugs: [],
  siteName: undefined,
  endpointBasePath: '/seo-plugin',
  trackScoreHistory: true,
  redirectsCollection: 'seo-redirects',
  knownRoutes: [],
  seoLogsSecret: undefined,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `collections` | `string[]` | `['pages', 'posts']` | Collections to add SEO fields and hooks to |
| `addDashboardView` | `boolean` | `true` | Register the SEO dashboard and all admin views |
| `addSitemapAuditView` | `boolean` | `true` | Register the sitemap audit view |
| `disabledRules` | `RuleGroup[]` | `[]` | Rule groups to skip entirely during analysis |
| `overrideWeights` | `Partial<Record<RuleGroup, number>>` | `{}` | Override the weight of all checks in a rule group |
| `thresholds` | `SeoThresholds` | See below | Custom thresholds for analysis checks |
| `localSeoSlugs` | `string[]` | `[]` | Additional slugs recognized as local SEO pages |
| `siteName` | `string` | `undefined` | Site name for brand duplicate detection in titles |
| `endpointBasePath` | `string` | `'/seo-plugin'` | Base path prefix for all API endpoints |
| `trackScoreHistory` | `boolean` | `true` | Enable score history collection and afterChange tracking hook |
| `redirectsCollection` | `string` | `'seo-redirects'` | Slug for the auto-created redirects collection |
| `knownRoutes` | `string[]` | `[]` | Dynamic routes that should not be flagged as broken links |
| `seoLogsSecret` | `string` | `undefined` | Shared secret for the SEO logs POST endpoint (middleware auth) |

### `SeoThresholds`

All thresholds are optional. Defaults are used when omitted.

| Threshold | Type | Default | Description |
|-----------|------|---------|-------------|
| `titleLengthMin` | `number` | `30` | Minimum meta title length (characters) |
| `titleLengthMax` | `number` | `60` | Maximum meta title length (characters) |
| `metaDescLengthMin` | `number` | `120` | Minimum meta description length |
| `metaDescLengthMax` | `number` | `160` | Maximum meta description length |
| `minWordsGeneric` | `number` | `300` | Minimum word count for generic pages |
| `minWordsPost` | `number` | `800` | Minimum word count for blog posts |
| `keywordDensityMin` | `number` | `0.5` | Minimum keyword density (%) |
| `keywordDensityMax` | `number` | `3` | Maximum keyword density (%) |
| `fleschScorePass` | `number` | `40` | Flesch FR passing score threshold |
| `slugMaxLength` | `number` | `75` | Maximum slug length (characters) |

### `RuleGroup` Values

```ts
type RuleGroup =
  | 'title'
  | 'meta-description'
  | 'url'
  | 'headings'
  | 'content'
  | 'images'
  | 'linking'
  | 'social'
  | 'schema'
  | 'readability'
  | 'quality'
  | 'secondary-keywords'
  | 'cornerstone'
  | 'freshness'
  | 'technical'
  | 'accessibility'
  | 'ecommerce'
```

### Advanced Configuration Example

```ts
import { seoPlugin } from '@consilioweb/seo-analyzer'

export default buildConfig({
  plugins: [
    seoPlugin({
      collections: ['pages', 'posts', 'products'],
      siteName: 'My Website',
      endpointBasePath: '/seo',
      knownRoutes: ['blog', 'products', 'categories'],
      localSeoSlugs: ['plumber-paris', 'plumber-lyon'],
      disabledRules: ['social', 'schema'],
      overrideWeights: {
        readability: 1,     // Lower weight for readability checks
        cornerstone: 5,     // Higher weight for cornerstone checks
      },
      thresholds: {
        titleLengthMax: 65,
        minWordsPost: 1000,
        fleschScorePass: 35,
      },
      seoLogsSecret: process.env.SEO_LOGS_SECRET,
    }),
  ],
})
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Admin Views

### SEO Dashboard (`/admin/seo`)

The main dashboard displays a sortable, filterable table of all pages and posts with their SEO scores. Features include:

- Color-coded score badges (excellent/good/ok/poor)
- Sortable columns: score, title, word count, focus keyword, H1, OG image, links, readability
- Quick filters: missing meta, missing H1, low readability
- Inline editing of meta title and description
- Bulk actions: export CSV, mark/unmark cornerstone
- Checkboxes for multi-selection
- Score trend indicators (up/down arrows)
- Multi-keyword display
- Quick links to edit each document

### Sitemap Audit (`/admin/sitemap-audit`)

Analyzes your site's internal structure to identify:

- **Orphan pages** — pages with no internal links pointing to them
- **Weak pages** — pages with few incoming links (with anchor text display)
- **Broken internal links** — links pointing to non-existent pages (with fix suggestions)
- **Hub pages** — pages with the most outgoing internal links
- **One-click 301 redirect creation** for broken links
- **SEO scores** alongside orphan and weak pages
- **Hover previews** with contextual information
- **Export** — JSON and CSV download of the full link graph

### SEO Configuration (`/admin/seo-config`)

Centralized settings management:

- Site name (for brand duplicate detection)
- Ignored slugs (excluded from audits)
- Disabled rule groups
- Custom thresholds (title length, word counts, etc.)
- Sitemap configuration (excluded slugs, change frequency, priority overrides)
- Breadcrumb configuration (separator, home label, display options)

### Redirect Manager (`/admin/redirects`)

Full redirect management with:

- CRUD operations for 301/302 redirects
- CSV import for bulk redirect creation
- Redirect test tool (verify where a URL redirects)
- Bulk delete operations

### Cannibalization Detection (`/admin/cannibalization`)

Identifies pages competing for the same keywords by detecting documents that share identical focus keywords.

### Performance Tracking (`/admin/performance`)

Import and visualize Google Search Console data:

- CSV and XLSX file import (supports French GSC headers)
- Click, impression, CTR, and position tracking
- Trend visualization over time
- Per-URL and per-query breakdowns

### Keyword Research (`/admin/keyword-research`)

Keyword analysis based on your existing content:

- Keyword suggestions derived from current pages
- Gap analysis to identify missing keyword coverage

### Schema Builder (`/admin/schema-builder`)

Visual tool for generating JSON-LD structured data (schema.org) markup for your pages.

### Link Graph (`/admin/link-graph`)

Interactive visualization of your site's internal linking structure:

- Node-based graph representation
- Hub and orphan page identification
- Link equity flow analysis

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## API Endpoints

All endpoints are prefixed with the configured `endpointBasePath` (default: `/seo-plugin`). All endpoints require an authenticated admin user unless noted otherwise.

| Method | Path | Description |
|--------|------|-------------|
| `GET` `POST` | `/validate` | Run SEO analysis on a document |
| `GET` | `/check-keyword` | Check for keyword duplication across collections |
| `GET` | `/audit` | Full site-wide SEO audit |
| `GET` | `/history` | Score history data for trend charts |
| `GET` | `/sitemap-audit` | Sitemap structure audit |
| `GET` `PATCH` | `/settings` | Read or update SEO settings |
| `POST` | `/suggest-links` | Internal link suggestions for a page |
| `POST` | `/create-redirect` | Create a single redirect entry |
| `GET` `POST` `PATCH` `DELETE` | `/redirects` | Full CRUD for redirect management |
| `POST` | `/ai-generate` | AI-powered meta title/description generation |
| `GET` | `/cannibalization` | Detect keyword cannibalization |
| `POST` | `/external-links` | Check external link status (live HTTP checks with SSRF protection) |
| `GET` | `/sitemap-config` | Sitemap configuration data |
| `GET` `POST` | `/performance` | Read or import performance data (CSV/XLSX) |
| `GET` | `/keyword-research` | Keyword suggestions and gap analysis |
| `GET` | `/breadcrumb` | Breadcrumb configuration and data |
| `GET` | `/link-graph` | Internal link graph data |
| `GET` `POST` `DELETE` | `/seo-logs` | 404 log management (POST supports secret-header auth) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## SEO Rules Reference

### Scoring Algorithm

Each check has a **weight** (1-5) and produces a **status** (`pass`, `warning`, or `fail`):

- **Pass** — earns 100% of weight points
- **Warning** — earns 50% of weight points
- **Fail** — earns 0 points

**Final score** = `round(earnedPoints / maxPoints * 100)`

| Level | Score Range |
|-------|-------------|
| Excellent | >= 91 |
| Good | >= 71 |
| OK | >= 41 |
| Poor | < 41 |

### Complete Check List

<details>
<summary><strong>Title (9 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `title-missing` | 3 | Critical | Meta title is present |
| `title-length` | 3 | Critical | Title between 30-60 characters |
| `title-keyword` | 3 | Critical | Focus keyword in title |
| `title-keyword-position` | 2 | Important | Keyword in first half of title |
| `title-duplicate-brand` | 2 | Important | No duplicate brand name |
| `title-power-words` | 1 | Bonus | Contains power words |
| `title-has-number` | 1 | Bonus | Contains a number (+36% CTR) |
| `title-is-question` | 1 | Bonus | Question format (Featured Snippet friendly) |
| `title-sentiment` | 1 | Bonus | Contains emotional words |

</details>

<details>
<summary><strong>Meta Description (4 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `meta-desc-missing` | 3 | Critical | Meta description is present |
| `meta-desc-length` | 3 | Critical | Length between 120-160 characters |
| `meta-desc-keyword` | 3 | Critical | Focus keyword in description |
| `meta-desc-cta` | 2 | Important | Contains action verb or CTA pattern |

</details>

<details>
<summary><strong>URL / Slug (5 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `slug-missing` | 2 | Important | Slug is defined |
| `slug-length` | 2 | Important | Slug under 75 characters |
| `slug-format` | 2 | Important | Lowercase, no special characters |
| `slug-keyword` | 2 | Important | Focus keyword in slug |
| `slug-stopwords` | 1 | Bonus | No French stop words |

</details>

<details>
<summary><strong>Headings (6 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `h1-missing` / `h1-unique` | 2 | Important | Exactly one H1 per page |
| `h1-keyword` | 2 | Important | Keyword in H1 |
| `heading-hierarchy` | 2 | Important | Proper heading hierarchy (no level skip) |
| `h2-keyword` | 2 | Important | Keyword in at least one H2 |
| `heading-frequency` | 1 | Bonus | One subheading every ~300 words |
| `h1-title-different` | 1 | Important | H1 differs from meta title |

</details>

<details>
<summary><strong>Content (7 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `content-wordcount` | 2 | Important | Meets minimum word count by page type |
| `content-keyword-intro` | 2 | Important | Keyword in first paragraph |
| `content-keyword-density` | 2-3 | Important/Critical | Density between 0.5%-2.5% |
| `content-no-placeholder` | 3 | Critical | No lorem ipsum, TODO, or placeholders |
| `content-thin` | 2 | Important | Not thin content (>100 words) |
| `content-keyword-distribution` | 2 | Important | Keyword in 2+ of 3 content tiers |
| `content-has-lists` | 1 | Bonus | Contains ordered/unordered lists |

</details>

<details>
<summary><strong>Images (4 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `images-alt` | 2 | Important | Alt text on 80%+ of images |
| `images-alt-keyword` | 1 | Bonus | Keyword in at least one alt text |
| `images-present` | 2 | Important | At least one image |
| `images-quantity` | 1-2 | Bonus/Important | Multiple images for posts |

</details>

<details>
<summary><strong>Linking (4 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `linking-internal` | 2 | Important | At least one internal link (3+ ideal) |
| `linking-external` | 1 | Bonus | At least one external link |
| `linking-generic-anchors` | 2 | Important | No generic anchor text |
| `linking-empty` | 2 | Important | No empty links |

</details>

<details>
<summary><strong>Social (3 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `social-og-image` | 2 | Important | OG/meta image defined |
| `social-title-truncation` | 1 | Bonus | Title within social platform limits (~65 chars) |
| `social-desc-length` | 1 | Bonus | Description within Facebook/LinkedIn limits (~155 chars) |

</details>

<details>
<summary><strong>Schema (1 check)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `schema-readiness` | 1 | Bonus | Page has enough metadata for JSON-LD generation |

</details>

<details>
<summary><strong>Readability (7 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `readability-flesch` | 2 | Important | Flesch FR reading ease score >= 40 |
| `readability-long-sentences` | 2 | Important | Less than 30% sentences over 25 words |
| `readability-long-paragraphs` | 2 | Important | No paragraphs over 150 words |
| `readability-passive` | 2 | Important | Less than 15% passive voice |
| `readability-transitions` | 1 | Bonus | 15%+ sentences with transition words |
| `readability-consecutive-starts` | 1 | Bonus | No 3+ consecutive sentences with same first word |
| `readability-long-sections` | 2 | Important | No sections >400 words without subheadings |

</details>

<details>
<summary><strong>Quality (2 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `quality-no-duplicate` | 3 | Critical | No duplicate or generic content |
| `quality-substantial` | 3 | Critical | Enough content substance (>50 words fail, >200 warning) |

</details>

<details>
<summary><strong>Secondary Keywords (4 checks per keyword, up to 3 keywords)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `secondary-kw-title-*` | 1 | Bonus | Secondary keyword in title |
| `secondary-kw-desc-*` | 1 | Bonus | Secondary keyword in description |
| `secondary-kw-content-*` | 1 | Bonus | Secondary keyword in content |
| `secondary-kw-heading-*` | 1 | Bonus | Secondary keyword in H2/H3 |

</details>

<details>
<summary><strong>Cornerstone (4 checks, only when isCornerstone is true)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `cornerstone-wordcount` | 4 | Important | 1500+ words for pillar content |
| `cornerstone-internal-links` | 4 | Important | 5+ internal links |
| `cornerstone-focus-keyword` | 5 | Critical | Focus keyword is defined |
| `cornerstone-meta-description` | 5 | Critical | Meta description is present and optimized |

</details>

<details>
<summary><strong>Freshness (4 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `freshness-age` | 1-3 | Bonus/Important | Content updated within 6/12 months |
| `freshness-reviewed` | 2 | Bonus | Content reviewed within 6 months |
| `freshness-year-ref` | 2 | Important | Current year referenced in content |
| `freshness-thin-aging` | 3 | Important | Thin + old content penalty |

</details>

<details>
<summary><strong>Technical (3 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `canonical-*` | 2 | Important | Canonical URL is valid and correctly set |
| `robots-noindex` | 2-3 | Important/Critical | Noindex directive detection |
| `robots-nofollow` | 2 | Important | Nofollow directive detection |

</details>

<details>
<summary><strong>Accessibility (8 checks)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `a11y-short-anchors` | 2 | Important | No links with text under 3 characters |
| `a11y-alt-quality` | 2 | Important | No generic or filename-based alt texts |
| `a11y-empty-headings` | 3 | Critical | No empty heading tags |
| `a11y-duplicate-links` | 1 | Bonus | No adjacent duplicate links |
| `a11y-all-caps` | 1 | Bonus | No all-caps headings |
| `a11y-link-density` | 2 | Important | Link text ratio under 30% of content |
| `a11y-image-filename` | 2 | Important | No camera default filenames in alt |
| `a11y-alt-duplicates-context` | 1 | Bonus | Alt text differs from adjacent headings |

</details>

<details>
<summary><strong>E-commerce (7 checks, only when isProduct is true)</strong></summary>

| Check ID | Weight | Category | Description |
|----------|--------|----------|-------------|
| `product-price-mentioned` | 2 | Important | Price visible in content |
| `product-short-description` | 2 | Important | Description >= 100 words |
| `product-has-images` | 3 | Critical | At least 2 product images |
| `product-title-includes-brand` | 1 | Bonus | Brand/keyword in meta title |
| `product-meta-includes-price` | 1 | Bonus | Price in meta description |
| `product-review-readiness` | 1 | Bonus | Review/rating content detected |
| `product-availability` | 2 | Important | Availability status mentioned |

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Collections

The plugin automatically creates and manages these collections (all hidden from admin nav, managed via plugin views):

| Collection | Slug | Description |
|------------|------|-------------|
| **SEO Score History** | `seo-score-history` | Score snapshots per document (ID, collection, score, level, word count, keyword, checks summary, date) |
| **SEO Performance** | `seo-performance` | Search Console data (URL, query, clicks, impressions, CTR, position, date, source) |
| **SEO Settings** | `seo-settings` | Site-wide config (site name, ignored slugs, disabled rules, thresholds, sitemap config, breadcrumb config) |
| **SEO Redirects** | `seo-redirects` | 301/302 redirect rules (from, to, type). Slug is configurable via `redirectsCollection` |
| **SEO Logs** | `seo-logs` | 404 error tracking (URL, type, hit count, last seen, referrer, user agent, ignored flag) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Fields Added to Collections

The plugin adds the following fields to each target collection specified in `collections`:

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `isCornerstone` | `checkbox` | Sidebar | Marks the document as pillar/cornerstone content (triggers enhanced checks) |
| `focusKeyword` | `text` | Sidebar | Primary SEO focus keyword for analysis |
| `seoAnalyzer` | `ui` | Sidebar | Real-time SEO analysis widget with score, checks, and actionable tips |
| `focusKeywords` | `array` (max 3) | Collapsible group | Secondary focus keywords for additional coverage |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Programmatic Usage

The analyzer can be used independently of the Payload plugin system:

```ts
import { analyzeSeo } from '@consilioweb/seo-analyzer'
import type { SeoInput, SeoConfig } from '@consilioweb/seo-analyzer'

const input: SeoInput = {
  metaTitle: 'My Page Title - Brand',
  metaDescription: 'A comprehensive description of my page for search engines...',
  slug: 'my-page',
  focusKeyword: 'my keyword',
  heroTitle: 'Welcome to My Page',
  heroRichText: { /* Lexical JSON root node */ },
  blocks: [ /* Payload layout blocks */ ],
  content: { /* Lexical JSON for posts */ },
  isPost: false,
  isProduct: false,
  isCornerstone: false,
  updatedAt: '2025-06-01T00:00:00Z',
}

const config: SeoConfig = {
  siteName: 'Brand',
  localSeoSlugs: ['paris', 'lyon'],
  disabledRules: ['social'],
  thresholds: { minWordsPost: 1000 },
}

const result = analyzeSeo(input, config)
// {
//   score: 78,
//   level: 'good',
//   checks: [
//     { id: 'title-length', status: 'pass', message: '...', weight: 3, ... },
//     { id: 'content-wordcount', status: 'warning', message: '...', weight: 2, ... },
//     ...
//   ]
// }
```

### Exported Helpers

The package re-exports utility functions for advanced use cases:

```ts
import {
  // Lexical JSON parsing
  extractTextFromLexical,
  extractHeadingsFromLexical,
  extractLinksFromLexical,
  extractImagesFromLexical,
  extractLinkUrlsFromLexical,
  extractListsFromLexical,
  checkImagesInBlocks,

  // Text analysis
  countWords,
  countSentences,
  countSyllablesFR,
  calculateFleschFR,
  detectPassiveVoice,
  hasTransitionWord,
  checkHeadingHierarchy,
  countLongSections,

  // Keyword utilities
  normalizeForComparison,
  slugifyKeyword,
  keywordMatchesText,
  countKeywordOccurrences,

  // Page type detection
  detectPageType,

  // French language utilities
  getStopWordsFR,
  getActionVerbsFR,
  isStopWordInCompoundExpression,

  // Constants (thresholds, limits)
  TITLE_LENGTH_MIN,     // 30
  TITLE_LENGTH_MAX,     // 60
  META_DESC_LENGTH_MIN, // 120
  META_DESC_LENGTH_MAX, // 160
  MIN_WORDS_POST,       // 800
  MIN_WORDS_GENERIC,    // 300
  SCORE_EXCELLENT,      // 91
  SCORE_GOOD,           // 71
  SCORE_OK,             // 41
  POWER_WORDS_FR,       // French power words list
  // ... and more
} from '@consilioweb/seo-analyzer'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Page Type Detection

The analyzer automatically adapts thresholds and check severity based on the detected page type:

| Page Type | Detection Logic | Adapted Behavior |
|-----------|-----------------|------------------|
| `blog` | `isPost: true` | Higher word count threshold (800 words) |
| `home` | Slug is `home` or empty | Standard checks |
| `contact` | Slug contains `contact` | Relaxed: images optional, external links optional, freshness lenient |
| `form` | Slug contains `formulaire`, `devis`, `inscription` | Relaxed: word count min 150, images optional |
| `legal` | Slug matches legal patterns (`mentions-legales`, `cgv`, etc.) | Relaxed: word count min 200, images optional, freshness 24 months |
| `local-seo` | Matches configured `localSeoSlugs` | Standard checks with local SEO context |
| `service` | Slug contains `service`, `prestation` | Standard checks |
| `resource` | Slug contains `ressource`, `guide`, `tutoriel` | Standard checks |
| `generic` | Default fallback | Standard checks (300 words min) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Package Exports

The package provides three entry points for different use contexts:

```ts
// Main entry — plugin, analyzer, types, helpers, constants
import { seoPlugin, analyzeSeo, seoFields } from '@consilioweb/seo-analyzer'

// Client components — React components for Payload admin UI
import {
  SeoAnalyzerField,
  SeoNavLink,
  ScoreHistoryChart,
  ContentDecaySection,
  SeoSocialPreview,
} from '@consilioweb/seo-analyzer/client'

// Server views — admin views wrapped in DefaultTemplate
import {
  SeoView,
  SitemapAuditView,
  SeoConfigView,
  RedirectManagerView,
  CannibalizationView,
  PerformanceView,
  KeywordResearchView,
  SchemaBuilderView,
  LinkGraphView,
} from '@consilioweb/seo-analyzer/views'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Requirements

- **Node.js** >= 18
- **Payload CMS** 3.x
- **React** 18.x or 19.x (for admin UI components)
- **Database**: Any Payload-supported adapter (SQLite, PostgreSQL, MongoDB)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## License

[MIT](LICENSE)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

<div align="center">

### Author

**Made with passion by [ConsilioWEB](https://consilioweb.fr)**

<a href="https://www.linkedin.com/in/christophe-lopez/">
  <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
</a>
<a href="https://github.com/pOwn3d">
  <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
</a>
<a href="https://consilioweb.fr">
  <img src="https://img.shields.io/badge/Website-consilioweb.fr-3B82F6?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website">
</a>

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>
