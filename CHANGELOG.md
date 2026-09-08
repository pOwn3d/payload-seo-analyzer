# Changelog

All notable changes to `@consilioweb/payload-seo-analyzer` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-09-08

**Second security release in a day.** 3.0.0 closed the endpoint gate; this one closes the door
standing next to it — the plugin's nine admin views, which Payload exempts from its own
`canAccessAdmin` redirect. Every version published so far, 3.0.0 included, carries the holes below.
Upgrade first if your Payload config declares more than one `auth` collection, or if your users
collection models `role` / `roles` as anything other than a plain string or an array of strings.

### Security

- **The nine admin views let any authenticated account into the admin shell, whatever collection
  its session came from.** Registering a custom admin view with a non-root `path` takes that route
  *out* of Payload's own access redirect: `@payloadcms/next::isCustomAdminView` matches on the URL
  path and never reads a visibility flag, so Payload delegates the authorization to the view
  component. All nine of this plugin's views (`/admin/seo`, `/admin/sitemap-audit`,
  `/admin/redirects`, `/admin/performance`, `/admin/keyword-research`, `/admin/cannibalization`,
  `/admin/link-graph`, `/admin/schema-builder`, `/admin/seo-config`) tested `!!initPageResult.req.user`
  and nothing else. A session on a **second auth collection** — front-office `customers`, members,
  subscribers — populates `req.user` on every route, so such an account rendered the Payload admin
  layout, which serializes the whole `clientConfig` (every collection, global and field of the CMS,
  their labels, their admin conditions) into that visitor's browser. Since 3.0.0 the data endpoints
  behind the views answer 401 to that account, so what leaked from a 3.0.0 install is the shell and
  the config, not the SEO data; **before 3.0.0 the endpoints answered too**. The views now call
  `helpers/viewAccess.ts::seoViewRedirectTarget`, which applies the same `isSeoPanelUser` rule as the
  endpoints and sends a foreign session to `/admin/unauthorized`, an anonymous one to the login
  screen — exactly what Payload's `handleAuthRedirect` would have done. **You were exposed if your
  Payload config declares more than one authenticated collection**; a single `users` collection was
  never reachable this way. Nothing in the plugin logs a view render, so there is no trace to audit
  here — judge by the shape of your config, not by your logs.

- **The RBAC fail-open asked about the *shape* of the role field instead of its *presence*, and
  promoted every panel user to SEO admin on a large class of hosts.** The documented fallback — a
  users collection with no role field at all treats any admin-panel user as privileged — was
  implemented as `typeof user.role !== 'string' && !Array.isArray(user.roles)`. A host that models
  `role` as a **relationship** (a number at the default `auth.depth: 0`, an object once populated) or
  `roles` as a **single-value select** (a bare string, not an array) fell straight through that test:
  the user was not an `admin`, the field was not a string, `roles` was not an array, so the fallback
  fired and returned `true`. Every editor, author or read-only contributor of such a host was an SEO
  admin. That is the full admin surface: the redirects CRUD (`POST /create-redirect`,
  `POST`/`PATCH`/`DELETE /redirects`), `POST /robots.txt`, `PATCH /settings`, `DELETE /seo-logs`,
  `POST /gsc/disconnect`, `POST /alerts-run` (which sends e-mail) and `POST /indexnow-submit`, plus
  the write ACLs of the seven plugin collections, which are built on the same helper. `isSeoAdmin`
  now collects role **names** from every shape the host may have used — string, array, populated
  relationship or select option read through `name` / `slug` / `value` / `role` / `label` / `title` —
  and falls open only when neither `role` nor `roles` exists on the user at all. **You were exposed
  if your users collection defines `role` or `roles` as anything other than a plain string or an
  array of strings**, and this one needs only a single auth collection to bite. Traces worth reading
  if you were: the rows of `seo-redirects`, `robotsCustomRules` in `seo-settings`, and whether
  `seo-logs` was emptied.

- **`POST /seo-logs` accepted writes the collection itself refuses, and its rate limiter never
  fired.** The `seo-logs` collection has been `create: isSeoAdminRequest` since 3.0.0, but the
  endpoint that writes it with `overrideAccess: true` only asked for `isSeoPanelUser` — so any panel
  account, of any role, could insert rows the REST API would have refused it, and the option's own
  contract ("POST requires authenticated admin user") did not hold. Those rows are the 404 report an
  admin turns into permanent 301 redirects. Two aggravating factors, both closed here: the POST
  limiter was keyed on the client IP alone, read from the caller-controlled `X-Forwarded-For`, so a
  caller who varied that header got a fresh 30-per-minute bucket on every request; and the create
  path had **no row cap at all** — the only plugin table without one — so a caller feeding unseen
  paths grew it for as long as they kept going, at up to 500 characters of `url`, `referrer` and
  `userAgent` each. The endpoint now requires an SEO admin when no `seoLogsSecret` is configured, the
  limiter key comes from the shared `rateLimiter.ts::rateLimitKey` (authenticated identity first,
  scoped `collection:id`, IP only as a fallback), and creation stops at `SEO_LOGS_MAX_ROWS` (default
  5000) while known URLs keep incrementing so the report goes on working. Note that on a host which
  *does* set `seoLogsSecret`, the growth vector is anonymous by design — the secret exists so 404
  middleware can log a visitor's hit — and an anonymous caller still keys by IP; the row cap is what
  bounds that case. Worth checking: the size of your `seo-logs` table, and whether any redirect was
  created from a 404 path you do not recognise.

