# Changelog

All notable changes to `@consilioweb/seo-analyzer` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
