/**
 * Auth + seed setup project.
 *
 * Runs once before the smoke tests (declared as a dependency of the "chromium"
 * project in playwright.config.ts). It:
 *   1. Creates the first admin user through Payload's first-register endpoint
 *      when the admin asks for one, then logs in through the login endpoint,
 *   2. Persists the authenticated browser state to STORAGE_STATE, and
 *   3. Best-effort seeds a couple of pages/posts so the data-driven views
 *      (cannibalization, link-graph, keyword-research) have something to render.
 *
 * All auth + seeding happens THROUGH the running app (UI + authenticated REST),
 * so it never opens a second SQLite connection (avoids SQLITE_BUSY).
 */
import { expect, test as setup } from '@playwright/test'
import { ADMIN, API_HEADERS, STORAGE_STATE } from './helpers/constants'

setup('create admin, authenticate and seed', async ({ page }) => {
  // First hit compiles the admin and lets Payload initialise the SQLite schema.
  await page.goto('/admin')
  await page.waitForURL(/\/admin\/(login|create-first-user)/, { timeout: 90_000 })

  // Authenticate through Payload's REST endpoints rather than the forms: the
  // create-first-user form re-renders when its server-side form state lands,
  // which wipes a password typed just before and fails the submit at random.
  // `page.request` shares the browser context's cookies, so the session sticks.
  // Ask Payload whether a first user exists: the URL is no guide, since the
  // admin passes through /admin/login before redirecting to create-first-user.
  const init = await page.request.get('/api/users/init')
  expect(init.ok(), await init.text()).toBeTruthy()
  if (!(await init.json()).initialized) {
    const registered = await page.request.post('/api/users/first-register', {
      data: { email: ADMIN.email, password: ADMIN.password, 'confirm-password': ADMIN.password },
    })
    expect(registered.ok(), await registered.text()).toBeTruthy()
  }
  const login = await page.request.post('/api/users/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok(), await login.text()).toBeTruthy()

  // The admin now opens on the dashboard: this is the check that the session
  // cookie is the one the admin reads, not just that the API accepted it.
  await page.goto('/admin')
  await page.waitForURL(/\/admin\/?$/, { timeout: 240_000 })
  await expect(page.locator('.template-default, .dashboard').first()).toBeVisible({ timeout: 60_000 })

  await page.context().storageState({ path: STORAGE_STATE })

  // --- Best-effort content seed (authenticated REST, carries the session) ---
  // Failures here must not break the smoke tests: the views render fine empty.
  try {
    const seedDocs = [
      { collection: 'pages', data: { title: 'Accueil', slug: 'accueil' } },
      { collection: 'pages', data: { title: 'À propos', slug: 'a-propos' } },
      {
        collection: 'posts',
        data: { title: 'Guide SEO local 2026', slug: 'guide-seo-local', focusKeyword: 'seo local' },
      },
      {
        collection: 'posts',
        data: { title: 'Checklist SEO technique', slug: 'checklist-seo', focusKeyword: 'seo technique' },
      },
    ]
    for (const { collection, data } of seedDocs) {
      const existing = await page.request.get(
        `/api/${collection}?where[slug][equals]=${encodeURIComponent(String(data.slug))}&limit=1`,
        { headers: API_HEADERS },
      )
      const found = existing.ok() ? ((await existing.json())?.totalDocs ?? 0) : 0
      if (found === 0) {
        await page.request.post(`/api/${collection}`, { data, headers: API_HEADERS })
      }
    }
  } catch (err) {
    console.warn('[e2e-ui] content seed skipped:', (err as Error)?.message)
  }
})