- **The three sitemap extensions were anonymous, uncached, and their document cap did not stop the
  scan.** `/sitemap-news.xml`, `/sitemap-images.xml` and `/sitemap-video.xml` are public and
  deliberately not rate-limited (Googlebot must not be throttled), and they are the most expensive
  requests in the plugin: the image and video handlers read at `depth: 1`, populating every relation
  of every document and walking each tree for uploads. 3.0.0 gave `sitemap.xml` a cache and a real
  cap but left these three with neither. Worse, `SEO_SITEMAP_MAX_DOCS` was tested *after* the draft
  and `noindex` filters, so it counted only the documents actually emitted: a corpus of drafts or
  `noindex` pages was paginated in full, at depth 1, whatever the variable said. Any anonymous caller
  therefore turned one plain request into one complete corpus scan, and concurrent requests into as
  many. The rendered XML is now served from the shared cache — keys scoped by the handler's own
  collections, never by anything the caller sends — invalidated by the same `afterChange` hook as the
  other caches, and the cap counts every document **read**, filtered ones included, exactly like
  `fetchAllDocs`.

- **Every dashboard CSV export wrote editor-controlled text straight into spreadsheet cells
  (CWE-1236).** The eight export paths across six dashboard components serialized their cells by
  doubling the double-quotes and nothing else. Quoting is not protection here: Excel and LibreOffice
  strip the surrounding quotes *before* deciding whether a cell is a formula, so a value beginning
  with `=`, `+`, `-`, `@`, a tab or a carriage return is evaluated when the file is opened. The cells
  carry values a low-privileged editor writes — page title, meta title, meta description, focus
  keyword, slug, redirect path — and the file is opened later by an admin: the classic outcome is a
  formula that quietly ships the rest of the report to a domain the editor chose. All exports now go
  through `helpers/csv.ts::toCsv`, which prefixes a formula-leading cell with a single quote (read as
  "this is text" by every spreadsheet) while leaving plain numbers numeric, and a test fails the
  build if any component builds a CSV cell by hand again. **Exports downloaded before this upgrade
  are not retroactively fixed** — re-export before opening one in a spreadsheet.

- **The declared peer range accepted a Payload version with a pre-authentication account takeover.**
  `peerDependencies` asked for `payload`, `@payloadcms/next` and `@payloadcms/ui` at `^3.0.0`, i.e.
  anything from 3.0.0 up, and that range covers the versions vulnerable to GHSA-hp5w-3hxx-vmwf
  (account takeover through password recovery, reachable without authentication) and to an SQL
  injection through query handling — both fixed upstream in Payload **3.79.1**. The plugin never
  shipped those versions itself, but it told your package manager they were acceptable hosts for it.
  The floor moves to `>=3.79.1 <4.0.0` on all three packages. Check what you actually resolve
  (`pnpm why payload` / `npm ls payload`): a host still on Payload 3.0–3.79.0 needs the upstream
  upgrade regardless of this plugin.

### Breaking

- **`peerDependencies` now require Payload `>=3.79.1 <4.0.0`** for `payload`, `@payloadcms/next` and
  `@payloadcms/ui`, instead of `^3.0.0` — see the last Security entry for why. `next`
  (`^15.2.0 || ^16.0.0`) and `react` are unchanged. On a project below 3.79.1 the install now
  surfaces an unmet peer instead of resolving silently; upgrade Payload first, then this plugin.

- **Sessions from any collection other than the admin panel's lose the plugin's admin views.** They
  are redirected to `/admin/unauthorized` (anonymous visitors to the login screen) instead of
  rendering. If a second auth collection was reaching `/admin/seo` and that was deliberate, list it
  in `SEO_ADMIN_USER_COLLECTIONS=users,staff` — the same variable the endpoints already honour.

- **Panel users promoted by the old fail-open lose SEO-admin rights.** On a host that models `role`
  as a relationship or `roles` as a single-value select, *every* panel user was an SEO admin; now
  only those whose role actually reads `admin` are. Two consequences to check before upgrading: a
  legitimate admin whose role the plugin cannot read a **name** from — typically an unpopulated
  relationship, which arrives as a bare id at `auth.depth: 0` — is now denied rather than promoted,
  and the plugin logs one warning per collection per boot saying so. Give the role a readable value
  (a `select` or `text` field), or raise the collection's `auth.depth` so the relationship is
  populated and one of `name` / `slug` / `value` / `role` / `label` / `title` carries `admin`. Hosts
  with no `role`/`roles` field at all are unaffected: the fallback still applies to them, and
  `SEO_REQUIRE_ADMIN_ROLE=1` still removes it.

