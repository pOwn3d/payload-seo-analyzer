# Changelog

All notable changes to `@consilioweb/payload-seo-analyzer` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.21.0] - 2026-06-26 — Build-time audit cache (offload the heavy site-wide audit to CI)

### Added
- **Build-time audit cache**: `buildAuditToFile(payload, { collections, outFile, … })` runs the
  full site-wide audit and writes it to a JSON file. Point the plugin at it with the new
  `auditCacheFile` option: on a dashboard cache miss the audit is **hydrated from the file**
  (a cheap file read) instead of being recomputed live — offloading the heavy build to CI on
  memory-constrained hosts (e.g. Infomaniak). Stale-guarded: the file is ignored once content
  changes since it was generated (a live rebuild takes over), so scores never go stale.
- **Runtime kill-switch** `SEO_AUDIT_FILE_CACHE=0` (or `false`) to ignore the file cache and
  force a live build, tunable via the server `.env` without a rebuild.

## [1.20.0] - 2026-06-25 — Opt-in audit, gentler build, strict access control, Schema Builder entities, e2e harness

### Added
- **Opt-in site-wide audit**: opening the SEO dashboard no longer auto-triggers the (heavy) audit build — it now shows a **"Run audit"** button and only builds on demand. The dashboard reads the cache via a non-triggering `noBuild=1` peek, so visiting `/admin/seo` is instant and never slows the site. Re-opening shows the cached result instantly.
- **Opt-in strict read access** (`SEO_STRICT_READ_ACCESS=1`): single-document read endpoints (`validate`, `generate`, `breadcrumb`, `schema-generator`, `ai-rewrite`) respect the caller's collection/field-level access control (`overrideAccess: false` + `user`). Default behavior is unchanged (no regression); site-wide aggregation endpoints intentionally keep full visibility.
- **Schema Builder entity fields**: author `sameAs` on Article and `knowsAbout` on Organization — entity disambiguation / topical authority (E-E-A-T).
- **End-to-end UI test harness** for the admin dashboard views (`e2e/`).

### Changed
- **Gentler audit build**: a real per-document throttle (`SEO_AUDIT_DOC_DELAY_MS`, default 10ms) leaves the event loop idle gaps so the site stays responsive while the background build runs — the build takes a bit longer but never saturates the CPU. Set 0 for the fastest build, raise it on rich-content sites.
- README refreshed (design, Support section, previous-versions list, npm badge) and synchronized to the npm package page.

## [1.19.0] - 2026-06-25 — SEO 2026: security, performance & new features

### Added
- **Entities & topical authority** (JSON-LD): `sameAs`, `knowsAbout`, `about`, `mentions`, `isPartOf` on Article/Organization/Person — the strongest lever for being cited by AI engines. Plus two AI-readiness E-E-A-T checks (weight 0).
- **Real JSON-LD validation** per type: flags missing Google-required properties (`schema-required-fields` check, weight 0).
- **Cross-page indexation hygiene**: detects mass `noindex` and duplicated/missing/broken canonicals (`hygiene` block on `/indexation-audit` + admin panel).
- **AI extractability (GEO)**: checks for FAQ/HowTo structure, definition snippets, lists/tables (weight 0).
- **GSC-driven Content Grade**: per-page A–F coverage grade computed from real Google Search Console queries, with no paid SERP API (`GET /content-grade`, under `features.gscApi`) + admin panel.
- **Crawl budget / internal linking**: under-linked high-value pages and crawl depth (BFS) on `/link-graph` + admin section.
- **llms.txt** opt-in generator (`SEO_LLMS_TXT=1`, `GET /llms.txt`) — AI discoverability, never counted in the SEO score.
- `THREAT-MODEL.md` documenting the plugin's security model.
- Environment variables: `SEO_REQUIRE_ADMIN_ROLE=1` (disable the RBAC fail-open), `SEO_FETCH_MAX_DOCS`, `SEO_LLMS_TXT`.

### Changed
- Default LLM model **Opus → Sonnet** (cost/latency); Opus is opt-in via `SEO_AI_MODEL`.
- LLM calls now use a timeout and retry/backoff (429/5xx/529) via `fetchWithRetry`.
- `fetchAllDocs` is paginated (capped by `SEO_FETCH_MAX_DOCS`, default 5000) — no more silent truncation at 500 documents (which caused false orphans / broken links).
- Cache is bounded with LRU eviction, locale-aware invalidation, and Core Web Vitals results are cached.
- Rate limiting is keyed by `user.id` (not spoofable) and applied to heavy endpoints (sitemap-audit, link-graph, performance).
- The admin gate (`isAdmin`) is factored into a single shared helper.
- INP is highlighted in the Core Web Vitals panel (the most commonly failed Core Web Vital).

