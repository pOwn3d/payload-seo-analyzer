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

Boots a **real Next.js 16 app with the Payload 3.90 admin mounted** and the SEO
plugin enabled, logs into the admin, then smoke-tests every plugin admin view in a
real Chromium browser. For each view it asserts:

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

`tests/document-sidebar.spec.ts` then opens a real post in the editor, where
Payload mounts the plugin's fields itself, and checks that the interface follows
the (English) admin language while the analysis stays French, and that the
"Generate" button of the meta title reaches the server's `generateTitle`.

### Install & run

> Requires a real browser, so it is **not** runnable in a headless CI sandbox
> without `playwright install`. Everything is wired up and ready — these are the
> only steps to actually execute it.

```bash
cd e2e/ui
npm run pack:plugin         # builds the working copy into plugin.tgz and installs everything
npx playwright install chromium   # one-time: download the browser
npm run test:e2e            # boots the dev server + runs the specs
```

No Playwright browser download available (proxy, offline CDN)? Drive the Google
Chrome already installed instead — video recording is then off, since it needs
Playwright's own ffmpeg:

```bash
PW_CHANNEL=chrome npm run test:e2e
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

### Which plugin build is tested

`package.json` points the plugin at `file:./plugin.tgz`, the **working copy**
packed by `npm run pack:plugin` (git-ignored). A tarball is copied, not
symlinked, so peer deps resolve cleanly — a `file:` symlink to the repo would
load a second React and Payload. Re-run `pack:plugin` after every change: it
reinstalls the tarball explicitly, because npm otherwise keeps the copy recorded
in the lockfile for a tarball whose version did not change.

To test a **published** version instead:

```bash
npm install --no-save @consilioweb/payload-seo-analyzer@<version>
npm run test:e2e
npm run pack:plugin   # back to the working copy
```

### Default credentials & config (override via env)

| Env var | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3456` | App + test base URL |
| `E2E_ADMIN_EMAIL` | `admin@e2e.test` | Seeded admin user |
| `E2E_ADMIN_PASSWORD` | `test-Password-123!` | Seeded admin password |
| `PAYLOAD_SECRET` | `e2e-ui-secret-please-ignore` | Payload secret |
| `DATABASE_URI` | `file:./e2e-ui.db` | SQLite file |

The admin user is created on first run through Payload's `first-register`
endpoint, then every run logs in through `/api/users/login` — the endpoints
behind the forms, because the create-first-user form re-renders when its server
form state lands and can wipe a typed password. Auth state is persisted to
`playwright/.auth/admin.json` and reused by every spec. A couple of sample
pages/posts are seeded so the data-driven views have content.

REST calls from a spec go through `page.request` with `API_HEADERS`
(`tests/helpers/constants.ts`): Payload 3.90+ only honours the session cookie on
an API request that sends an `Origin` header, and runs it anonymously otherwise.

The suite runs on **one worker, with React StrictMode off**. Every spec is the
same admin, and the plugin caps its expensive endpoints at 10 requests/min per
user: parallel workers, or StrictMode's doubled effects in dev, would exceed it
where a real user never does. A 429 stays a failure, since one on a legitimate
pass is a real bug.

### How it's wired (file map)

```
e2e/ui/
├── package.json            # self-contained sub-project (own node_modules)
├── tsconfig.json           # Next.js tsconfig, @payload-config path alias
├── next.config.mjs         # withPayload(), StrictMode and agent rules off
├── payload.config.ts       # plugin mounted, all view features on, generateTitle, sqlite + lexical
├── app/(payload)/          # standard Payload v3 admin scaffold
│   ├── layout.tsx
│   ├── admin/importMap.js          # generated by `npm run generate:importmap`
│   ├── admin/[[...segments]]/page.tsx, not-found.tsx
│   └── api/[...slug]/route.ts, api/graphql*/route.ts
├── playwright.config.ts    # setup project + chromium project + auto webServer
└── tests/
    ├── auth.setup.ts        # first-register / login + storageState + seed
    ├── admin-views.spec.ts  # one smoke test per view
    ├── document-sidebar.spec.ts  # the plugin's fields in a real post editor
    └── helpers/{constants,views}.ts
```

`app/(payload)/admin/importMap.js` is committed so the harness works without a
generate step. If the plugin adds/renames a view or field component, regenerate
it with `npm run generate:importmap` (overwrites the file).

### Notes for maintainers

- `e2e/ui/` is a **standalone npm project** (like `e2e/`). It is *not* a pnpm
  workspace member and does **not** touch the repo's root `node_modules` or
  `package.json`. The root `test:e2e:ui:setup` and `test:e2e:ui` scripts are
  shortcuts for the commands above.
- The view list lives in one place (`tests/helpers/views.ts`) — keep it in sync
  with `src/plugin.ts`.
- The smoke test filters known dev-mode console noise via
  `IGNORED_CONSOLE_PATTERNS` in `tests/helpers/constants.ts`; uncaught exceptions
  and 5xx are never filtered.
```