- **`POST /seo-logs` requires an SEO admin when no `seoLogsSecret` is configured**, where a plain
  panel session used to be enough. A 404 logger that relied on a logged-in editor's session now gets
  a 401. This is the supported path: set `seoLogsSecret` and have your middleware send the
  `X-SEO-Secret` header — that is also what lets it log hits from anonymous visitors, which a session
  never could.

### Fixed

- **The views sent anonymous visitors to a hard-coded `/admin/login`**, ignoring a host that renamed
  its admin route through `routes.admin` or its login/unauthorized routes through `admin.routes` — on
  such a site the redirect landed outside the panel. The target is now built from the host's own
  config, and joined so that an admin route of `/` can never produce a protocol-relative `//login`
  target.

### Changed

- **The news, image and video sitemaps are served from the shared cache.** A publish or unpublish
  invalidates them through the existing `afterChange` hook (`sitemap-news`, `sitemap-images` and
  `sitemap-video` joined `CACHE_BASES`), so a fresh article still appears immediately; outside that,
  staleness is bounded by the cache TTL.
- **`SEO_SITEMAP_MAX_DOCS` now counts every document read, not only those emitted.** On a corpus
  where drafts or `noindex` pages outnumber publishable ones, **the news / image / video sitemaps may
  contain fewer URLs than before** — the cap is reached while scanning past the filtered documents.
  Raise the variable if entries disappear from what Search Console has already discovered.
- **`POST /seo-logs` stops creating rows at `SEO_LOGS_MAX_ROWS`** (default 5000). Past the ceiling it
  answers `200` with `{ success: false, action: 'capped' }` and logs a warning once, while hits on
  URLs already recorded keep incrementing their counter — the 404 report the panel exists for goes on
  working. Clear the panel or raise the variable.
- **CSV cells beginning with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed with a single
  quote** in every dashboard export. Plain numbers — including negative metrics such as a position
  delta — are left numeric and unchanged. A downstream parser reading these files will see the extra
  leading quote on those cells only.
- Rate-limit buckets for `/ai-rewrite`, `/ai-optimize` and `POST /seo-logs` are built by one shared
  helper (`rateLimiter.ts::rateLimitKey`) rather than each path keying its own way, so no path can
  drift back to an IP-only bucket. In-memory counters reset on restart — no action needed.

### Added

- **`SEO_LOGS_MAX_ROWS`** (default `5000`) — ceiling on the rows `POST /seo-logs` may create.
- `helpers/csv.ts` (`csvCell`, `toCsv`) — the single CSV serializer used by every dashboard export,
  and `helpers/viewAccess.ts` (`seoViewRedirectTarget`) — the view access gate, kept free of
  `next/navigation` so it is unit-testable on its own. Both are internal; the package's public
  exports are unchanged.
- Non-regression tests for every finding above (`SEO-12` to `SEO-16` in
  `src/__tests__/securityRegressions.test.ts`, plus `src/__tests__/csv.test.ts`), including two that
  fail the build on a regression of shape rather than of behaviour: one asserts that no view keeps a
  bare `req.user` check, the other that no component builds a CSV cell by hand. The suite goes from
  **593 to 621 tests**.
- `docs/THREAT-MODEL.md` documents the custom-view exemption, the presence-not-shape rule behind the
  RBAC fallback and the CSV export policy; the README's environment, endpoint and collection tables
  record `SEO_LOGS_MAX_ROWS`, the new `POST /seo-logs` gate and the corrected `seo-logs` write
  column.

## [3.0.0] - 2026-09-08

**Security release.** Every version published so far, 2.0.0 included, carries the holes closed
here. Each entry below states what was exposed and to whom, so you can judge whether you were
concerned and whether your own data is worth auditing.

### Security

- **The admin gate accepted a session from *any* auth collection, not only the admin panel.**
  A Payload app routinely declares several `auth` collections — staff `users` plus front-office
  `customers`, members or subscribers. Any of them populates `req.user` on every route, this
  plugin's endpoints included, and `isSeoAdmin` looked only at `role` / `roles`. On the
  role-less setups the documented fail-open covers, a front-office customer therefore passed
  the admin gate outright; on every setup they passed the `!!req.user` gate. That handed an
  ordinary customer account the admin surface: `POST /create-redirect` and the whole redirects
  CRUD, `POST /robots.txt`, `PATCH /settings`, `DELETE /seo-logs`, `POST /gsc/disconnect`,
  `POST /alerts-run` (which sends e-mail) and `POST /indexnow-submit`. Two explicit layers
  replace it: `isSeoPanelUser(req)` compares `req.user.collection` with
  `req.payload.config.admin.user`, and `isSeoAdminRequest(req)` is that check plus the role
  check; both are applied on the endpoints *and* on the plugin's collections. **You were
  exposed if your Payload config declares more than one authenticated collection** — a single
  `users` collection was never reachable this way. Traces worth reading if you were: the rows
  of `seo-redirects`, `robotsCustomRules` in `seo-settings`, and whether `seo-logs` was
  emptied. Hosts where several collections legitimately reach the panel widen the gate with
  `SEO_ADMIN_USER_COLLECTIONS=users,staff`.

