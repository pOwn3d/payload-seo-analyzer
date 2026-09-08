# @consilioweb/payload-seo-analyzer

> An offline-first SEO toolkit for Payload CMS 3 + Next.js: on-page analysis in the editor sidebar, a nine-view admin dashboard, generated sitemaps and JSON-LD, plus opt-in Google Search Console and AI assists.

[![npm](https://img.shields.io/npm/v/@consilioweb/payload-seo-analyzer.svg)](https://www.npmjs.com/package/@consilioweb/payload-seo-analyzer)
[![license](https://img.shields.io/npm/l/@consilioweb/payload-seo-analyzer.svg)](LICENSE)
[![payload](https://img.shields.io/badge/payload-3.x-000000.svg)](https://payloadcms.com)

## About

Most SEO plugins either stop at meta fields or send your content to a paid third-party API. This one runs
the whole analysis locally: 100+ deterministic checks across 20 rule groups, scored in the editor sidebar
as you type, with no external call and no API key.

It is aimed at Payload 3 sites that ship their own front end in Next.js. Beyond the analyzer it generates
what the front end actually needs — `robots.txt`, four sitemap flavours, canonical URLs, Open Graph
metadata and JSON-LD — and adds an admin dashboard for site-wide work: link graph, redirect manager,
cannibalization, schema builder, keyword research. Google Search Console, AI assists, monitoring alerts
and IndexNow are opt-in and use your own credentials.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Admin Views](#admin-views)
- [Collections](#collections)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [Uninstall](#uninstall)
- [Database and updates](#database-and-updates)
- [Migration to 4.0](#migration-to-40)
- [Migration to 3.0](#migration-to-30)
- [Migration to 2.0](#migration-to-20)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [Support](#support)
- [License](#license)

## Features

- **100+ on-page checks, offline.** 110 static rule ids across 20 groups — title, meta description, URL,
  headings, content, images, linking, social, schema, readability, quality, secondary keywords,
  cornerstone, freshness, technical, accessibility, e-commerce, E-E-A-T, GEO and hreflang.
- **Live score in the editor.** A sidebar field analyses the document (including Lexical rich text and
  layout blocks) and returns a 0–100 score plus a separate AI-readiness indicator built from the GEO,
  E-E-A-T and schema-coverage checks.
- **Nine admin views.** Site-wide audit, sitemap audit, settings, redirect manager, cannibalization,
  performance, keyword research, schema builder and link graph.
- **Generated output, not just advice.** `robots.txt`, `sitemap.xml`, news/image/video sitemaps, an
  opt-in `llms.txt`, plus `buildSeoMetadata` / `buildJsonLd` helpers for your Next.js front end.
- **Bilingual analysis.** Locale-adapted readability (Kandel-Moles for French, Flesch for English),
  FR/EN dashboard translations extensible to any locale, and the 39 `plugin-seo` meta-field languages
  from Payload.
- **Opt-in integrations.** Google Search Console via OAuth, Anthropic-powered assists (meta rewriting,
  alt text, content briefs), a monitoring digest over webhook/email, and IndexNow.
- **Built for small hosts.** Single-flight background audit with tunable throttling, paginated document
  loading with a memory cap, LRU-bounded cache and a build-time audit cache you can generate in CI.

## Installation

```bash
npm install @consilioweb/payload-seo-analyzer
# or
pnpm add @consilioweb/payload-seo-analyzer
# or
yarn add @consilioweb/payload-seo-analyzer
```

`payload@^3` is the only required peer. `next`, `react`, `@payloadcms/next` and `@payloadcms/ui` are
declared optional peers — a Payload 3 admin panel already has all four, so a normal install pulls
nothing extra, but package managers will warn if your versions fall out of the supported ranges (see
[Requirements](#requirements)).

## Quick Start

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'

export default buildConfig({
  // ...your db, collections, admin config
  plugins: [
    seoAnalyzerPlugin({
      collections: ['pages', 'posts'],
      siteUrl: 'https://example.com',
    }),
  ],
})
```

The plugin injects React components into the admin panel, so regenerate the import map, then start:

```bash
pnpm payload generate:importmap
pnpm dev
```

Open `/admin/seo` for the dashboard, or edit any page or post to see the score in the sidebar.

### Frontend metadata and JSON-LD

The same URL rules the sitemap uses are exported as pure functions, safe to call from a Server Component
or `generateMetadata`:

```ts
import { buildSeoMetadata } from '@consilioweb/payload-seo-analyzer'

// `doc` is a Payload document you already fetched
const metadata = buildSeoMetadata(doc, {
  collection: 'posts',
  siteUrl: 'https://example.com',
})
```

```tsx
import { buildJsonLd, serializeJsonLd } from '@consilioweb/payload-seo-analyzer'

const { jsonLd } = buildJsonLd(doc, { collection: 'posts', siteUrl: 'https://example.com' })

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
/>
```

Use `serializeJsonLd` rather than `JSON.stringify` — it escapes `<`, `>`, `&`, U+2028 and U+2029, which
`JSON.stringify` does not (see [Security](#security)).

## Configuration

### Plugin options

Every field of `SeoPluginConfig`. All are optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `collections` | `string[]` | `['pages', 'posts']` | Collections that get SEO fields and are analyzed. |
| `globals` | `string[]` | `[]` | Globals that get SEO fields and are analyzed. |
| `siteUrl` | `string` | `NEXT_PUBLIC_SERVER_URL` / `PAYLOAD_PUBLIC_SERVER_URL` | Base URL for canonicals, sitemaps, JSON-LD and GSC. |
| `siteName` | `string` | — | Used by the "brand duplicated in title" check. |
| `locale` | `'fr' \| 'en'` | `'fr'` | Language of the analysis (readability, stop words, messages). |
| `localeMapping` | `Record<string, 'fr' \| 'en'>` | — | Maps your Payload locale codes onto the analysis locale. |
| `collectionRoutes` | `Record<string, string>` | `{ posts: 'posts' }` | Public route prefix per collection, used by every URL the plugin generates. Set `{ posts: '' }` if posts are served flat at `/<slug>`. |
| `knownRoutes` | `string[]` | `[]` | Dynamic routes with no matching document slug, so they are not reported as broken links or orphans. |
| `features` | `SeoFeatures` | see below | Per-feature on/off switches. |
| `disabledRules` | `RuleGroup[]` | `[]` | Rule groups to skip entirely. |
| `overrideWeights` | `Partial<Record<RuleGroup, number>>` | — | Force the weight of every check in a group. |
| `thresholds` | `SeoThresholds` | constants | Numeric overrides (see below). |
| `localSeoSlugs` | `string[]` | — | Extra slugs to treat as local-SEO pages. |
| `endpointBasePath` | `string` | `'/seo-plugin'` | Path prefix for the REST endpoints, under `/api`. |
| `addDashboardView` | `boolean` | `true` | Set `false` to register no admin view at all. |
| `addSitemapAuditView` | `boolean` | `true` | Set `false` to drop only `/admin/sitemap-audit`. |
| `trackScoreHistory` | `boolean` | `true` | Adds `seo-score-history` plus the `afterChange` hook that feeds it. |
| `redirectsCollection` | `string` | `'seo-redirects'` | Slug of the redirects collection; an existing collection with that slug is reused. |
| `allowExternalRedirects` | `boolean` | `false` | Allow redirect destinations on another origin (absolute `http(s)` URLs). Off by default: an off-site 301 served from your own path carries your domain's authority. Redirects created before you upgraded stay editable — the gate only refuses a destination that *changes*. |
| `uploadsCollection` | `string` | `'media'` | Upload collection used by `meta.image` and the AI alt-text endpoints. |
| `autoCreateMetaFields` | `boolean` | `true` | Adds the `meta` group (title, description, image, preview) to target collections. |
| `seoLogsSecret` | `string` | — | Shared secret for `POST /seo-logs`; when set, the caller sends `X-SEO-Secret` instead of a session. |
| `auditCacheFile` | `string` | — | Path to a JSON audit produced by `buildAuditToFile()`, hydrated on a dashboard cache miss instead of rebuilding live. |
| `generateTitle` | `(args) => string \| Promise<string>` | — | Backs the "auto-generate" button on the meta title. |
| `generateDescription` | `(args) => string \| Promise<string>` | — | Same, for the meta description. |
| `generateImage` | `(args) => string \| number \| Promise<…>` | — | Same, for the meta image (media id or URL). |
| `generateURL` | `(args) => string \| Promise<string>` | — | Builds the document's public URL for previews. |
| `fields` | `({ defaultFields }) => Field[]` | — | Rewrites the contents of the `meta` group. |
| `tabbedUI` | `boolean` | `false` | Wraps collection fields in "Content" / "SEO" tabs. |
| `interfaceName` | `string` | — | TypeScript interface name generated for the `meta` group. |
| `customTranslations` | `Record<string, Partial<DashboardTranslations>>` | — | Dashboard strings for locales beyond FR/EN; missing keys fall back to English. |
| `retentionDays` | `Partial<Record<'seo-rank-history' \| 'seo-score-history' \| 'seo-performance' \| 'seo-logs', number>>` | — | Days of history to keep, per time-series collection. Opt-in: without it nothing is ever deleted. See [Retention](#retention). |

`thresholds` accepts `titleLengthMin`, `titleLengthMax`, `metaDescLengthMin`, `metaDescLengthMax`,
`minWordsGeneric`, `minWordsPost`, `keywordDensityMin`, `keywordDensityMax`, `fleschScorePass` and
`slugMaxLength`.

```ts
seoAnalyzerPlugin({
  collections: ['posts'],
  disabledRules: ['ecommerce'],
  overrideWeights: { social: 1 },
  thresholds: { titleLengthMax: 65, metaDescLengthMax: 165 },
})
```

### Retention

The four time-series collections are append-only: `seo-rank-history` gains a row per tracked query
per day, `seo-score-history` one per document per save, `seo-performance` one per imported Search
Console row, and `seo-logs` one per distinct 404 URL. Nothing trims them, so on a long-lived site
they grow without bound. That is a database-size problem, not a privacy one — the only
visitor-derived values are `referrer` and `userAgent` on `seo-logs`, and no IP address is stored
anywhere.

`retentionDays` is **opt-in**. Without it, behaviour is exactly what it has always been: nothing is
deleted.

```ts
seoAnalyzerPlugin({
  retentionDays: {
    'seo-rank-history': 365,
    'seo-score-history': 180,
    'seo-performance': 400,
    'seo-logs': 90,
  },
})
```

Naming at least one collection:

- schedules a purge 5 minutes after boot and every 24 hours, deleting rows older than the window;
- registers `GET /api/seo-plugin/retention` (dry run — reports the cutoffs, deletes nothing) and
  `POST /api/seo-plugin/retention` (run now), both **SEO-admin only**.

Details worth knowing:

- Each collection is trimmed on **its own date field** — `snapshotDate`, `date` or `lastSeen`, never
  `createdAt`, which three of the four do not have (`timestamps: false`). `seo-logs` is keyed on
  `lastSeen` so a 404 first recorded long ago but still being hit today is kept.
- A value that is not a finite number of at least `1` is **ignored, not clamped**: `0` would mean
  "delete everything".
- Collections are purged one after another, never in parallel — parallel writes are what produce
  `SQLITE_BUSY`.
- The windows come from your config only. The `POST` endpoint reads no body, so no caller can pass
  its own retention.
- `purgeRetention`, `describeRetention` and `resolveRetention` are exported from the package root if
  you would rather run the trim from your own cron.

### Feature flags

`features` gates collections, endpoints and admin views together — turning one off loads less. The core
analyzer sidebar, the `validate` endpoint and the meta fields are always active.

| Flag | Default | What it controls |
|---|---|---|
| `dashboard` | `true` | `/admin/seo`, `/audit`, `/indexation-audit` |
| `sitemapAudit` | `true` | `/admin/sitemap-audit`, `/sitemap-audit`, `/sitemap-config` |
| `settings` | `true` | `/admin/seo-config`, `/settings`, the `seo-settings` collection |
| `redirects` | `true` | `/admin/redirects`, redirect CRUD, the `seo-redirects` collection |
| `performance` | `true` | `/admin/performance`, `/performance`, `/core-web-vitals`, the `seo-performance` collection |
| `linkGraph` | `true` | `/admin/link-graph`, `/link-graph` |
| `keywords` | `true` | `/admin/keyword-research`, `/keyword-research` |
| `cannibalization` | `true` | `/admin/cannibalization`, `/cannibalization` |
| `schemaBuilder` | `true` | `/admin/schema-builder`, `/schema-generator` |
| `scoreHistory` | `true` | `seo-score-history` collection, tracking hook, `/history` |
| `seoLogs` | `true` | `seo-logs` collection and endpoints (404 tracking) |
| `externalLinks` | `true` | `/external-links` |
| `duplicateContent` | `true` | `/duplicate-content` |
| `aiFeatures` | `true` | the seven `ai-*` / `alt-text-audit` endpoints |
| `warmCache` | `true` | background cache warm-up on init and hourly — turn off on low-memory hosts |
| `gscApi` | **`false`** | Google Search Console OAuth, rank tracking, CTR opportunities, content grade, `seo-gsc-auth` + `seo-rank-history` |
| `alerts` | **`false`** | monitoring digest endpoints and scheduler |
| `indexNow` | **`false`** | IndexNow key file and submit endpoint |
| `analyzer` | `true` | always on; cannot be disabled |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SERVER_URL` | — | Fallback base URL when `siteUrl` is not set (`PAYLOAD_PUBLIC_SERVER_URL` is tried next). |
| `ANTHROPIC_API_KEY` | — | Enables the AI assists; without it they fall back to heuristics or return an error. |
| `SEO_AI_MODEL` | `claude-sonnet-4-6` | Model used by `/ai-optimize`, `/ai-optimize-bulk`, `/ai-content-brief` and `/ai-alt-text`. `/ai-rewrite` is pinned to Haiku and `/ai-generate` is purely heuristic, so neither reads it. |
| `SEO_MEDIA_ORIGIN` | — | Extra origin the AI alt-text endpoint may fetch images from, alongside `siteUrl`. |
| `SEO_REQUIRE_ADMIN_ROLE` | — | `1` disables the fail-open in `isSeoAdmin`, requiring an explicit `admin` role. |
| `SEO_ADMIN_USER_COLLECTIONS` | `config.admin.user` | Comma-separated collection slugs accepted as admin-panel users. Only needed if several collections may reach the panel. |
| `SEO_AUDIT_MIN_REFRESH_MS` | `300000` | Minimum delay between two manual (`?nocache=1`) rebuilds of the site-wide audit. |
| `SEO_STRICT_READ_ACCESS` | — | `1` makes single-document reads honour the caller's collection and field-level ACL. |
| `SEO_FETCH_MAX_DOCS` | `5000` | Cap on documents loaded by site-wide helpers. |
| `SEO_AUDIT_MAX_DOCS` | `1500` | Cap on documents included in one site-wide audit. |
| `SEO_AUDIT_BATCH_SIZE` | `10` | Documents analysed per audit batch (capped at 100). |
| `SEO_AUDIT_BATCH_DELAY_MS` | `100` | Pause between audit batches (capped at 5000). |
| `SEO_AUDIT_DOC_DELAY_MS` | `10` | Pause after each document; `0` is fastest, raise it on rich content. |
| `SEO_AUDIT_THROTTLE_RATIO` | `2` | Idle-to-work ratio applied while the audit builds. |
| `SEO_AUDIT_DEPTH` | `0` | Payload `depth` used when loading documents for the audit. |
| `SEO_AUDIT_FILE_CACHE` | — | `0` or `false` ignores `auditCacheFile` and forces a live build. |
| `SEO_AUDIT_TRUST_FILE` | — | `1` serves `auditCacheFile` without the staleness check (for CI-prewarmed deployments). |
| `SEO_SITEMAP_BATCH_SIZE` | `50` | Batch size for the news/image/video sitemaps (capped at 100). |
| `SEO_SITEMAP_MAX_DOCS` | `5000` | Document cap for the news/image/video sitemaps. Counts every document **read**, filtered ones included. |
| `SEO_LOGS_MAX_ROWS` | `5000` | Ceiling on the rows `POST /seo-logs` may create. Past it, known URLs keep incrementing but no new path is recorded. |
| `SEO_LLMS_TXT` | — | `1` enables `/llms.txt`; it returns 404 otherwise. |
| `SEO_INDEXNOW_KEY` | — | IndexNow key, served at `/indexnow-key.txt`. Required by the `indexNow` feature. |
| `GSC_OAUTH_CLIENT_ID` / `GSC_OAUTH_CLIENT_SECRET` | — | Google Cloud OAuth client for the `gscApi` feature. |
| `SEO_GSC_ENCRYPTION_KEY` | — | 32-byte key encrypting the stored GSC tokens (AES-256-GCM). Strongly recommended. |
| `GOOGLE_PAGESPEED_API_KEY` / `PAGESPEED_API_KEY` | — | PageSpeed Insights key for Core Web Vitals; raises the quota. |
| `SEO_ALERT_WEBHOOK_URL` / `SEO_ALERT_EMAIL` | — | Digest delivery for the `alerts` feature. |
| `SEO_ALERT_SCORE_DROP` | `10` | Score drop, in points, that triggers an alert. |
| `SEO_ALERT_POSITION_DROP` | `5` | SERP position drop that triggers an alert. |
| `SEO_ALERT_WINDOW_HOURS` | `24` | Look-back window for the digest. |
| `SEO_ALERT_INTERVAL_HOURS` | `24` | How often the scheduler runs (minimum 1). |

## API Endpoints

All paths are relative to `/api/seo-plugin` (change the prefix with `endpointBasePath`). "Authenticated"
means a logged-in **admin-panel** user — a session on another auth collection (front-office customers,
members, subscribers) does **not** qualify, even though Payload populates `req.user` for it on every
route. The panel collection is `config.admin.user`; widen it with `SEO_ADMIN_USER_COLLECTIONS` if
several collections may reach the panel. "SEO admin" adds a role check on top — a user with
`role: 'admin'` or an `admin` entry in `roles` — including when the host models roles as a
single-value select or as a relationship the plugin can read a name from. It falls back to any
admin-panel user only when the users collection declares **no** `role`/`roles` field at all; a field
that exists but holds an unreadable value (an unpopulated relationship id) denies rather than
promotes, and the plugin logs why. Set `SEO_REQUIRE_ADMIN_ROLE=1` to remove the fallback entirely.

The plugin's **admin views** (`/admin/seo`, `/admin/redirects`, …) apply the same panel-session rule.
Registering a custom view takes its route out of Payload's own `canAccessAdmin` redirect, so the
views check it themselves and send a foreign session to `/admin/unauthorized`.

The plugin's own collections (`seo-settings`, `seo-redirects`, `seo-gsc-auth`, `seo-performance`,
`seo-logs`, `seo-score-history`, `seo-rank-history`) enforce the same rule through their `access`
config, since Payload exposes a REST API for every collection.

### Always registered

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` `POST` | `/validate` | Authenticated | Full analysis of one document or global. |
| `GET` | `/check-keyword` | Authenticated | Whether a focus keyword is already used elsewhere. |
| `POST` | `/generate` | Authenticated | Runs your `generateTitle` / `generateDescription` / `generateImage` / `generateURL`. |
| `POST` | `/suggest-links` | Authenticated | Internal-link suggestions; rate limited to 120/min, index cached 15 min. |
| `GET` | `/breadcrumb` | Authenticated | Breadcrumb trail for a document. |
| `GET` | `/health` | SEO admin | Module health and observability. |
| `GET` | `/robots.txt` | Public | Generated `robots.txt`. |
| `POST` | `/robots.txt` | SEO admin | Saves custom robots rules into `seo-settings`. |
| `GET` | `/sitemap.xml` | Public | Main sitemap. |
| `GET` | `/sitemap-news.xml` `/sitemap-images.xml` `/sitemap-video.xml` | Public | Specialised sitemaps. |
| `GET` | `/llms.txt` | Public | AI-discoverability file; 404 unless `SEO_LLMS_TXT=1`. |

### Feature-gated

| Method | Path | Access | Feature |
|---|---|---|---|
| `GET` | `/audit` | Authenticated | `dashboard` |
| `GET` | `/indexation-audit` | Authenticated | `dashboard` |
| `GET` | `/history` | Authenticated | `scoreHistory` |
| `GET` | `/sitemap-audit`, `/sitemap-config` | Authenticated | `sitemapAudit` |
| `GET` `PATCH` | `/settings` | Authenticated (GET) / SEO admin (PATCH) | `settings` |
| `GET` | `/redirects` | Authenticated | `redirects` |
| `POST` `PATCH` `DELETE` | `/redirects` | SEO admin | `redirects` |
| `POST` | `/create-redirect` | SEO admin | `redirects` |
| `GET` | `/redirect-chains` | Authenticated | `redirects` |
| `GET` | `/cannibalization` | Authenticated | `cannibalization` |
| `POST` | `/external-links` | Authenticated | `externalLinks` |
| `GET` | `/duplicate-content` | Authenticated | `duplicateContent` |
| `GET` | `/link-graph` | Authenticated | `linkGraph` |
| `GET` | `/keyword-research` | Authenticated | `keywords` |
| `GET` | `/schema-generator` | Authenticated | `schemaBuilder` |
| `GET` | `/performance` | Authenticated | `performance` |
| `POST` | `/performance` | SEO admin | `performance` |
| `GET` | `/core-web-vitals` | Authenticated | `performance` |
| `POST` | `/ai-generate`, `/ai-rewrite`, `/ai-optimize`, `/ai-content-brief` | Authenticated | `aiFeatures` |
| `GET` | `/alt-text-audit` | SEO admin | `aiFeatures` |
| `POST` | `/ai-alt-text`, `/ai-optimize-bulk` | SEO admin | `aiFeatures` |
| `GET` | `/seo-logs` | Authenticated | `seoLogs` |
| `POST` | `/seo-logs` | `X-SEO-Secret` header, or SEO admin when no `seoLogsSecret` is set | `seoLogs` |
| `DELETE` | `/seo-logs` | SEO admin | `seoLogs` |
| `GET` | `/gsc/status` | Authenticated | `gscApi` |
| `GET` | `/gsc/auth`, `/gsc/callback`, `/gsc/data` | SEO admin | `gscApi` |
| `POST` | `/gsc/disconnect` | SEO admin | `gscApi` |
| `POST` | `/rank-snapshot` | SEO admin | `gscApi` |
| `GET` | `/rank-history`, `/ctr-opportunities`, `/content-grade` | SEO admin | `gscApi` |
| `GET` | `/alerts-digest` | SEO admin | `alerts` |
| `POST` | `/alerts-run` | SEO admin | `alerts` |
| `GET` | `/indexnow-key.txt` | Public (search engines verify it) | `indexNow` |
| `POST` | `/indexnow-submit` | SEO admin | `indexNow` |
| `GET` | `/retention` | SEO admin | registered only when `retentionDays` is set |
| `POST` | `/retention` | SEO admin | registered only when `retentionDays` is set |

Expensive endpoints are rate limited to 10 requests per minute, keyed by user id and falling back to the
client IP; the polled ones (`/audit`, `/suggest-links`) get 120 per minute instead.

## Admin Views

| Path | View | Feature |
|---|---|---|
| `/admin/seo` | Site-wide dashboard and audit | `dashboard` |
| `/admin/sitemap-audit` | Sitemap coverage, broken links, orphans | `sitemapAudit` |
| `/admin/seo-config` | Settings, thresholds, robots, sitemap options | `settings` |
| `/admin/redirects` | Redirect manager (CRUD, CSV import, chain detection) | `redirects` |
| `/admin/cannibalization` | Pages competing on the same query | `cannibalization` |
| `/admin/performance` | Search Console data and Core Web Vitals | `performance` |
| `/admin/keyword-research` | Keyword research and coverage | `keywords` |
| `/admin/schema-builder` | JSON-LD builder per document type | `schemaBuilder` |
| `/admin/link-graph` | Internal link graph and crawl budget | `linkGraph` |

A nav link to the dashboard is appended to `afterNavLinks`.

## Collections

Created by the plugin, only when the matching feature is on.

| Slug | Role | Read | Write | Feature |
|---|---|---|---|---|
| `seo-settings` | Thresholds, sitemap and robots configuration | Authenticated | SEO admin | `settings` |
| `seo-redirects` | Redirect rules (slug configurable) | Authenticated | SEO admin | `redirects` |
| `seo-score-history` | Score snapshots per document | Authenticated | Create: authenticated; update/delete: `role: 'admin'` | `scoreHistory` |
| `seo-performance` | Imported Search Console rows | Authenticated | Authenticated | `performance` |
| `seo-logs` | 404 tracking | Authenticated | SEO admin | `seoLogs` |
| `seo-gsc-auth` | OAuth tokens, encrypted at rest and never readable through the API | Authenticated | SEO admin | `gscApi` |
| `seo-rank-history` | Daily rank snapshots from GSC | Authenticated | `role: 'admin'` | `gscApi` |

If a collection with the `redirectsCollection` slug already exists in your config, the plugin uses yours
instead of creating its own.

## Package Exports

| Entry | Contents | Environment |
|---|---|---|
| `@consilioweb/payload-seo-analyzer` | `seoAnalyzerPlugin` (alias `seoPlugin`), `analyzeSeo`, the frontend helpers, field builders (`seoFields`, `metaFields`), endpoint handler factories, `buildAuditToFile`, the extraction helpers, the scoring constants and every type | Server / isomorphic |
| `@consilioweb/payload-seo-analyzer/client` | The admin React components (`SeoAnalyzerField`, the nine views, meta field components, `SerpPreview`, `SeoNavLink`) | Client (`'use client'`) |
| `@consilioweb/payload-seo-analyzer/views` | Server view wrappers that render each dashboard view inside Payload's `DefaultTemplate` | Server (RSC) |

Both ESM and CJS builds ship, with their own type declarations. `sideEffects` is limited to the client
bundle, so the root and `views` entries tree-shake.

### Frontend helpers

| Function | Signature | Purpose |
|---|---|---|
| `buildSeoMetadata` | `(doc, options?) => SeoMetadata` | Title, description, canonical, robots, Open Graph and Twitter tags. Shape-compatible with Next.js `Metadata`. |
| `buildJsonLd` | `(doc, options?) => { type, jsonLd }` | Schema.org object for the document, type auto-detected from the collection unless forced. |
| `renderJsonLdScript` | `(doc, options?) => string` | The complete `<script type="application/ld+json">` tag, already escaped. |
| `serializeJsonLd` | `(jsonLd) => string` | XSS-safe JSON for `dangerouslySetInnerHTML`. |
| `buildDocPath` / `buildDocUrl` | `(…, collection?, collectionRoutes?)` | The exact public path or URL the sitemap, canonical and JSON-LD use. |
| `analyzeSeo` | `(input, config?) => SeoAnalysis` | Runs the whole engine outside Payload. |

`buildSeoMetadata` and `buildJsonLd` both take `collection` and `collectionRoutes`; pass the same
`collectionRoutes` you gave the plugin, or the URLs they produce will not match the sitemap.

The second argument of `analyzeSeo` is a `SeoConfig`, the analyzer's own config type. `siteUrl`,
`siteName`, `locale`, `disabledRules`, `overrideWeights`, `thresholds`, `localSeoSlugs` and
`collectionRoutes` behave exactly as in [Plugin options](#plugin-options) — the plugin forwards them
for you. Two fields exist only here, so they are reachable only by calling `analyzeSeo` directly:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `stopWordCompounds` | `Array<readonly [string, string]>` | built-in FR/EN list | Extra compound expressions whose stop words are tolerated in a slug; appended to the defaults. |
| `maxRecursionDepth` | `number` | `50` | Depth limit when walking a Lexical tree to extract text. |

## Requirements

| Dependency | Range | Required |
|---|---|---|
| `payload` | `^3.0.0` | Yes |
| `next` | `^15.2.0 \|\| ^16.0.0` | Optional peer (needed by the admin components) |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional peer |
| `@payloadcms/next` | `^3.0.0` | Optional peer |
| `@payloadcms/ui` | `^3.0.0` | Optional peer |
| Node.js | `^20.19.0 \|\| >=22.12.0` | Yes (`engines`) |

Node 18 is not supported from 2.0.0 on. CI runs the suite on Node 20 and 22.

## Uninstall

```bash
npx seo-analyzer-uninstall
```

The script runs three steps: it removes the package's imports and `seoAnalyzerPlugin(...)` calls from
your source files, runs the removal command for your package manager, then regenerates the import map.
It exits with code `1` and lists the failing commands if either of the last two did not complete.

**It never touches your database**, and it prints what is left behind:

- The seven plugin tables you may drop (`seo-gsc-auth`, `seo-settings`, `seo-redirects`,
  `seo-score-history`, `seo-performance`, `seo-logs`, `seo-rank-history`). Drop **`seo-gsc-auth`
  first**: it holds an encrypted Google OAuth refresh token and the connected account's email, and
  removing the package does not revoke that grant — do that at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions) too. `seo-logs` holds
  visitor `referrer` and `userAgent` strings (no IP addresses).
- The fields the plugin injected into **your** collections, which are *not* dropped and should not be
  dropped blindly: `isCornerstone`, `focusKeyword`, the `focusKeywords` array table, and the `meta`
  group. `meta.title` / `meta.description` are editorial content your editors wrote, and the group may
  belong to `@payloadcms/plugin-seo` rather than to this plugin — see
  [Database and updates](#database-and-updates). Removing any of them is a schema change:
  `payload migrate:create`, then `payload migrate`.

## Database and updates

- This plugin adds collections and fields to your Payload config. It does not own the schema — your
  app does.
- **Payload does not let a plugin ship migrations.** `payload migrate` reads a single directory, and
  it resolves it in the host app, never in a dependency (`payload/dist/database/migrations/readMigrationFiles.js`,
  `findMigrationDir.js`). A migration file published inside an npm package is dead code.
- **In development**, `push` syncs the schema for you — there is nothing to run.
- **In production**, run `payload migrate:create` then `payload migrate`. Never `push`: it is skipped
  as soon as `NODE_ENV=production`, and mixing it with migrations raises a data-loss warning
  (`@payloadcms/drizzle/dist/migrate.js`).
- Every release of this plugin states in its own migration section below whether it changes the
  schema. None has since 1.19.0.

### What this plugin writes into *your* tables

The [collections listed above](#collections) are the plugin's own tables. But the analyzer fields
(`isCornerstone` checkbox, `focusKeyword` text, `focusKeywords` array, `src/fields.ts`) and the `meta`
group (`meta.title` text, `meta.description` textarea, `meta.image` upload, `src/metaFields.ts`) are
injected into **every collection listed in the `collections` option**. Each slug you add to that list
creates real columns in one of your own tables — plus a real array table for `focusKeywords` — exactly
as if you had declared the fields by hand.

So the migration you owe is triggered by *your* config, not by a version bump: after adding a slug to
`collections`, run `payload migrate:create` + `payload migrate` in production.

If the collection already carries a `meta` group — from `@payloadcms/plugin-seo`, or your own field —
the plugin detects it, logs a warning and skips the group instead of adding a second one. Set
`autoCreateMetaFields: false` to skip it unconditionally.

These two field definitions are byte-identical to their 1.19.0 versions, so no upgrade of this plugin
has ever owed you a migration by itself.

## Migration to 4.0

**No schema change.** 4.0.0 only changes access rules, validation and view guards. Do not generate a
migration for it.

The full account is in [CHANGELOG.md](CHANGELOG.md). What can change for you at runtime:

1. **Sessions from an auth collection other than the admin panel's lose the nine admin views.** They
   are redirected to `/admin/unauthorized`; anonymous visitors go to your real login route instead of
   a hard-coded `/admin/login`. Only relevant if your config declares more than one `auth` collection.
2. **Panel users promoted by the old RBAC fail-open lose their SEO-admin rights.** The fallback now
   asks whether a role field is *present*, not whether it has a shape the plugin recognises. If your
   users collection models `role` / `roles` as anything other than a plain string or an array of
   strings, check who still writes to `seo-settings`, `seo-redirects` and `seo-gsc-auth`.
3. **`POST /seo-logs` requires an SEO admin when no `seoLogsSecret` is configured**, and stops
   creating rows past `SEO_LOGS_MAX_ROWS` (default 5000).
4. **`peerDependencies` require Payload `>=3.79.1 <4.0.0`** for `payload`, `@payloadcms/next` and
   `@payloadcms/ui`.

## Migration to 3.0

**No schema change.** 3.0.0 only changes access rules, validation and rate limiting. Do not generate a
migration for it.

The full account is in [CHANGELOG.md](CHANGELOG.md). The one item that leaves data behind:

**External redirect destinations are refused unless you opt in** (`allowExternalRedirects`, default
`false`). Rows stored *before* the upgrade stay editable — the gate only refuses a destination that
actually **changes**, so an existing external redirect can still have its source path or its 301/302
type edited (`src/collections/SeoRedirects.ts`, `src/helpers/redirectSafety.ts`). Nothing is rewritten
or deleted for you; the legacy value simply survives. To review what you are grandfathering, list the
rows whose destination is absolute:

```bash
# adjust the table name to your redirectsCollection slug
sqlite3 your.db "SELECT id, \"from\", \"to\" FROM seo_redirects WHERE \"to\" LIKE 'http%';"
```

```sql
-- Postgres
SELECT id, "from", "to" FROM seo_redirects WHERE "to" LIKE 'http%';
```

Set `allowExternalRedirects: true` if you genuinely rely on cross-origin redirects; otherwise fix the
rows the query returns, since any edit that touches their destination will now be refused.

Other 3.0.0 changes that alter behaviour without touching data: the site-wide aggregation endpoints no
longer publish drafts to any authenticated account, `seo-performance` / `seo-logs` /
`seo-score-history` are no longer writable through the collection API by a plain panel user,
`sitemap.xml` excludes `noindex` documents, and `?nocache=1` is ignored for a panel user without the
admin role.

## Migration to 2.0

Three breaking changes; the full account is in [CHANGELOG.md](CHANGELOG.md).

1. **Generated URLs now carry the collection route prefix.** A `posts` document resolves to
   `/posts/<slug>` instead of `/<slug>`, across `sitemap.xml`, the canonical, the Open Graph URL, the
   JSON-LD `@id` / `url` and IndexNow. If your posts are served flat, restore the old URLs with
   `seoAnalyzerPlugin({ collectionRoutes: { posts: '' } })`, and pass the same map to
   `buildSeoMetadata` / `buildJsonLd` where you call them yourself. A document slugged `home` now
   resolves to the site root rather than `/home`.
2. **`seo-settings`, `seo-redirects` and `seo-gsc-auth` are writable by SEO admins only.** On a
   role-less install nothing changes; on one with roles, a non-admin editor loses write access to those
   three collections.
3. **`POST /ai-alt-text` no longer accepts a `collection` in the body** — the target is always
   `uploadsCollection`, and any other value gets a 403.

Also: Node 18 is dropped, and `next` became a declared (optional) peer dependency.

## Performance

Characteristics, not benchmarks — the numbers depend on your content volume and host.

| Concern | Approach |
|---|---|
| Site-wide audit | Built in the background, single-flight per locale, batched and throttled through the `SEO_AUDIT_*` variables. |
| Very small hosts | Pre-compute the audit in CI with `buildAuditToFile()` and point `auditCacheFile` at the result. |
| Document loading | Paginated, with a hard cap (`SEO_FETCH_MAX_DOCS`) and an optional field projection. |
| Caching | LRU-bounded with locale-aware invalidation; Core Web Vitals are cached to protect the PageSpeed quota. |
| Heavy endpoints | Rate limited by user id, with periodic event-loop yielding during long loops. |
| External APIs | LLM and HTTP calls carry timeouts and retry with backoff. |

## Troubleshooting

**Admin components do not update.** Regenerate the import map: `pnpm payload generate:importmap`.

**Generated URLs do not match my routes.** Declare the public prefix of each collection:

```ts
seoAnalyzerPlugin({ collectionRoutes: { posts: '', projects: 'work' } })
```

Pass the same map to `buildSeoMetadata` and `buildJsonLd` in your front end.

**`SQLITE_BUSY` during imports.** The plugin serializes its own writes, including the bulk redirect
import. Make sure your own seed and import scripts write sequentially too.

**The audit is heavy on a small host.** Raise `SEO_AUDIT_BATCH_DELAY_MS` and `SEO_AUDIT_DOC_DELAY_MS`,
lower `SEO_AUDIT_MAX_DOCS`, set `features: { warmCache: false }`, or move the build to CI with
`buildAuditToFile()` and `auditCacheFile`.

## Security

Secrets are read from environment variables only, never from the database. GSC tokens are encrypted at
rest with AES-256-GCM when `SEO_GSC_ENCRYPTION_KEY` is set, and the token fields carry
`read: () => false` so they never leave through the API. The one GSC route open to any authenticated
panel user is `GET /gsc/status`, which reports the connected account email, the property URL and the
redirect URI — never a token. Redirect targets are validated against
open-redirect patterns, `robots.txt` rules are sanitized on write, and outbound fetches are guarded
against SSRF with a private-IP denylist, DNS-rebinding resolution checks and manual per-hop redirect
re-validation. JSON-LD is serialized through `serializeJsonLd`, which escapes the characters
`JSON.stringify` leaves alone.

In production, set `SEO_GSC_ENCRYPTION_KEY`, set `SEO_REQUIRE_ADMIN_ROLE=1` if your users collection has
a role field, and keep a rate limit at your reverse proxy.

Report vulnerabilities to `contact@consilioweb.fr` rather than in a public issue.

## Contributing

1. Fork the repository and branch from `main`.
2. Run the checks before opening a pull request:

```bash
pnpm typecheck && pnpm test && pnpm build
```

The suite is 473 unit tests plus a Playwright harness for the admin views under `e2e/`
(`pnpm test:e2e:ui:setup` once, then `pnpm test:e2e:ui`).

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Releases from 2.0.0 on are published with npm provenance attestation.

## Support

If this plugin saves you time, consider buying me a coffee.

<a href="https://buymeacoffee.com/pown3d">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" />
</a>

- [Documentation](https://github.com/pOwn3d/payload-seo-analyzer#readme)
- [Issues](https://github.com/pOwn3d/payload-seo-analyzer/issues)
- [Discussions](https://github.com/pOwn3d/payload-seo-analyzer/discussions)

## License

MIT — see [LICENSE](LICENSE). Built and maintained by [ConsilioWEB](https://consilioweb.fr).
