# Threat model — `@consilioweb/payload-seo-analyzer`

The plugin's security model and deliberate design choices.

## Surface & posture

- Every plugin endpoint requires an **admin-panel session** — not merely `req.user`. No mutating endpoint is anonymous.
  > A Payload app may expose several auth collections (staff `users` **and** front-office `customers`, members, subscribers…). Any of them populates `req.user` on every route, this plugin's endpoints included. `!!req.user` therefore never meant "an admin is calling". The gate is `helpers/isAdmin.ts::isSeoPanelUser`, which compares `req.user.collection` with `req.payload.config.admin.user`.
- Intentionally **public**, read-only, non-sensitive endpoints: `/robots.txt`, `/sitemap.xml`, `/sitemap-*.xml`, and the opt-in `/llms.txt`. These are deliberately **not** rate-limited (to avoid blocking Googlebot).

## Access control (RBAC)

- Two layers, both mandatory, in `helpers/isAdmin.ts`:
  1. `isSeoPanelUser(req)` — the session must come from the host's admin-panel collection (`config.admin.user`). Hosts with several admin-capable collections widen it with `SEO_ADMIN_USER_COLLECTIONS=users,staff`. When neither the user's collection nor the host's admin collection is known (mocks, non-sanitized config), the legacy authenticated-only behaviour applies — we never lock an admin out on missing information.
  2. `isSeoAdmin(user)` — the role check below. `isSeoAdminRequest(req)` is layer 1 + layer 2 and is what endpoints and collection `access` rules call.
- The same two layers apply to the plugin's **collections** (`seo-settings`, `seo-redirects`, `seo-gsc-auth`, `seo-performance`, `seo-logs`, `seo-score-history`, `seo-rank-history`): Payload auto-exposes their REST API, so an endpoint-only gate is bypassable.
- **Fail-open by default** on a role-less Payload setup (a `users` collection with no `role`/`roles` field): any admin-panel user is treated as privileged — otherwise legitimate admins would be locked out.
- **Opt-in strict mode**: `SEO_REQUIRE_ADMIN_ROLE=1` rejects users without an explicit `admin` role. Recommended for multi-user setups with roles.
- **Admin-only** endpoints (redirects CRUD, settings, robots, seo-logs, GSC disconnect, IndexNow, alerts) are gated by `isSeoAdminRequest`.
- Rate-limit buckets are keyed by `collection:id`, not by `id` alone — ids only being unique within one auth collection.

## `overrideAccess: true` — a deliberate choice (not a bug)

Two endpoint families, two rationales:

1. **Site-wide aggregation endpoints** (audit, sitemap-audit, link-graph, cannibalization, keyword-research, duplicate-content) intentionally use `overrideAccess: true`. An SEO audit must see **all** documents to be correct (orphan detection, broken links, duplicates); filtering by the current user's ACL would produce **false orphans**. These endpoints are admin tooling and go through `withRateLimit`.
2. **Single-document endpoints** (validate, generate, breadcrumb, schema-generator, ai-*) read a **specific** document the user requested. They are protected by a strict **allowlist**:
   - `collectionSlug` must be in `targetCollections` (else 403).
   - `globalSlug` must be in `targetGlobals` (else 403) — the IDOR fix in `generate.ts` and `validate.ts`.
   The user is editing/optimizing that document, so `overrideAccess` is acceptable within that restricted scope.

> For maximum hardening (field-level ACL on single-doc reads), switching these reads to `overrideAccess: false, user: req.user` is possible but **degrades** the analysis when the host hides fields from the user — not enabled by default, to avoid regressions for the published plugin.

## Open redirect

`helpers/redirectSafety.ts` validates every redirect `to`/`from`: it rejects `//evil.com`, `/\evil.com`, dangerous schemes (`javascript:`, `data:`, …) and CRLF. Applied in the redirect endpoints, the auto-redirect hook, **and** as a field-level `validate` on the `seo-redirects` collection (covering direct admin-UI edits).

**Absolute (cross-origin) destinations are refused by default.** `validateRedirectTarget` only *flags* them `external`; `validateRedirectDestination(raw, allowExternal)` is the gate every writer now goes through. A 301 from one of your own paths to another origin carries your domain's authority (phishing, OAuth `redirect_uri` abuse), so it is opt-in: set the plugin option `allowExternalRedirects: true`.

The gate fires only on a destination that **changes**. Payload revalidates the whole merged document on every write, so refusing an external value outright would freeze every row stored back when they were allowed — you could not even flip its 301/302 type. `validateRedirectDestinationChange()` (collection field) and the PATCH handler (which re-reads the stored value) therefore accept an unchanged legacy destination, without rewriting it, and refuse anything else.

The auto-redirect hook treats the new **slug** with `normalizeFromPath`, never `validateRedirectTarget`: a document slug can never legitimately produce an off-site destination.

## SSRF