- **The site-wide aggregation endpoints published the whole corpus, drafts included, to any
  authenticated account.** `/audit`, `/link-graph`, `/duplicate-content`, `/keyword-research`,
  `/cannibalization`, `/indexation-audit`, `/sitemap-audit` and `/suggest-links` were gated by
  `!!req.user` alone while reading with `overrideAccess: true`, and their responses carry
  `title`, `slug`, `metaTitle`, `metaDescription`, word counts and scores for every document of
  every target collection — unpublished drafts (product launches, pages in preparation)
  included, and documents the caller's own `access.read` would have refused. On the same gate:
  `POST /validate`, which reads any `{ id, collection }` within the configured allowlist, and
  `GET /gsc/status`, which returns the connected Google account e-mail and the OAuth
  `redirectUri` — plus `/breadcrumb`, `/check-keyword`, `/generate`, `/ai-generate`,
  `/history`, `/schema-generator` and `/sitemap-config`. Reachable by a front-office customer
  as above, and by any panel account whatever its role. All of them now require an admin-panel
  session. Note that `SEO_STRICT_READ_ACCESS=1` never covered this: it only applies to
  single-document reads, not to the aggregations.

- **`seo-performance`, `seo-logs` and `seo-score-history` were writable through the collection
  REST API by any authenticated account.** Payload exposes a REST API for every collection, so
  the endpoint-level gate was never the only door. The June hardening had covered only
  `seo-settings`, `seo-redirects` and `seo-gsc-auth`; the other four kept
  `create`/`update`/`delete` (or at least `create`) on `!!req.user`, and all seven kept `read`
  on `!!req.user`. Consequences for an unprivileged account: deleting the imported Search
  Console history (`seo-performance` — CSV imports and daily snapshots are not
  reconstructible), forging `seo-score-history` snapshots, which feed the alert digest mailed
  to admins, and reading `seo-logs`, i.e. the 404 URLs, referrers and user-agents of anonymous
  visitors. `read` is now admin-panel-only on all seven, writes are SEO-admin-only, and
  `seo-rank-history` / `seo-score-history` keep their stricter `role === 'admin'` on
  `update`/`delete`.

- **SSRF: the private-address filter of `/external-links` did not recognise IPv4-mapped IPv6
  literals.** `isPrivateIP` matched IPv4 with a dotted-quad regex and IPv6 with a handful of
  `startsWith` tests, so an address written in the `::ffff:` mapped form — the form `new URL()`
  normalizes such a host to — was classified public by *both* the hostname pass and the
  DNS-rebinding pass, and the server issued the request. Loopback, the RFC 1918 ranges and the
  link-local cloud metadata range were reachable that way, per-hop redirect re-validation
  included, and the HTTP status and error class come back in the endpoint's JSON — enough to
  map internal services. The actor is anyone who can put a link into tracked content, i.e. any
  editor. Replaced by `helpers/ssrfGuard.ts`, which expands IPv6 to its eight groups and
  re-checks any embedded IPv4 (`::ffff:` mapped, `::` compatible, 6to4, NAT64) with the IPv4
  rules, adds the missing ranges (0/8, 100.64/10 CGNAT, 192.0.0/24, 198.18/15, multicast and
  reserved), restricts the scheme to http(s) and the port to 80/443, and rejects the host if
  **any** address returned by `dns.lookup(host, { all: true })` is private — only the first
  answer was checked before.

- **Redirect destinations on another origin were accepted everywhere, with no way to forbid
  them.** `validateRedirectTarget` flagged an absolute `http(s)` destination as `external` so
  that "callers can gate them if needed", and no caller ever read the flag. Every redirect
  writer — `POST /create-redirect`, `POST`/`PATCH /redirects`, the `seo-redirects` admin UI —
  was therefore an unconditional site-hijack primitive: a permanent 301 from one of your own
  paths to an attacker's origin, served with your domain's authority (phishing, OAuth
  `redirect_uri` abuse, SEO reputation), and stored as ordinary content, so the host
  application logs nothing. The gate now exists and is closed by default; open it with the new
  `allowExternalRedirects: true` plugin option. Separately, the auto-redirect hook validated
  the *new slug* of a document as a redirect target, so an editor who typed an absolute URL
  into a slug field produced an off-site 301 without touching the redirects collection at all;
  a slug now goes through `normalizeFromPath`, which can only yield a site-relative path.

- **`sitemap.xml` published the URLs of `noindex` documents to anonymous visitors.** The public
  sitemap skipped drafts and the hand-maintained `excludedSlugs` list, but never looked at
  `doc.noindex` / `doc.meta.noindex` — a filter `/llms.txt` already applied. Any anonymous
  caller therefore collected the slugs of published pages the editor had explicitly removed
  from indexing (post-purchase thank-you pages, private pricing, test landing pages). The
  filter is now applied by `sitemap.xml` and by the news / image / video sitemaps. Reminder,
  now stated in the threat model: these endpoints are built with `overrideAccess: true` and are
  **not** an access-control boundary — a collection with restricted `read` must not be listed
  in `targetCollections`.