### Fixed
- **Multi-locale cache collision**: link-graph, sitemap-audit, keyword-research, external-links, cannibalization and duplicate-content could serve another locale's content (cache keys were not locale-scoped).
- `performance` POST writes are serialized — no more `SQLITE_BUSY` errors.
- Admin freeze on large graphs (the `LinkGraphView` force simulation now uses an adaptive iteration count).
- Event-loop blocking on heavy endpoints (periodic yielding).

### Security
- **IDOR**: collection/global allowlist on `/generate` and `/validate`.
- **Open redirect**: redirect targets are validated (rejecting `//host`, `\`, `javascript:`, CRLF) in the endpoints, the auto-redirect hook, and the collection field.
- **Residual SSRF**: `external-links` uses `redirect: 'manual'` and re-validates every redirect hop.
- **robots.txt injection**: custom rules are sanitized (allowlisted directives, on both read and write).

## [1.18.2] - 2026-06-24 — Fix: false "broken links" & "orphan pages" for posts linked via /posts/<slug>

### Fixed
- **Internal links to posts were massively mis-reported as "broken links" (and their targets as
  "orphan pages") in the Sitemap/Maillage audit and the Link Graph.** Documents are keyed by their
  bare slug (a post `my-post`), but their public URL is prefixed by the collection route
  (`/posts/my-post`), which normalized to `posts/my-post` and matched no document — so every post
  linked from content was counted as a dead link, and posts whose only inbound links used that route
  were counted as orphans. (`knownRoutes` only whitelisted the bare route like `/posts`, not
  `/posts/<slug>`.)
- New `resolveToDocSlug()` strips a leading **route-prefix segment** (target collection slugs +
  configured `knownRoutes`) when the remainder is a real document slug. Applied in `sitemap-audit`
  and `linkGraph` before building the incoming-link map, so broken-link, orphan, weak-page and
  degree counts are all correct. Genuinely missing targets are still reported as broken.

## [1.18.1] - 2026-06-24 — Fix: dashboard audit returned HTTP 429 mid-build (polling throttled itself)

### Fixed
- **The dashboard audit failed with `HTTP 429` on large sites.** The audit is built in the background
  (single-flight) and the dashboard polls `GET /audit` every 3s until it's ready — a build on a big
  site takes minutes. But that endpoint shared the expensive-endpoint rate limiter (**10 req / 60s**),
  so after ~10 polls (~30s) every further poll was rejected with 429 and the UI showed
  "Erreur de chargement HTTP 429" — even though the build kept running server-side.
- The audit GET now uses a **dedicated, poll-friendly limiter (120 req / 60s)**. The genuinely
  expensive work (the build) is already bounded to one at a time by single-flight; the polled requests
  just read the cache or return a tiny `202`, so they no longer need to share the strict POST limiter.
- Belt-and-suspenders on the client: a transient `429` during polling is now treated as
  "keep polling with backoff" instead of a fatal error.

## [1.18.0] - 2026-06-24 — Accurate readability on list-heavy content (sentence boundaries at block ends)

### Fixed
- **Flesch readability was massively under-scored on scannable, list-heavy content.** The text
  extraction joined every block (paragraph, list item, heading) with a plain space. Since list items
  rarely carry trailing punctuation, a whole list + its surrounding paragraphs collapsed into a single
  giant pseudo-sentence — inflating average sentence length and tanking the Flesch score, even though
  the content is genuinely easy to scan. Real-world impact measured on a 142-block article: Flesch
  **13 → 49** (from `fail` to `pass`, threshold 40) purely from correct sentence segmentation; the
  `readability-long-sentences` ratio is corrected the same way.
- The fix adds an **opt-in `sentenceBoundaries` mode** to the Lexical text extraction: block-level
  nodes (`paragraph`, `heading`, `listitem`, `quote`) terminate a sentence. It is used **only** for
  readability metrics (Flesch + sentence splitting), via a new `readabilityText` on the analysis
  context and on `extractDocContent()`. Word count, keyword density, and heading/title extraction keep
  their previous clean output (default behavior is unchanged). Applies consistently to both the
  per-document analyzer (sidebar / `validate`) and the site-wide dashboard audit.

### Notes
- This raises readability scores for list-heavy pages/posts (the previous score was an extraction
  artifact, not a real readability problem). No content changes required.

## [1.17.3] - 2026-06-24 — Audit build no longer freezes the site (per-document yield)

### Fixed
- **The audit build still froze constrained hosts for minutes** despite the 1.17.0 batch throttle.
  Root cause: `analyzeSeo()` is **synchronous and CPU-heavy**, and a whole batch ran back-to-back
  before yielding — blocking the single Node event loop in bursts, so the site became unresponsive.
  The build now **yields to the event loop after EVERY document** (cooperative), so the process keeps
  serving site requests *between* analyses. The background build no longer blocks the site.
- **Default audit depth is now `0`** (was 1) — not populating relations (media) per doc cuts CPU +
  memory substantially on big sites. Set `SEO_AUDIT_DEPTH=1` to restore exact image-dimension parity.
- **The dashboard no longer force-rebuilds the audit after each bulk apply** — repeated full rebuilds
  during batch optimization were a second saturation source. Changes are written immediately; a
  banner invites a single manual refresh when all batches are done.

## [1.17.2] - 2026-06-24 — Fix: admin tools 403 for legit admins on role-less setups

### Fixed
- **Admin-gated endpoints returned 403 for legitimate admins** (bulk optimize / "Optimize site",
  AI alt-text, rank tracking, CTR opportunities, alerts, redirects, settings, SEO logs, GSC…).
  The admin check only accepted `role === 'admin'` (or `roles` including `'admin'`), so on a
  **role-less Payload users collection** (the default — any authenticated user is an admin) every
  tool was blocked with "Réservé aux administrateurs". Now: an explicit role scheme is still
  enforced (a non-admin role is denied), but when the user has **no `role`/`roles` field at all**,
  any authenticated admin-panel user is treated as privileged. (Found by dogfooding on the live
  deploy.) This unblocks the bulk/AI/GSC tools on standard Payload setups.

## [1.17.1] - 2026-06-24 — Fix: GSC panels showed "Error 404" when the feature is off

### Fixed
- **Rank tracking, CTR opportunities and GSC panels displayed a raw "Error 404"** when
  `features.gscApi` was disabled (their endpoints aren't registered). They now show the proper
  "connect Google Search Console / enable the feature" guidance instead — graceful, like the
  alerts panel. (Found by dogfooding on a live deploy.)

### Added
- **UI render smoke tests** (jsdom + Testing Library) for the dashboard panels
  (Health, RankTracking, CTR, Alerts) — validates they render the right state (data / not-connected /
  feature-off) without a deployed admin. Test suite: **260 tests**.

## [1.17.0] - 2026-06-24 — Audit throttling (no more server saturation)

### Fixed
- **Site-wide audit could saturate a constrained host for minutes** while building (CPU/memory
  pegged by running `analyzeSeo` on every doc back-to-back). The background build is now
  **throttled**: a real pause between batches (`SEO_AUDIT_BATCH_DELAY_MS`, default **100ms**) caps
  CPU and lets the GC reclaim each batch, so the site **stays responsive during the build**
  instead of being saturated. Default batch size lowered to **10**.

### Added
- **`SEO_AUDIT_BATCH_DELAY_MS`** (default `100`) — pause between audit batches; raise on tiny
  shared hosts, set `0` for speed on a strong server.
- **`SEO_AUDIT_DEPTH`** (default `1`) — relationship depth for the audit; set `0` to further cut
  memory/CPU (minor image-dimension score difference).

## [1.16.0] - 2026-06-24 — IndexNow (proactive indexing)

### Added
- **IndexNow** (opt-in `features.indexNow`). Pings IndexNow (Bing, Yandex, Seznam…) the moment
  content is **published**, instead of waiting for a crawl — proactive indexing like RankMath Pro.
  - `afterChange` hook auto-submits a document's URL on publish (fire-and-forget, never blocks a save).
  - `GET /indexnow-key.txt` serves the ownership-verification key file.
  - `POST /indexnow-submit` (admin) submits all published URLs in one batch (initial seeding).
  - Key from `SEO_INDEXNOW_KEY`; the health endpoint now reports whether it's configured.

## [1.15.0] - 2026-06-24 — Module health / observability

### Added
- **Module health endpoint `GET /health` + dashboard “SEO module health” panel.** At-a-glance
  status of every integration (AI key, Search Console connected, PageSpeed key, alert channels),
  the last rank snapshot date, and **actionable warnings** (e.g. "GSC configured but not
  connected", "no alert channel"). For a reference-grade module, silent failures of the
  background jobs are now visible instead of hiding in the logs. Admin only; never returns secrets.

## [1.14.0] - 2026-06-24 — One-click "Optimize site" + per-locale audit

### Added
- **One-click “✨ Optimiser le site”** in the dashboard header. Auto-targets the pages that
  actually need meta work (missing meta title/description, no focus keyword, or score < 70),
  caps to 100, and runs the bulk **preview → export → apply** flow. Site-scale SEO correction
  with minimal interaction — no manual page-picking.

### Changed
- **Audit cache + single-flight are now scoped per locale.** A multi-locale Payload site builds
  and serves one audit per locale (with that locale's language rules) instead of one locale's
  result leaking to all — fixes incorrect scoring on localized sites.

## [1.13.0] - 2026-06-24 — CTR opportunities (GSC data → targeted meta rewrite)

### Added
- **CTR opportunities — the highest-ROI, lowest-interaction lever.** New endpoint
  **`GET /ctr-opportunities`** uses real Google Search Console data to find pages that **rank well
  (position ≤ 20) but get a low CTR for their position** — i.e. the meta title/description
  under-performs. Each opportunity is ranked by **estimated missed clicks**, resolved to its
  Payload document, and shown in a new **Performance panel** where you **optimize the meta with AI
  and apply in one click**. This closes the loop: real data → exact page → targeted fix.
  - Pure, tested CTR-curve model (`expectedCtrForPosition`) + `rankCtrOpportunities`.
  - Requires `features.gscApi` + a connected Search Console account; admin only.

## [1.12.0] - 2026-06-24 — Bulk meta correction (preview/export/apply) + audit hardening

### Added
- **Bulk AI meta correction at scale — "fix X pages at once".** New server endpoint
  **`POST /ai-optimize-bulk`** runs the scan→propose→validate pipeline over a list of pages and
  returns a **before → after report** (dry-run, nothing written) or **applies** it. The dashboard
  bulk action **“✨ Optimiser méta (IA)”** now opens a **preview overlay**: review every proposed
  change, **export CSV**, then **Apply** writes the meta to the DB in one batch. Applying re-uses
  the reviewed values (no second LLM call → cheaper/faster). Meta only by design (SEO 2026
  anti-roadmap: no body-content rewriting). Two clicks for N pages — the goal is a real SEO gain
  with minimal interaction.

### Fixed (post code-review hardening)
- **Scheduler timer leak.** `warmCache`, `rankTracker` and `alertsScheduler` now clear any
  previous interval before scheduling (`start*()` is idempotent) — a re-init / hot-reload no
  longer leaks timers or runs duplicate background jobs (memory).
- **RBAC: redirect PATCH.** Updating a redirect (`PATCH /redirects`) now requires an admin, like
  POST/DELETE — closes a path where any authenticated user could alter SEO traffic routing.
- **Audit skips drafts.** The site-wide audit now scores only published content (collections
  without a draft system are unaffected) — no more false "missing meta" from work-in-progress.

## [1.11.0] - 2026-06-23 — AI content brief, News/Image/Video sitemaps, multi-location local SEO, bulk meta

### Added
- **AI content brief** (`POST /ai-content-brief`, `features.aiFeatures`). For a target keyword
  (optionally with page context), Claude returns a structured writing brief: **heading outline
  (H2/H3)**, **entities to cover**, **questions to answer** (PAA-style), **recommended word
  count** and **internal-link ideas**. New panel in the Keyword Research view. Server-sanitized.
- **News / Image / Video sitemaps** (public endpoints):
  - `GET /sitemap-news.xml` — Google News sitemap for articles published in the last 48h.
  - `GET /sitemap-images.xml` — images per page.
  - `GET /sitemap-video.xml` — video objects per page.
  - Image/Video sitemaps load documents in **bounded batches with event-loop yields** (same
    memory-safe pattern as the audit) — env-tunable via `SEO_SITEMAP_BATCH_SIZE` (50) and
    `SEO_SITEMAP_MAX_DOCS` (5000).
- **Multi-location local SEO.** `buildJsonLd` now emits a `@graph` of `LocalBusiness` nodes when
  a document has a `locations[]` array (per-location name, address, geo coordinates, opening
  hours, price range). A single location preserves the previous single-node output.
- **Bulk meta optimization in the dashboard.** Select pages → **“Optimiser méta (IA)”** runs
  `/ai-optimize` on each and applies the optimized meta (two-click confirm). Meta-only by design.

## [1.10.0] - 2026-06-23 — Rank tracking, frontend render helpers, monitoring alerts, AI alt-text

Four premium-tier features that close the gaps vs Yoast Premium / RankMath Pro.

### Added
- **Rank tracking (Google Search Console).** Stores a clean **daily per-query position series**
  (`seo-rank-history`) and surfaces **movement over time** ("#4 → #9") in a new Performance
  panel. A background job snapshots once a day (idempotent); manual snapshot + history via
  `POST /rank-snapshot` and `GET /rank-history`. Requires `features.gscApi` (reuses the existing
  OAuth + encrypted refresh token).
- **Frontend render helpers — produce the SEO, not just grade it.** New pure, dependency-free
  exports usable in Next.js `generateMetadata()` / Server Components:
  - `buildSeoMetadata(doc, options)` → a Next `Metadata` object (title, description, canonical,
    hreflang `languages`, robots, Open Graph, Twitter).
  - `buildJsonLd(doc, options)` / `renderJsonLdScript(doc, options)` → JSON-LD for the page,
    reusing the exact builders the admin schema generator uses (Article, Product, LocalBusiness,
    FAQPage, BreadcrumbList, Organization, Person, Event, Recipe, Video).
  - Also exported: `detectSchemaType`, `getSchemaImageUrl`, `SCHEMA_TYPES`.
- **Monitoring & alerts (opt-in, `features.alerts`).** A periodic **digest** (default daily)
  reports **score regressions**, **new 404s** and **ranking drops** via **webhook and/or email**
  (Payload email adapter). Preview/send from a new Performance panel (`GET /alerts-digest`,
  `POST /alerts-run`). Delivery + thresholds via env: `SEO_ALERT_WEBHOOK_URL`, `SEO_ALERT_EMAIL`,
  `SEO_ALERT_SCORE_DROP` (10), `SEO_ALERT_POSITION_DROP` (5), `SEO_ALERT_INTERVAL_HOURS` (24).
- **AI image alt-text (Claude vision).** Generate the `alt` attribute for images that lack one,
  for accessibility + SEO. `GET /alt-text-audit` lists media missing alt; `POST /ai-alt-text`
  generates (review, edit) and applies in one click from a new Performance panel. Gated by
  `features.aiFeatures`; key from `ANTHROPIC_API_KEY`, model `SEO_AI_MODEL` (default
  `claude-opus-4-8`). SSRF-safe (own-origin image fetch).

### Changed
- Internal refactor (no behavior change): extracted the GSC client primitives to
  `helpers/gscClient.ts` and the JSON-LD builders to `helpers/buildSchema.ts` as single sources
  of truth shared by the endpoints and the new features.

## [1.9.0] - 2026-06-23 — AI SEO Optimize + dashboard OOM hardening

### Added
- **AI SEO Optimize — "scan → propose → apply" (meta only).** A new sidebar button
  **“Optimiser avec l'IA”** runs the real SEO engine on the page, sends the content + detected
  issues to Claude, and proposes an optimized **meta title, meta description** and (only when
  missing) a **focus keyword**, with a short rationale. One click applies them to the document
  fields (the editor then saves as usual). Scope is intentionally limited to META tags — the
  SEO 2026 analysis flags mass AI-generated body content as a spam/penalty risk, so the
  feature never rewrites page content.
  - New endpoint **`POST /ai-optimize`** (gated by `features.aiFeatures`).
  - **Model defaults to `claude-opus-4-8`**, overridable via **`SEO_AI_MODEL`**. The API key is
    read only from **`ANTHROPIC_API_KEY`** (never from the client). Without a key, the feature
    degrades gracefully to the built-in heuristic generators.
  - **Server-side rule validation**: suggestions are clamped/trimmed (title ≤ 70, description
    ≤ 160, focus keyword only filled when empty) before being returned — so what gets applied
    is rule-compliant regardless of the model's output. Refusals fall back to the heuristic.

### Fixed
- **Dashboard crashes the server on first load (low-memory hosts, e.g. Infomaniak).** The
  site-wide audit is now **single-flight** (only one build ever runs at a time — concurrent
  page reloads no longer fire multiple full builds and multiply peak memory) and runs **in the
  background**: an uncached request returns **`202 building`** immediately and the dashboard
  polls until the cache is ready (new “generating…” state). This decouples the heavy work from
  the request lifecycle (no timeouts, no OOM-killed process → no EADDRINUSE restart loop).
- Lower the audit's peak memory: the score-history lookup is now **bounded**, the default
  **`SEO_AUDIT_BATCH_SIZE` is 15** (was 25), and the startup **warm-up is lighter**
  (`depth: 0`, smaller limit) so it no longer spikes memory at boot.

## [1.8.1] - 2026-06-23 — Hotfix: low-memory audit (OOM)

### Fixed
- **Site-wide audit OOM on low-memory hosts.** The `/audit` endpoint (SEO dashboard) could
  exhaust RAM on its first (uncached) generation — crashing the Node process and leaving the
  port bound (EADDRINUSE restart loop, site down). The audit now builds **in tiered batches**
  with an event-loop yield between each (so the previous batch's memory is reclaimed before
  the next loads and the server stays responsive), wraps each document in `try/catch`, and is
  bounded by an env-tunable cap.
- The audit no longer runs the weight-0, non-scoring `geo` / `eeat` / `hreflang` groups
  (recursive Lexical walks) per document — SEO scores are unchanged; per-doc CPU/memory drops.
  (The dashboard AI-readiness column is therefore not shown; the editor sidebar still computes
  it per document.)

### Added
- **`features.warmCache`** (default `true`) — set to `false` to skip the startup + hourly
  cache pre-load on low-memory hosting (replaces the need to patch the plugin).
- Audit env knobs: **`SEO_AUDIT_BATCH_SIZE`** (default 25) and **`SEO_AUDIT_MAX_DOCS`**
  (default 1500). Lower the batch size on very small hosts.

## [1.8.0] - 2026-06-23 — SEO 2026 "desintox" pass

> Based on the multi-agent SEO analysis in `docs/SEO-2026-ANALYSIS.md`. The scoring
> engine no longer rewards outdated SEO myths; it adds honest structured-data
> validation and indexation-hygiene (crash-prevention) checks.

### Changed — scoring de-toxified (myths removed from the score)
- **Keyword density** is now an over-stuffing guard ONLY. The 0.5% minimum-density
  floor was removed — low density no longer warns/fails (the floor pushed toward
  keyword stuffing, a Google spam-policy signal). Only `> 2.5%` (warning) and
  `> 3%` (fail) are penalised; below that, density is informational (weight 0).
- **Keyword distribution across content tiers** is now informational (weight 0) — a
  disguised density metric, never a ranking factor.
- **Title length (30–60 chars)** is no longer a `critical` check — depondéré to an
  informational hint (weight 1, bonus). Google rewrites 60%+ of titles and truncates
  by pixels, not characters.
- **Passive voice** and **transition words** are now informational (weight 0) —
  Yoast-style readability heuristics, never ranking factors.
- **Cornerstone word count**: the 1500-word "comprehensive" target was replaced by a
  low thin-content floor (600) that no longer rewards volume.
- Removed a fabricated "+36% CTR" statistic from the title number check.

### Changed — structured data check is now honest
- The `schema` group no longer passes green just because title + description + image
  exist (it never read any JSON-LD). It is now **page-type aware**: it determines the
  expected schema.org type, validates required fields derivable from CMS data, and
  reminds about required fields it cannot verify (author, offers, address). A page
  with no usable structured-data signals no longer passes by default.
- FAQPage is flagged as "valid markup but no SERP rich result (2026)" — without ever
  recommending removal of the markup.
- New check ids `schema-coverage` and `schema-faq-no-rich-result` replace
  `schema-readiness`. New `src/rules/schema-requirements.ts` type→required-field map.

### Added — indexation hygiene (crash prevention)
- `technical` group now detects a **cross-canonical** (`canonical-cross`): a page
  canonicalizing to a different on-site page (silently de-indexes itself). Conservative
  detection — no false positives.
- `buildSeoInputFromDoc` now maps canonical/robots from common CMS field locations, so
  the `technical` (canonical/robots) checks actually fire across the dashboard and the
  editor sidebar (previously dormant unless the caller supplied those fields).
- New endpoint `GET /api/seo-plugin/indexation-audit` — cross-page scan surfacing every
  CMS-visible `noindex` / canonical problem in one place (reuses the `analyzeSeo`
  engine for identical verdicts; gated behind `features.dashboard`).

### Added — schema generator types
- `Event`, `Recipe`, `Video` (VideoObject) and `Person` added to the JSON-LD generator;
  `Organization` / `Person` now emit `sameAs` (entity resolution for search + AI).

### Added — E-E-A-T, GEO & a separate AI-readiness score (P1)
- New **`eeat`** rule group (non-scoring, weight 0): attributed author, author entity link
  (sameAs), published/modified dates, cited external sources, original/quantitative data.
  Surfaced as transparency guidance — E-E-A-T is a framework, not a direct ranking factor.
- New **`geo`** rule group (non-scoring, weight 0): answer-first lead, question-style
  headings, extractable structures (lists/tables), chunked content — directional hints
  for generative-engine (AI Overviews / ChatGPT / Perplexity) citation.
- New **AI-readiness sub-score** (`SeoAnalysis.aiReadiness`) — aggregated from the `geo`
  and `eeat` groups plus `schema-coverage`, kept distinct from the SEO `score` because
  ranking and AI-citation are governed by different signals.
- **Freshness**: new `freshness-fake-refresh` check — flags a displayed date newer than
  the real last modification (`updatedAt`), conservatively and non-scoring.
- `buildSeoInputFromDoc` now maps `author` / `publishedAt` / `displayedDate` from common
  Payload document shapes (feeds the E-E-A-T and freshness checks).

### Added — multi-locale, Core Web Vitals & GSC (P1 external integrations)
- New **`hreflang`** rule group (multi-locale; silent on mono-locale sites): validates
  code format, duplicates, absolute URLs and x-default on the declared alternate set.
  `buildSeoInputFromDoc` maps `localeAlternates` from common document shapes.
- New endpoint `GET /api/seo-plugin/core-web-vitals` — real LCP/INP/CLS via the PageSpeed
  Insights API (CrUX field data, Lighthouse lab fallback). **Informational, on-demand,
  SSRF-safe** (own origin only); optional `PAGESPEED_API_KEY`. Gated behind `features.performance`.
- New **Google Search Console OAuth** integration — **opt-in `features.gscApi` (default off)**:
  endpoints `gsc/status`, `gsc/auth`, `gsc/callback`, `gsc/data`, `gsc/disconnect`. The
  refresh token is **encrypted at rest (AES-256-GCM, `helpers/tokenCrypto.ts`)** in the new
  hidden `seo-gsc-auth` collection (the token field is never exposed via the API); CSRF
  `state` on the handshake; admin-only.

### New environment variables (optional)
- `PAGESPEED_API_KEY` — raises the PageSpeed Insights quota (Core Web Vitals endpoint).
- `GSC_OAUTH_CLIENT_ID` / `GSC_OAUTH_CLIENT_SECRET` — Google OAuth client for the GSC integration.
- `SEO_GSC_ENCRYPTION_KEY` — 32-byte key (hex or base64) to encrypt the GSC refresh token at
  rest; falls back to deriving a key from Payload's `secret` when unset.

> **GSC host setup** (cannot be automated): create a Google Cloud OAuth client, enable the
> Search Console API, and register the redirect URI `<siteUrl>/api/seo-plugin/gsc/callback`.

### Added — admin UI surfacing
- **AI-readiness badge** in the editor sidebar (`SeoAnalyzer`) and a compact ✨ indicator in
  the SEO dashboard score cell (`SeoView`); `/audit` now returns `aiReadiness` per document.
- **Core Web Vitals panel** (`CoreWebVitalsPanel`) in the Performance view — test any
  same-origin URL (mobile/desktop), LCP/INP/CLS with rating colors.
- **Google Search Console panel** (`GscPanel`) in the Performance view — connect/disconnect
  and browse query/page data; shows the redirect URI + setup hint when not configured.

### Added — P2 refinements
- **Title pixel-width estimate** (`title-pixel-width`, weight 0, informational) — flags likely
  SERP truncation (~600px), since Google truncates titles by pixels, not characters.
- **Cannibalization by intent** — the detector now groups keywords by a canonical intent key
  (accent-insensitive, token-order-insensitive) instead of exact string match, catching
  reordered/accented duplicates and deduplicating per document.

> Other P2 items from the analysis were already shipped in earlier versions: per-page image
> format/dimensions/filename checks, sitewide duplicate-content detection (Jaccard trigrams),
> and per-locale readability thresholds. SSR/CSR detection was deliberately not implemented
> (low value + SSRF surface, as the analysis itself flagged).

## [1.7.0] - 2026-04-08

### Added
- Granular feature flags — disable collections/endpoints/views you don't need
- robots.txt dynamic generation and management endpoint
- XML sitemap dynamic generation endpoint
- Custom dashboard translations via `customTranslations` config option
- `registerDashboardTranslations()` API for runtime locale registration
- `extractDocContent` shared helper — single source of truth for document text extraction
- `parseJsonBody` shared helper — consistent JSON body parsing across all endpoints
- `fetchAllDocs` pagination helper — replaces hardcoded limit:500
- `loadMergedConfig` shared helper (deduplicated from audit.ts and validate.ts)
- `metaGeneration` shared helper (deduplicated from aiGenerate.ts and aiRewrite.ts)
- Admin role check (RBAC) on all destructive endpoints
- Timing-safe secret comparison for SEO logs endpoint
- Rate limiting on SEO logs POST endpoint
- SSRF DNS rebinding protection in external links checker
- Collection injection protection — validates collection parameter against whitelist
- API key read from environment variable instead of request body
- Cache eviction with LRU (max 500 entries)
- linkCache size limit (max 1000 entries)
- SeoLogs collection type options aligned with endpoint validation

### Changed
- warmCache accepts dynamic collections instead of hardcoded ['pages', 'posts']
- All POST endpoints use parseJsonBody for consistent error handling
- Error messages now include error type for easier debugging
- SeoSettings access restricted to admin role

### Fixed
- Variable shadow in externalLinks.ts (`url` → `link` in loop)
- typeOverride cast before validation in schemaGenerator.ts
- warmCache timer .unref() to prevent process hang
- Double cache invalidation in trackSeoScore

## [1.4.4] - 2026-03-12

### Changed
- Replaced all `console.log/warn/error` with `payload.logger` for proper structured logging (34 occurrences across 23 endpoint files, 2 hooks, 1 utility)
- Improved error messages in catch blocks — now return actual error message instead of generic "Internal server error"

### Fixed
- Added `try/catch` with JSON parse error handling on POST endpoints: `createRedirect`, `suggestLinks`, `aiRewrite`, `seoLogs`, `redirects` (POST/DELETE/PATCH), `settings`, `validate`
- Input trimming on string fields (`from`, `to`, `type`, `url`, `collection`, `id`, etc.) to prevent whitespace issues

## [1.4.2] - 2026-02-21

### Changed
- Removed sourcemaps from published package (package size reduced from 2.3 MB to 787 KB)
- Enriched npm keywords for better discoverability (11 → 27 keywords)
- Added `repository`, `homepage`, `bugs` fields to package.json
- Added `engines` field (`node >= 18`)

### Added
- LICENSE file (MIT)
- CHANGELOG.md

## [1.4.1] - 2026-02-20

### Changed
- Updated README with improved documentation

## [1.4.0] - 2026-02-20

### Added
- Full i18n support (French & English) with locale-adapted readability analysis
  - Kandel-Moles formula for French, Flesch-Kincaid for English
  - Bilingual passive voice detection, transition words, stop words
  - All 50+ SEO check messages translated
- `locale` option in plugin config (`'fr'` default, `'en'` available)
- `localeMapping` option to map Payload locales to analysis locales
- Bilingual constant accessors: `getStopWords(locale)`, `getActionVerbs(locale)`, etc.

### Fixed
- Socket.dev security alerts resolved
- Removed `xlsx` from peer dependencies (loaded dynamically)

### Changed
- Legacy exports (`calculateFleschFR`, `getStopWordsFR`, etc.) preserved as aliases

## [1.3.0] - 2026-02-20

### Added
- Initial public release
- 50+ SEO checks across 17 rule groups
- French readability scoring (Flesch FR / Kandel-Moles)
- Native Lexical JSON support for Payload CMS 3.x
- 9 admin dashboard views (SEO Dashboard, Sitemap Audit, Redirects, etc.)
- 5 auto-managed collections
- 20+ REST API endpoints
- Auto-redirect on slug change
- Score history tracking
- E-commerce SEO checks
- Accessibility checks (8 rules)
- Cornerstone content support
- Content freshness tracking
- Uninstall script (`npx seo-analyzer-uninstall`)

[1.7.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.4...v1.7.0
[1.4.4]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.2...v1.4.4
[1.4.2]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pOwn3d/payload-seo-analyzer/releases/tag/v1.3.0
