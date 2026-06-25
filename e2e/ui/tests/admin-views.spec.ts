/**
 * Smoke test: every SEO plugin admin view mounts without error.
 *
 * For each registered view we navigate to its route (authenticated) and assert:
 *   - it did NOT bounce back to /admin/login (server view rendered for the user),
 *   - the DefaultTemplate shell (`.template-default`) is visible (the server
 *     component mounted and wrapped the client view),
 *   - no uncaught page exception fired,
 *   - no same-origin response returned a 5xx,
 *   - no unexpected console error was logged (benign dev noise is filtered).
 *
 * This is intentionally a *smoke* test — it proves the views load and wire up
 * their endpoints, not that every widget is pixel-correct.
 */
import { expect, test } from '@playwright/test'
import { BASE_URL, IGNORED_CONSOLE_PATTERNS } from './helpers/constants'
import { ADMIN_VIEWS } from './helpers/views'

const SAME_ORIGIN_HOST = new URL(BASE_URL).host

/** Time to let the view's client-side fetches settle before asserting. */
const SETTLE_MS = 3000

for (const view of ADMIN_VIEWS) {
  test(`admin view "${view.title}" (${view.path}) mounts without error`, async ({ page }) => {
    const pageErrors: string[] = []
    const serverErrors: string[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return
      consoleErrors.push(text)
    })

    page.on('response', (res) => {
      const status = res.status()
      if (status < 500) return
      let host = ''
      try {
        host = new URL(res.url()).host
      } catch {
        return
      }
      if (host === SAME_ORIGIN_HOST) {
        serverErrors.push(`${status} ${res.request().method()} ${res.url()}`)
      }
    })

    await page.goto(view.path, { waitUntil: 'domcontentloaded' })

    // Not redirected to login → the authenticated session reached the view.
    expect(page.url(), 'should not redirect to login').not.toMatch(/\/admin\/login/)

    // The server view mounted and rendered the admin shell.
    await expect(
      page.locator('.template-default').first(),
      'admin DefaultTemplate shell should render',
    ).toBeVisible({ timeout: 30_000 })

    // Let client fetches (audit/performance/link-graph polling) resolve.
    await page.waitForTimeout(SETTLE_MS)

    expect(pageErrors, `uncaught exceptions on ${view.path}`).toEqual([])
    expect(serverErrors, `5xx responses on ${view.path}`).toEqual([])
    expect(consoleErrors, `console errors on ${view.path}`).toEqual([])
  })
}