- **Any authenticated account could keep the site-wide rebuild running permanently.**
  `GET /audit?nocache=1` dropped the cache and started a full rebuild — up to
  `SEO_FETCH_MAX_DOCS` documents at full `depth` — and the single-flight guard bounded only
  *concurrent* builds, so a request loop restarted one as soon as the previous finished, at the
  120 req/min poll limiter. That is the load documented as having OOM-killed the process on
  low-memory hosts, and it takes the public site down with Next.js. Manual refresh is now
  reserved to SEO admins and throttled to one full rebuild per `SEO_AUDIT_MIN_REFRESH_MS`
  (default 5 min) per locale. The same `?nocache=1` gate is applied to `/cannibalization`,
  `/core-web-vitals`, `/duplicate-content`, `/external-links`, `/keyword-research`,
  `/link-graph`, `/redirect-chains` and `/sitemap-audit`.

- **The cache key of those endpoints was derived from the caller-supplied `?locale=`.** Payload
  only sanitizes `req.locale` when a `localization` block exists (and, even then, not when
  `fallback` is off), so on a single-language site the raw query string reached the cache key
  untouched. Varying it gave a guaranteed cache miss on every request — no cache, no
  single-flight, one full site-wide recomputation per request — which walked straight past both
  the admin gate and the refresh throttle above, and grew an unbounded key space in the LRU
  cache and in the refresh-timestamp map. The locale that scopes a cache key now comes from
  `helpers/safeCacheLocale.ts` and must be one of the host's own `localization.localeCodes`.

- **`sitemap.xml`, the only anonymous endpoint, was also the most expensive request in the
  plugin.** It passed a hard-coded `limit: 10000` to `fetchAllDocs`, which takes precedence
  over `SEO_FETCH_MAX_DOCS`: an operator who had lowered that variable to survive on a
  constrained host still loaded 10 000 documents on every anonymous hit, with no caching of the
  rendered XML, so a plain `curl` loop re-scanned the whole corpus each time. The cap now comes
  from `SEO_SITEMAP_MAX_DOCS` (falling back to `SEO_FETCH_MAX_DOCS`, default 5000) and the
  rendered XML is served from the shared cache, invalidated by the existing `afterChange` hook.
  The deliberate absence of a rate limit on public endpoints is unchanged.

- **`POST /seo-logs` stored visitor-controlled `referrer` and `userAgent` with no length
  bound.** `url` was refused past 500 characters; the other two — the raw `Referer` and
  `User-Agent` headers relayed by the host middleware — went to the database untouched. An
  anonymous visitor requesting a missing page with a multi-kilobyte `Referer` grew the
  `seo-logs` table in bytes rather than rows (the row is upserted, so the value is overwritten
  on each hit), and the admin 404 panel reads those fields back. Both are now truncated at 500
  characters rather than rejected, so the 404 report itself is never dropped.

- **`/ai-rewrite` and `/ai-optimize` were registered with no rate limiter at all, and
  `/ai-content-brief` forwarded an unbounded free-text `keyword` to the model.** Combined with
  the `!!req.user` gate, that made these endpoints a metered Claude relay billed to the site
  owner's `ANTHROPIC_API_KEY` — reachable, before the gate fix above, from a front-office
  account — and a prompt-injection surface, the keyword being concatenated at the head of the
  prompt. `/ai-rewrite` and `/ai-optimize` now run on a dedicated 30 req/min-per-user bucket
  and `keyword` is capped at 120 characters.

- **Rate-limit buckets were keyed by `user.id` alone.** Ids are unique only within an auth
  collection, so `users#3` and `customers#3` shared one quota — one could exhaust the other's
  budget or hide inside it. The key is now `collection:id`.

### Fixed

- **A non-ASCII `seoLogsSecret` made every `POST /seo-logs` fail with a 500.** The shared-secret
  comparison tested JavaScript string length (code units) before handing the values to
  `timingSafeEqual`, which compares byte lengths: a secret containing any non-ASCII character
  passed the first test and threw inside the second. The comparison goes through the existing
  byte-safe `safeEqual` helper, so such a secret now authenticates instead of erroring — the
  timing-safe property is preserved.

### Changed

- **External redirect destinations are refused unless you opt in.** With
  `allowExternalRedirects` left at its default `false`, `POST /create-redirect`, the bulk
  `POST /redirects` import and the `seo-redirects` admin UI reject an absolute `http(s)`
  destination; site-relative paths are unaffected. **Rows created before the upgrade stay
  editable**: the gate only refuses a destination that *changes*, so an existing external
  redirect can still have its source path or its 301/302 type edited, and the stored
  destination is left as it is. A bulk import containing external destinations will now report
  them in `failed`, and the auto-redirect hook silently stops producing a redirect when a slug
  is an absolute URL. Set `allowExternalRedirects: true` if you genuinely rely on cross-origin
  redirects.
- **`sitemap.xml` is now served from a shared cache and honours the document cap.** A publish
  or unpublish invalidates it through the existing `afterChange` hook; outside that, staleness
  is bounded by the cache TTL, well under the one-hour `Cache-Control` the endpoint has always
  advertised. The cap moving from a hard-coded 10 000 to `SEO_SITEMAP_MAX_DOCS` /
  `SEO_FETCH_MAX_DOCS` (default 5000) means **a site with more than 5 000 documents loses
  entries from its sitemap unless the variable is raised**. `noindex` documents are dropped
  from `sitemap.xml` and from the news / image / video sitemaps, so URLs may disappear from
  what Search Console has already discovered.