- Outbound fetches target **fixed hosts** (api.anthropic.com, googleapis.com) — never a user-supplied host.
- `core-web-vitals`: origin restricted to the configured site.
- `ai-alt-text`: origin allowlist + http/https only + 5 MB cap.
- `external-links`: `helpers/ssrfGuard.ts` + `redirect: 'manual'` with **per-hop re-validation** (a 302 to `169.254.169.254`/localhost is blocked). The guard:
  - parses IPv6 properly (8 expanded groups) instead of `startsWith`, so `http://[::ffff:169.254.169.254]/` — normalized by `new URL()` to `[::ffff:a9fe:a9fe]` — is recognised. Embedded IPv4 (`::ffff:` mapped, `::` compatible, 6to4 `2002::/16`, NAT64 `64:ff9b::/96`) is re-checked with the IPv4 rules;
  - covers 0/8, 10/8, 127/8, 100.64/10 (CGNAT), 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4 and 240/4, plus `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`;
  - allows only ports 80/443 and the http/https schemes (no internal port scanning);
  - anti-DNS-rebinding checks **every** address returned by `dns.lookup(host, { all: true })`, not just the first.

## Secrets

- GSC OAuth tokens: encrypted at rest (AES-256-GCM, random IV, auth tag), `read: () => false` field, never logged. Key: `SEO_GSC_ENCRYPTION_KEY` (recommended in production), otherwise derived from `payload.secret`.
- API keys (Anthropic, PageSpeed, IndexNow): read **only** from environment variables, never stored in the DB.

## Rate limiting

- `rateLimiter.ts` (in-memory, best-effort). Key = **`user.collection` + `user.id`** when authenticated (not spoofable); falls back to IP (`X-Forwarded-For`, best-effort) for public endpoints.
- Applied to expensive endpoints: crawls, audit (poll-friendly), sitemap-audit, link-graph, performance, keyword-research, duplicate-content, cannibalization, external-links.
- LLM endpoints: `/ai-alt-text`, `/ai-content-brief` and `/ai-optimize-bulk` are on the 10 req/min expensive limiter. `/ai-rewrite` and `/ai-optimize` used to be registered with **no limiter at all**; they are driven one document at a time by a human click, so they run on a dedicated 30 req/min bucket — enough for a legitimate pass over a list, still a hard cap on the owner's Anthropic bill.
- A rate limit alone did not bound the site-wide audit: `/audit?nocache=1` dropped the cache and restarted a full rebuild as soon as the previous one finished. The manual refresh is now **admin-only** and throttled to one full rebuild per `SEO_AUDIT_MIN_REFRESH_MS` (default 5 min) per locale; a refused refresh returns the cached audit with `refreshThrottled: true`, not an error.
- `?nocache=1` forces the site-wide recomputation the aggregation endpoints exist to cache. On `/audit` it is admin-only **and** throttled (above); on `/cannibalization`, `/core-web-vitals`, `/duplicate-content`, `/external-links`, `/keyword-research`, `/link-graph`, `/redirect-chains` and `/sitemap-audit` it is admin-only — a panel user without the role silently gets the cached result rather than a 403.
- `/ai-content-brief` bounds its free-text `keyword` at 120 characters before it reaches the model — unbounded, it billed the site owner for arbitrary prompt length.
- **Recommendation**: also enforce a rate limit at the reverse-proxy level in production.

## robots.txt

`helpers/robotsSafety.ts::sanitizeRobotsRules` filters custom rules line by line (allowlisted directives only, control-char/CRLF stripping) — on both read (defense-in-depth) and write.

## Security-related environment variables

| Variable | Effect |
|----------|--------|
| `SEO_REQUIRE_ADMIN_ROLE=1` | Disable the RBAC fail-open (require an explicit admin role). |
| `SEO_ADMIN_USER_COLLECTIONS` | Comma-separated slugs accepted as admin-panel collections (default: `config.admin.user`). |
| `SEO_AUDIT_MIN_REFRESH_MS` | Minimum delay between two manual site-wide audit rebuilds (default 300000). |
| `SEO_GSC_ENCRYPTION_KEY` | Dedicated 32-byte key to encrypt GSC tokens (recommended). |
| `SEO_FETCH_MAX_DOCS` | Memory cap on the documents loaded by aggregation endpoints, `sitemap.xml` included (default 5000). |
| `SEO_SITEMAP_MAX_DOCS` | Same cap for the public sitemaps only (`sitemap.xml`, `sitemap-news/images/video.xml`); overrides `SEO_FETCH_MAX_DOCS` there. |
| `SEO_AI_MODEL` | LLM model override (default Sonnet; set `claude-opus-4-8` for max quality). |

## Public endpoints & content exposure

`sitemap.xml`, the `sitemap-*.xml` extensions and `llms.txt` are anonymous and built with
`overrideAccess: true`. They skip drafts **and** documents flagged `noindex`
(`doc.noindex` or `doc.meta.noindex`) — publishing the URL of a page the editor removed
from indexing is a leak, and it contradicted `/llms.txt`, which already honoured the flag.

Cost per request: `sitemap.xml` used to re-scan the whole corpus on every anonymous hit,
with a hard-coded 10 000-document read that ignored `SEO_FETCH_MAX_DOCS`. It now honours
the cap above and serves the rendered XML from the shared cache, invalidated by the same
`afterChange` hook as the other caches. The document is identical for every anonymous
caller, so the shared entry is neither an oracle nor a cross-user leak.

`overrideAccess: true` means these endpoints are **not** an access-control boundary:
a collection whose `read` is restricted to a subset of users must not be listed in
`targetCollections`.
