/**
 * Auth + seed setup project.
 *
 * Runs once before the smoke tests (declared as a dependency of the "chromium"
 * project in playwright.config.ts). It:
 *   1. Creates the first admin user via Payload's create-first-user flow
 *      (idempotent — logs in instead if the user already exists),
 *   2. Persists the authenticated browser state to STORAGE_STATE, and
 *   3. Best-effort seeds a couple of pages/posts so the data-driven views
 *      (cannibalization, link-graph, keyword-research) have something to render.
 *
 * All auth + seeding happens THROUGH the running app (UI + authenticated REST),
 * so it never opens a second SQLite connection (avoids SQLITE_BUSY).
 */
import { expect, test as setup } from '@playwright/test'
import { ADMIN, STORAGE_STATE } from './helpers/constants'

setup('create admin, authenticate and seed', async ({ page }) => {
  await page.goto('/admin')

  // Unauthenticated users are redirected to /admin/login, or to
  // /admin/create-first-user when the database has no users yet.
  await page.waitForURL(/\/admin\/(login|create-first-user)/, { timeout: 90_000 })

  const isFirstRun = page.url().includes('create-first-user')

  await page.locator('#field-email').fill(ADMIN.email)
  await page.locator('#field-password').fill(ADMIN.password)
  if (isFirstRun) {
    await page.locator('#field-confirm-password').fill(ADMIN.password)
  }
  await page.locator('.form-submit button').first().click()

  // A successful submit lands on the dashboard (root /admin). A failed login
  // stays on /admin/login — waiting for the dashboard URL surfaces that as a
  // clear timeout instead of a confusing later failure.
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
      )
      const found = existing.ok() ? ((await existing.json())?.totalDocs ?? 0) : 0
      if (found === 0) {
        await page.request.post(`/api/${collection}`, { data })
      }
    }
  } catch (err) {
    console.warn('[e2e-ui] content seed skipped:', (err as Error)?.message)
  }
})