- **`?nocache=1` is silently ignored for a panel user without the admin role** on `/audit`,
  `/cannibalization`, `/core-web-vitals`, `/duplicate-content`, `/external-links`,
  `/keyword-research`, `/link-graph`, `/redirect-chains` and `/sitemap-audit`: they get the
  cached result rather than a 403, so nothing breaks visibly, but a "refresh" click by a
  non-admin no longer recomputes. On `/audit`, an admin refresh is additionally throttled to
  one rebuild per `SEO_AUDIT_MIN_REFRESH_MS`.
- **Cache scoping ignores an unknown `?locale=`.** A locale absent from
  `localization.localeCodes` — and every `?locale=` value on a site with no `localization`
  block — now falls back to the unscoped cache key instead of getting its own.
- **`/external-links` reports a link on a port other than 80/443 as `blocked-private-ip`.** The
  port allowlist is what stops the checker from doubling as an internal port scanner; a
  legitimate external link on a non-standard port is collateral, and shows up as blocked rather
  than as checked.
- **`POST /ai-content-brief` answers `400` when `keyword` exceeds 120 characters**, and
  `POST /seo-logs` truncates `referrer` and `userAgent` at 500 characters instead of storing
  them whole.
- Rate-limit buckets are keyed by `collection:id`, which resets existing in-memory counters on
  restart — no action needed.
- CI actions are pinned to commit SHAs rather than floating tags.

### Added

- **`allowExternalRedirects` plugin option** (`boolean`, default `false`) — see Changed.
- **`SEO_ADMIN_USER_COLLECTIONS`** — comma-separated collection slugs accepted as admin-panel
  users, for hosts where more than one collection legitimately reaches the panel. Defaults to
  `config.admin.user`.
- **`SEO_AUDIT_MIN_REFRESH_MS`** (default `300000`) — minimum delay between two manual
  site-wide audit rebuilds.
- `GET /audit` returns `refreshThrottled: true` alongside the cached results when a manual
  refresh was refused, so the UI can say "showing cached results" instead of reporting an
  error.
- A non-regression test suite for every finding above (`src/__tests__/securityRegressions.test.ts`),
  and the collection-access tests extended to all seven plugin collections and to sessions
  coming from a foreign auth collection.
- A `Security` workflow (pnpm audit at `--audit-level high`, gitleaks secret scan, CodeQL with
  `security-extended`), run on push, on pull requests and weekly, plus Dependabot for npm and
  GitHub Actions.

## [2.0.0] - 2026-09-07 — Correct public URLs, admin-only writes, verifiable releases

### Breaking

- **Every URL the plugin generates now carries the collection's route prefix.** A `posts`
  document is served at `/posts/<slug>` by default instead of `/<slug>`, which changes
  `sitemap.xml`, the news/image/video sitemaps, the `/sitemap-config` preview, the canonical
  and the Open Graph URL produced by `buildSeoMetadata`, the `@id` / `url` of the Article,
  LocalBusiness, Product, Person and Event JSON-LD, and the URLs submitted to IndexNow.
  Each of them built the public URL from the bare slug whatever the collection, so a post's
  sitemap entry pointed at a 404 and its canonical did too — a canonical to a 404 can
  deindex the real page. `llms.txt` is the exception: it hardcoded `/posts/<slug>`, so its
  default output is unchanged, but it goes through the same builder now and follows
  `collectionRoutes` like everything else.
  **If your posts are served flat**, restore the previous URLs with one option:

  ```ts
  seoAnalyzerPlugin({ collectionRoutes: { posts: '' } })
  ```

  and pass the same map to the frontend helpers you call yourself:
  `buildSeoMetadata(doc, { collection, collectionRoutes: { posts: '' } })` and
  `buildJsonLd(doc, { collection, collectionRoutes: { posts: '' } })`.
  Any other prefix is declared the same way, e.g. `{ projects: 'work' }`.
  Prefixing is idempotent and slug slashes are trimmed, which also moves the output for two
  storage habits: a slug already stored as `posts/my-article` yields `/posts/my-article`
  rather than being doubled, and a slug stored as `/my-article` yields `/posts/my-article`
  instead of the previous `//my-article`.

- **A document slugged `home` now resolves to the site root, and no option restores `/home`.**
  `buildDocPath` maps the slug `home` — the convention of Payload's website template — to the
  empty path, before any `collectionRoutes` lookup. So `buildSeoMetadata` emits a canonical
  and an `og:url` of `https://site` where it emitted `https://site/home`, `buildJsonLd` does
  the same for the Article `@id` and the LocalBusiness / Product / Person / Event `url`, the
  `llms.txt` entry follows, and the `/sitemap-config` preview shows `/` instead of `/home`.
  `sitemap.xml`, the news/image/video sitemaps and IndexNow already special-cased `home` and
  do not move. **On a site that really serves its home page at `/home`**, the canonical and
  the Open Graph URL can still be pinned with an explicit `canonicalUrl` on the document, and
  the Person / LocalBusiness nodes with an explicit `url` field, but the Article `@id` and the
  Product / Event `url` cannot be overridden. In the same change, a document with an empty
  slug loses the trailing slash of its JSON-LD `@id` / `url`: `https://site`, not
  `https://site/`.

