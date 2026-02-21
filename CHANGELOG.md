# Changelog

All notable changes to `@consilioweb/seo-analyzer` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.4.2]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/pOwn3d/payload-seo-analyzer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pOwn3d/payload-seo-analyzer/releases/tag/v1.3.0
