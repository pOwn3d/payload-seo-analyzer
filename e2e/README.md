# End-to-end harnesses

Two independent, manually-run harnesses that exercise the plugin against a **real
Payload v3** — kept out of `pnpm test` on purpose (Payload + native deps like
libsql/sharp, and a browser, are heavy). Run them before a release.

| Harness | Folder | Layer | What it proves |
|---|---|---|---|
| Integration | `e2e/` (`e2e.mjs`) | Headless Payload API | Config transform, collection/field/hook registration, DB schema, `analyzeSeo`, meta writes |
| Admin UI | `e2e/ui/` | Browser (Playwright + Next.js) | The plugin's **admin views** mount and render without errors in a real browser |

---

## 1. Integration harness (`e2e/`)

Validates that `@consilioweb/payload-seo-analyzer` integrates and runs in a real
Payload v3 instance (not just unit tests): config transform, collection/field/hook
registration, DB schema, `analyzeSeo` on a real doc, and meta writes (the
bulk-apply target).

```bash
cd e2e
npm install payload@latest @payloadcms/db-sqlite@latest @payloadcms/richtext-lexical@latest @consilioweb/payload-seo-analyzer@latest sharp
node e2e.mjs   # exits 0 when all checks pass
```

---

## 2. Admin UI harness (`e2e/ui/`)

Boots a **real Next.js 15 app with the Payload admin mounted** and the SEO plugin
enabled, logs into the admin, then smoke-tests every plugin admin view in a real
Chromium browser. For each view it asserts:

- it did **not** bounce back to `/admin/login` (the server view rendered for the user),
- the admin shell (`.template-default`) is visible (the server component mounted),
- **no uncaught page exception** fired,
- **no same-origin 5xx** response occurred (the view's endpoints answered), and
- **no unexpected console error** was logged (benign dev-mode noise is filtered).

Views covered (single source of truth: `tests/helpers/views.ts`, mirroring the
`views[...]` registrations in `src/plugin.ts`):

`/admin/seo` · `/admin/performance` · `/admin/link-graph` · `/admin/sitemap-audit`
· `/admin/schema-builder` · `/admin/cannibalization` · `/admin/keyword-research`
· `/admin/redirects` · `/admin/seo-config`

### Install & run

> Requires a real browser, so it is **not** runnable in a headless CI sandbox
> without `playwright install`. Everything is wired up and ready — these are the
> only steps to actually execute it.

```bash
cd e2e/ui
npm install                 # installs Next.js, Payload, the plugin, Playwright, …
npx playwright install chromium   # one-time: download the browser
npm run test:e2e            # boots the dev server + runs the smoke tests
```

Useful variants:

```bash
npm run test:e2e:headed     # watch it drive the browser
npm run test:e2e:ui         # Playwright interactive UI mode
npm run test:e2e:report     # open the last HTML report
npm run dev                 # just boot the harness admin at http://localhost:3456/admin
```

The Playwright config starts the Next.js dev server automatically (`webServer`),
so you don't need a separate terminal. First run is slow: Next.js compiles each
admin route on first hit and Payload seeds the SQLite DB + admin user.

### Testing the LOCAL build (pre-release regression)

By default `package.json` pins the **published** plugin (`@consilioweb/payload-seo-analyzer@^1.19.0`).
To smoke-test your **working copy** instead, build it and install the local tarball
(a tarball is copied, not symlinked, so peer deps resolve cleanly — avoids the
duplicate-React/Payload pitfall a `file:` symlink would cause):

```bash
# from the repo root
pnpm build
npm pack                                   # -> consilioweb-payload-seo-analyzer-<version>.tgz
cd e2e/ui
npm install ../../consilioweb-payload-seo-analyzer-*.tgz
npm run test:e2e
```

### Default credentials & config (override via env)

| Env var | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3456` | App + test base URL |
| `E2E_ADMIN_EMAIL` | `admin@e2e.test` | Seeded admin user |
| `E2E_ADMIN_PASSWORD` | `test-Password-123!` | Seeded admin password |
| `PAYLOAD_SECRET` | `e2e-ui-secret-please-ignore` | Payload secret |
| `DATABASE_URI` | `file:./e2e-ui.db` | SQLite file |

The admin user is created once on first run via Payload's `create-first-user`
flow (idempotent — later runs just log in). Auth state is persisted to
`playwright/.auth/admin.json` and reused by every spec. A couple of sample
pages/posts are best-effort seeded so the data-driven views have content.

### How it's wired (file map)

```
e2e/ui/
├── package.json            # self-contained sub-project (own node_modules)
├── tsconfig.json           # Next.js tsconfig, @payload-config path alias
├── next.config.mjs         # withPayload()
├── payload.config.ts       # plugin mounted, all view features on, sqlite + lexical
├── app/(payload)/          # standard Payload v3 admin scaffold
│   ├── layout.tsx
│   ├── admin/importMap.js          # hand-authored — maps the plugin's 16 components
│   ├── admin/[[...segments]]/page.tsx, not-found.tsx
│   └── api/[...slug]/route.ts, api/graphql*/route.ts
├── playwright.config.ts    # setup project + chromium project + auto webServer
└── tests/
    ├── auth.setup.ts        # create-first-user / login + storageState + seed
    ├── admin-views.spec.ts  # one smoke test per view
    └── helpers/{constants,views}.ts
```

`app/(payload)/admin/importMap.js` is **hand-authored** so the harness works
without a generate step. If the plugin adds/renames a view or field component,
regenerate it with `npm run generate:importmap` (overwrites the file).

### Notes for maintainers

- `e2e/ui/` is a **standalone npm project** (like `e2e/`). It is *not* a pnpm
  workspace member and does **not** touch the repo's root `node_modules` or
  `package.json`. Nothing needs to be added to the root `package.json` to use it;
  optionally add a convenience script:
  `"test:e2e:ui": "cd e2e/ui && npm install && npx playwright install chromium && npm test"`.
- The view list lives in one place (`tests/helpers/views.ts`) — keep it in sync
  with `src/plugin.ts`.
- The smoke test filters known dev-mode console noise via
  `IGNORED_CONSOLE_PATTERNS` in `tests/helpers/constants.ts`; uncaught exceptions
  and 5xx are never filtered.
```
