<div align="center" style="background: linear-gradient(135deg, #1f8a5b 0%, #16a34a 50%, #0d9488 100%); padding: 50px 40px; border-radius: 12px; color: white; margin-bottom: 40px;">
  <h1 style="margin: 0 0 15px 0; font-size: 42px; font-weight: 700; letter-spacing: -0.5px;">payload-seo-analyzer</h1>
  <p style="margin: 0 auto; font-size: 18px; opacity: 0.95; max-width: 640px; line-height: 1.6;">The complete, offline-first SEO toolkit for Payload CMS 3 + Next.js — 50+ on-page checks, a 9-view admin dashboard, Google Search Console, opt-in AI assists, and 2026 SEO capabilities. No third-party SEO API required.</p>
</div>

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-1f8a5b)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.19.0-1f8a5b)](package.json)
[![Node.js](https://img.shields.io/badge/node-18+-1f8a5b)](https://nodejs.org)
[![Payload](https://img.shields.io/badge/payload-3.x-1f8a5b)](https://payloadcms.com)
[![Tests](https://img.shields.io/badge/tests-391%20passing-1f8a5b)](src/__tests__)
[![TypeScript](https://img.shields.io/badge/typescript-strict-1f8a5b)](https://www.typescriptlang.org)

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📑 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Performance](#-performance)
- [Examples](#-examples)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Contributing](#-contributing)
- [Changelog](#-changelog)
- [Roadmap](#-roadmap)
- [Support](#-support)
- [License](#-license)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ✨ Features

<table>
<tr>
<td width="50%">

**🔍 50+ On-Page Checks**

A deterministic, offline engine across ~21 rule groups: title, meta, content, headings, images, linking, readability, schema, E-E-A-T and more.

</td>
<td width="50%">

**🤖 SEO 2026 Ready**

Entities & topical authority (`sameAs`/`knowsAbout`), AI/GEO extractability, real per-type JSON-LD validation, and GSC-driven content grading.

</td>
</tr>
<tr>
<td width="50%">

**📊 9-View Admin Dashboard**

Site-wide audit, link graph (with crawl budget), redirect manager, schema builder, cannibalization, keyword research, performance and config.

</td>
<td width="50%">

**🌍 Bilingual & i18n**

FR/EN readability scoring (Flesch + Kandel–Moles), 39-language meta labels, FR/EN dashboard auto-locale, and per-locale audit/caching.

</td>
</tr>
<tr>
<td width="50%">

**🔐 Hardened & Typed**

RBAC gate, SSRF protections, open-redirect/robots sanitization, bounded cache and rate limiting — fully typed, with 391 tests.

</td>
<td width="50%">

**⚡ Built for Real Hosts**

Single-flight, throttled background audit; paginated loading; bounded LRU cache; LLM timeouts — stays responsive on constrained shared hosting.

</td>
</tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🚀 Quick Start

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { seoAnalyzerPlugin } from '@consilioweb/payload-seo-analyzer'

export default buildConfig({
  plugins: [
    seoAnalyzerPlugin({
      collections: ['pages', 'posts'],
      siteUrl: 'https://example.com',
    }),
  ],
})
```

```bash
pnpm payload generate:importmap
pnpm dev
```

Open `/admin/seo` for the dashboard, or edit any page/post to see the live SEO score in the sidebar.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📦 Installation

### npm
```bash
npm install @consilioweb/payload-seo-analyzer
```

### yarn
```bash
yarn add @consilioweb/payload-seo-analyzer
```

### pnpm
```bash
pnpm add @consilioweb/payload-seo-analyzer
```

**Peer dependencies:** `payload@^3`, `@payloadcms/next@^3` (and optionally `@payloadcms/ui@^3`, `react@^18 || ^19`). After adding admin components, run `pnpm payload generate:importmap`.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 💻 Usage

### Basic

```ts
seoAnalyzerPlugin({ collections: ['pages', 'posts'] })
```

### Advanced

```ts
seoAnalyzerPlugin({
  collections: ['pages', 'posts', 'products'],
  globals: ['home'],
  siteUrl: 'https://example.com',
  locale: 'fr',
  features: {
    gscApi: true,      // Google Search Console (OAuth)
    aiFeatures: true,  // AI assists (needs ANTHROPIC_API_KEY)
    alerts: true,      // monitoring digest (webhook/email)
  },
})
```

### Frontend metadata (Next.js)

```ts
import { buildSeoMetadata } from '@consilioweb/payload-seo-analyzer'

export const generateMetadata = ({ doc }) =>
  buildSeoMetadata(doc, { siteUrl: 'https://example.com' })
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔌 API Reference

### `seoAnalyzerPlugin(config)`

The Payload plugin. Adds SEO fields, admin views, editor components and API endpoints.

```typescript
seoAnalyzerPlugin(config: SeoPluginConfig): Plugin
```

### `analyzeSeo(input, config)`

Runs the full engine programmatically and returns the score, level and checks.

```typescript
analyzeSeo(input: SeoInput, config?: SeoConfig): SeoAnalysis
```

### Frontend helpers

```typescript
buildSeoMetadata(doc, opts): Metadata            // Next.js <head> metadata
buildJsonLd(type, values): Record<string, unknown> // schema.org JSON-LD
renderJsonLdScript(jsonLd): string                 // <script type="application/ld+json">
```

### Key HTTP endpoints (under `/api/seo-plugin`, auth required)

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/validate` | Full per-document analysis. |
| `GET` | `/audit` | Site-wide audit (background, throttled). |
| `GET` | `/indexation-audit` | Cross-page indexation hygiene. |
| `GET` | `/link-graph` | Internal link graph + crawl budget. |
| `GET` | `/content-grade` | GSC-driven coverage grade (opt-in). |
| `POST` | `/ai-optimize`, `/ai-alt-text`, `/ai-content-brief` | AI assists (opt-in). |
| `GET` | `/robots.txt`, `/sitemap.xml`, `/llms.txt` | Public, generated. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ⚙️ Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `collections` | `string[]` | `['pages','posts']` | Collections to analyze. |
| `globals` | `string[]` | `[]` | Globals to analyze. |
| `siteUrl` | `string` | env | Base URL (canonical, GSC, sitemaps). |
| `locale` | `'fr' \| 'en'` | `'fr'` | Analysis language. |
| `features` | `SeoFeatures` | all `true` | Granular feature flags. |
| `disabledRules` | `RuleGroup[]` | `[]` | Disable rule groups. |
| `thresholds` | `SeoThresholds` | defaults | Override numeric thresholds. |

### Environment variables

| Env var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Enables AI assists (server-side). Heuristic fallback without it. |
| `SEO_AI_MODEL` | `claude-sonnet-4-6` | Model override (`claude-opus-4-8` = max quality, `claude-haiku-4-5` = cheapest). |
| `SEO_REQUIRE_ADMIN_ROLE` | — | `1` disables the RBAC fail-open. |
| `SEO_FETCH_MAX_DOCS` | `5000` | Memory cap for site-wide analysis. |
| `SEO_LLMS_TXT` | — | `1` enables the opt-in `/llms.txt` generator. |
| `SEO_GSC_ENCRYPTION_KEY` | — | 32-byte key to encrypt GSC tokens at rest (recommended). |
| `SEO_AUDIT_*` / `SEO_ALERT_*` | see docs | Audit throttling & monitoring digest. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ⚡ Performance

Engineered to stay responsive on constrained shared hosting (no fabricated benchmarks — characteristics depend on your content volume and host):

| Concern | Approach |
|---------|----------|
| Site-wide audit | Single-flight, background-built, throttled (env-tunable); never blocks or OOM-kills the process. |
| Heavy endpoints | Periodic event-loop yielding + rate limiting (keyed by user id). |
| Document loading | Paginated with a memory cap (`SEO_FETCH_MAX_DOCS`). |
| Caching | LRU-bounded, locale-aware invalidation; Core Web Vitals cached to protect the PSI quota. |
| External APIs | LLM calls have timeouts and retry/backoff. |

> Tune via the `SEO_AUDIT_*` env vars on the tiniest hosts.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📚 Examples

### Disable a rule group and re-weight another

```ts
seoAnalyzerPlugin({
  collections: ['pages'],
  disabledRules: ['ecommerce'],
  overrideWeights: { social: 1 },
})
```

### Custom thresholds

```ts
seoAnalyzerPlugin({
  collections: ['posts'],
  thresholds: { TITLE_LENGTH_MAX: 65, META_DESC_LENGTH_MAX: 165 },
})
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ❓ FAQ

<details>
<summary><b>Do I need a paid SEO API?</b></summary>

No. The core analysis is offline and deterministic. Google Search Console and AI assists are opt-in and use your own credentials.

</details>

<details>
<summary><b>What Node / Payload versions are supported?</b></summary>

Node.js 18+, Payload 3.x, and React 18 or 19.

</details>

<details>
<summary><b>Is there TypeScript support?</b></summary>

Yes — the package is fully typed and ships its own type definitions; IntelliSense works out of the box.

</details>

<details>
<summary><b>Does it cost anything to run?</b></summary>

The base plugin is free and offline. Only AI assists (Anthropic) and PageSpeed/GSC quotas involve your own external usage.

</details>

<details>
<summary><b>How do I contribute?</b></summary>

See the [Contributing](#-contributing) section. Bug reports, ideas and pull requests are all welcome.

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔧 Troubleshooting

### Admin components not updating

**Solution:** regenerate the import map.
```bash
pnpm payload generate:importmap
```

### `SQLITE_BUSY` during imports

**Solution:** the plugin serializes its own writes; ensure your seed/import scripts also write **sequentially** on SQLite.

### Audit feels heavy on a small host

**Solution:**
- Raise `SEO_AUDIT_BATCH_DELAY_MS`
- Set `SEO_AUDIT_DEPTH=0`
- Disable `features.warmCache`

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔐 Security

Security is a first-class concern. The plugin reads secrets only from environment variables (never the DB), encrypts GSC tokens at rest, validates redirect targets, sanitizes `robots.txt` rules, and protects outbound fetches against SSRF (private-IP allowlist, DNS-rebinding guard, manual redirect re-validation).

### Reporting Security Issues

Please email `contact@consilioweb.fr` instead of opening a public issue.

### Best Practices

- ✅ Keep the plugin up-to-date
- ✅ Set `SEO_GSC_ENCRYPTION_KEY` and `SEO_REQUIRE_ADMIN_ROLE=1` in production
- ✅ Read all secrets from environment variables
- ✅ Enforce a rate limit at your reverse proxy

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🤝 Contributing

Contributions are very welcome!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'feat: add AmazingFeature'`)
4. **Push** the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

Run the checks before submitting:

```bash
pnpm typecheck && pnpm test && pnpm build
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### [1.19.0]

- ✨ SEO 2026: entities & topical authority, AI/GEO extractability, GSC-driven content grade, indexation hygiene, crawl-budget analysis, opt-in `llms.txt`.
- ⚡ Performance: paginated loading, bounded LRU cache, event-loop yielding, LLM timeouts/retries.
- 🔐 Security: IDOR allowlists, open-redirect & robots sanitization, residual-SSRF fix, `user.id` rate limiting, `SEO_REQUIRE_ADMIN_ROLE`.

<details>
<summary><b>Previous versions</b></summary>

- **1.18.2** — Fix: false "broken links" & "orphan pages" for posts linked via `/posts/<slug>`
- **1.18.1** — Fix: dashboard audit returned HTTP 429 mid-build (polling throttled itself)
- **1.18.0** — Accurate readability on list-heavy content (sentence boundaries at block ends)
- **1.17.3** — Audit build no longer freezes the site (per-document yield)
- **1.17.2** — Fix: admin tools 403 for legit admins on role-less setups
- **1.17.1** — Fix: GSC panels showed "Error 404" when the feature is off
- **1.17.0** — Audit throttling (no more server saturation)
- **1.16.0** — IndexNow (proactive indexing)
- **1.15.0** — Module health / observability
- **1.14.0** — One-click "Optimize site" + per-locale audit
- **1.13.0** — CTR opportunities (GSC data → targeted meta rewrite)
- **1.12.0** — Bulk meta correction (preview/export/apply) + audit hardening
- **1.11.0** — AI content brief, News/Image/Video sitemaps, multi-location local SEO
- **1.10.0** — Rank tracking, frontend render helpers, monitoring alerts, AI alt-text
- **1.9.0** — AI SEO Optimize + dashboard OOM hardening
- **1.8.0–1.8.1** — SEO 2026 "desintox" pass + low-memory audit
- **1.3.0–1.7.0** — Early releases (core engine, i18n, dashboard)

See [CHANGELOG.md](CHANGELOG.md) for full details of every release.

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🗺️ Roadmap

- [x] SEO-2026 feature set (entities, GEO, content grade, indexation hygiene)
- [x] Security & performance hardening
- [ ] **Real end-to-end UI QA harness** — browser-driven admin views
- [ ] **Optional strict field-level access control** — for single-document reads
- [ ] **Entity input fields in the Schema Builder** — `sameAs` / `knowsAbout`
- [ ] **Lazy-loading of the heaviest admin views**

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ☕ Support

If this plugin saves you time, consider buying me a coffee!

<a href="https://buymeacoffee.com/pown3d">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" />
</a>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📄 License

Licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

<div align="center" style="padding: 40px 0; color: #666; border-top: 1px solid #e0e0e0; margin-top: 50px;">
  <p style="margin: 10px 0;">Built and maintained by <a href="https://consilioweb.fr" style="color: #1f8a5b; text-decoration: none;">ConsilioWEB</a></p>
  <p style="margin: 10px 0; font-size: 13px;">
    <a href="https://github.com/pOwn3d/payload-seo-analyzer#readme" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">Documentation</a>
    <a href="https://github.com/pOwn3d/payload-seo-analyzer/issues" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">Issues</a>
    <a href="https://github.com/pOwn3d/payload-seo-analyzer/discussions" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">Discussions</a>
  </p>
</div>
