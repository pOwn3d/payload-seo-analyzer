# Threat model — `@consilioweb/payload-seo-analyzer`

The plugin's security model and deliberate design choices.

## Surface & posture

- Every plugin endpoint requires `req.user` (a Payload admin session). No mutating endpoint is anonymous.
- Intentionally **public**, read-only, non-sensitive endpoints: `/robots.txt`, `/sitemap.xml`, `/sitemap-*.xml`, and the opt-in `/llms.txt`. These are deliberately **not** rate-limited (to avoid blocking Googlebot).

## Access control (RBAC)

- Single admin gate: `helpers/isAdmin.ts::isSeoAdmin`.
- **Fail-open by default** on a role-less Payload setup (a `users` collection with no `role`/`roles` field): any admin-panel user is treated as privileged — otherwise legitimate admins would be locked out.
- **Opt-in strict mode**: `SEO_REQUIRE_ADMIN_ROLE=1` rejects users without an explicit `admin` role. Recommended for multi-user setups with roles.
- **Admin-only** endpoints (redirects CRUD, settings, robots, seo-logs, GSC disconnect, IndexNow, alerts) are gated by `isSeoAdmin`.

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

## SSRF

- Outbound fetches target **fixed hosts** (api.anthropic.com, googleapis.com) — never a user-supplied host.
- `core-web-vitals`: origin restricted to the configured site.
- `ai-alt-text`: origin allowlist + http/https only + 5 MB cap.
- `external-links`: private-IP allowlist + anti-DNS-rebinding (`resolveAndCheckPrivate`) + `redirect: 'manual'` with **per-hop re-validation** (a 302 to `169.254.169.254`/localhost is blocked).

## Secrets

- GSC OAuth tokens: encrypted at rest (AES-256-GCM, random IV, auth tag), `read: () => false` field, never logged. Key: `SEO_GSC_ENCRYPTION_KEY` (recommended in production), otherwise derived from `payload.secret`.
- API keys (Anthropic, PageSpeed, IndexNow): read **only** from environment variables, never stored in the DB.

## Rate limiting

- `rateLimiter.ts` (in-memory, best-effort). Key = **`user.id`** when authenticated (not spoofable); falls back to IP (`X-Forwarded-For`, best-effort) for public endpoints.
- Applied to expensive endpoints: LLM, crawls, audit (poll-friendly), sitemap-audit, link-graph, performance, keyword-research, duplicate-content, cannibalization, external-links.
- **Recommendation**: also enforce a rate limit at the reverse-proxy level in production.

## robots.txt

`helpers/robotsSafety.ts::sanitizeRobotsRules` filters custom rules line by line (allowlisted directives only, control-char/CRLF stripping) — on both read (defense-in-depth) and write.

## Security-related environment variables

| Variable | Effect |
|----------|--------|
| `SEO_REQUIRE_ADMIN_ROLE=1` | Disable the RBAC fail-open (require an explicit admin role). |
| `SEO_GSC_ENCRYPTION_KEY` | Dedicated 32-byte key to encrypt GSC tokens (recommended). |
| `SEO_FETCH_MAX_DOCS` | Memory cap on the documents loaded by aggregation endpoints (default 5000). |
| `SEO_AI_MODEL` | LLM model override (default Sonnet; set `claude-opus-4-8` for max quality). |