- **`seo-settings`, `seo-redirects` and `seo-gsc-auth` are writable by SEO admins only.**
  `create`, `update` and `delete` move from `!!req.user` to `isSeoAdmin(req.user)`; `read` is
  unchanged. On a role-less Payload install nothing changes — `isSeoAdmin` still fails open
  for any authenticated panel user unless `SEO_REQUIRE_ADMIN_ROLE=1`. On an install **with**
  roles, a non-admin editor loses the ability to write these three collections through the
  REST API and the admin UI. See Security for what that door opened onto.

- **`POST /api/seo-plugin/ai-alt-text` no longer accepts a `collection` in the body.**
  A request naming anything other than the configured `uploadsCollection` now gets a `403`;
  the target is always `uploadsCollection`. The admin panel is unaffected — it echoes back the
  value the server gave it. A third-party caller that passed another collection must drop the
  field.

- **Node 18 is no longer supported.** `engines.node` becomes `^20.19.0 || >=22.12.0`, in line
  with the Payload/React 19 peers and with the new CI matrix (Node 20 and 22).

### Security

- **Stored XSS through `renderJsonLdScript`, on the public site.** `JSON.stringify` escapes
  neither `<` nor `>`, so an editorial value carrying a closing `</script>` sequence — a title
  or a meta description, writable by anyone with edit rights on a document — closed the JSON-LD
  block and let the browser parse the remainder as HTML, for every anonymous visitor of the
  page. Serialization now goes through the new `serializeJsonLd`, which escapes `<`, `>`, `&`,
  U+2028 and U+2029 as JSON escape sequences: the output bytes change, the parsed object does
  not, so rich results are unaffected. **If you inline JSON-LD yourself**, replace
  `JSON.stringify(...)` with `serializeJsonLd(...)` inside your `dangerouslySetInnerHTML` — the
  README and the JSDoc recommended the unsafe form and have been corrected.

- **Reflected XSS on `GET /api/seo-plugin/gsc/callback`.** The `error` value reflected from
  Google's redirect was interpolated raw into the plugin's only `text/html` response, a page
  reached with an authenticated admin session. Both interpolations are escaped now, and the
  response carries `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
  base-uri 'none'; form-action 'none'`, `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.

- **HTML injection in the alert digest email.** 404 paths logged from anonymous visitors and
  Search Console queries were interpolated raw into the digest mailed to administrators,
  letting anyone who hits a crafted 404 place arbitrary markup — a phishing link, typically —
  inside a message legitimately sent by the CMS. Every non-numeric value is escaped.

- **Privilege escalation through the plugin collections** (the change is described under
  Breaking). With `create`/`update`/`delete` open to any authenticated user, an editor could
  write `robotsCustomRules` — `Disallow: /` is allow-listed by `robotsSafety`, i.e. site-wide
  deindexation — create a redirect to an external domain, clear `disabledRules`, or overwrite
  the OAuth CSRF `pendingState` of `seo-gsc-auth`. The same operations were admin-only on the
  endpoint path, and `SEO_REQUIRE_ADMIN_ROLE` had no effect on the collection path.

- **ReDoS in the duplicate-content rule.** `quality-no-duplicate` matched `/(.{30,})\1/i`,
  whose backtracking on *non-matching* text — the normal case — cost hundreds of milliseconds
  on a 1 000-word document and several seconds past 2 500 words. That ran on every keystroke
  in the editor and on every document of every site-wide audit, reachable by any user with
  write access. It is replaced by a linear tandem-repeat detector looking for the same thing
  (a block of at least 30 characters immediately repeated), with two differences at the edges:
  slice comparisons are capped at 2 000, so a repeat that only appears past that cap is now
  missed, and the detector compares raw slices, so a repeated block straddling a line break is
  now reported where `.` never matched one. Neither is expected to change the verdict on
  editorial content.

### Added

- **`collectionRoutes` option** — `Record<string, string>`, default `{ posts: 'posts' }` —
  available on the plugin config, `SeoConfig`, `BuildJsonLdOptions` and `SeoMetadataOptions`.
- New public exports: `serializeJsonLd`, `buildDocPath`, `buildDocUrl`,
  `DEFAULT_COLLECTION_ROUTES` and the `CollectionRoutes` type, so a host can build exactly the
  URLs the sitemap, the canonical and the JSON-LD use.
- `fetchAllDocs` accepts a `select` projection (`{ title: true, slug: true }`) to stop loading
  whole documents when only a few scalar fields are needed; it retries without the projection,
  logging a `warn`, when a collection rejects the requested fields.
- `POST /api/seo-plugin/redirects` (bulk import) now returns `failed` — up to 100
  `{ from, to, reason }` entries — and `failedTruncated`, next to the existing `created`,
  `skipped` and `errors` counters. Each failure is also logged through `req.payload.logger.warn`.
- GitHub Actions CI (typecheck, build and tests on Node 20 and 22) plus a tag-triggered
  `npm publish --provenance`, so releases from 2.0.0 on are attested. `.github/` and `docs/`
  were gitignored until now, so neither the workflows nor `docs/THREAT-MODEL.md` were in the
  repository at all; `prepublishOnly` now runs `typecheck && test && build`.
- Tests covering URL building, HTML escaping, collection access, the redirects import, the
  suggest-links index and the uninstall script — `vitest.config.ts` also runs
  `scripts/**/__tests__` now.

### Changed

- **`POST /api/seo-plugin/suggest-links` is rate limited and cached.** 120 requests per minute
  per IP (the poll-friendly limiter already used by `/audit`, sized for the editor's 2 s
  debounce). Its corpus is built once into `suggest-links-index:<locale>` and reads only
  `title`, `slug` and `focusKeyword` instead of the full Lexical tree of up to 5 000 documents
  on every poll. The index is invalidated on every tracked document save and otherwise expires
  after 15 minutes, so a change made outside the tracked collections can take that long to
  appear in suggestions.
- `next` is now a declared peer dependency (`^15.2.0 || ^16.0.0`). It is marked optional, so no
  install fails, but package managers will warn on an out-of-range Next — ten source files
  import `next/navigation` and nothing declared it before.
- `package.json` declares `sideEffects`, limited to `./dist/client.js` and `./dist/client.cjs`.
  Bundlers will tree-shake the `.` and `./views` entries more aggressively than before; worth a
  check on your host build.
- `seo-analyzer-uninstall` exits with code `1` and prints "Uninstall incomplete", listing the
  commands that failed, instead of always announcing success. Automation that ignored the exit
  code will now see the failure.

### Fixed

- **`seo-analyzer-uninstall` used to remove nothing.** The script hardcoded
  `@consilioweb/seo-analyzer` while the package is published as
  `@consilioweb/payload-seo-analyzer`: no import matched, the removal command removed nothing,
  the error was swallowed, and it still printed "Uninstall complete" over a project where the
  plugin was still registered and freshly present in the importmap. The name is read from
  `package.json` now, and the list of droppable collections it prints includes `seo-gsc-auth`
  and `seo-rank-history`.
- **Bulk redirect import no longer trips `SQLITE_BUSY`.** The 50 creations of a batch ran in a
  `Promise.all` while SQLite is single-writer, and the Redirect Manager posts the whole CSV in
  a single call. Creations are sequential now, as in the CSV import of `performance.ts`. The
  deduplication query also used `limit: batch.length * 2`, which could truncate the existing
  set and let the import create duplicates; it uses `pagination: false`.
- **The link graph froze on hover.** Every edge looked its own index up with
  `data.edges.indexOf(edge)` on each hover render — O(edges²), around 9 million comparisons at
  3 000 edges. The edge is tested directly against the hovered node now; the rendering is
  unchanged.

## [1.22.0] - 2026-08-08 — Truthful audits: no more silent partial results

### Added
- **`SEO_AUDIT_TRUST_FILE=1`** — serve the prebuilt audit cache file *without* the staleness
  check. The check compares against `seoCache.lastInvalidatedAt`, an **in-memory** clock: it
  resets on every boot and any content edit pushes it to `Date.now()`. On a memory-constrained
  host the consequence is perverse — a single edit marks the file stale, the handler falls back
  to the very site-wide rebuild the option exists to avoid, and the container OOMs. The option
  was therefore unusable on the host it targets, to the point that a consumer had to neutralise
  the line with `patch-package`. Freshness is then guaranteed differently: the CI prewarm
  regenerates the file on every deploy. **Default behaviour is unchanged** — the check stays on.

### Fixed
- **`fetchAllDocs` no longer presents a partial result as a complete one.** The whole pagination
  loop sat inside a single `try/catch` commented *"Collection might not exist — skip"*, which
  conflated two very different situations: an error on **page 1** (the collection is missing —
  the tolerated case) and an error on **page 2 or beyond** (the collection exists, documents were
  already read, and pagination breaks mid-way). In the second case the function silently returned
  what it had, indistinguishable from a full read — so every analysis built on it (orphan pages,
  broken links, cannibalisation) flagged documents that had simply never been loaded. A wrong
  report is worse than a missing one: people act on it. Page 1 keeps the tolerant behaviour; any
  later failure is now logged at `error` level with the collection, page number and count read so
  far, and explicitly marked INCOMPLETE.

## [1.21.1] - 2026-06-26 — Fix: keep node:fs out of the client bundle

### Fixed
- The build-time audit cache (1.21.0) added a top-level `node:fs/promises` import in the audit
  module; tsup left it as a side-effect import in the **client** bundle, breaking consumer
  builds (`Module not found: fs/promises` in the admin UI). The fs import is now dynamic and
  server-only, so it is tree-shaken out of the client bundle. Upgrade straight to 1.21.1.

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

[4.0.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v3.0.0...v4.0.0
[1.7.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.4...v1.7.0
[1.4.4]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.2...v1.4.4
[1.4.2]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pOwn3d/payload-seo-analyzer/releases/tag/v1.3.0
