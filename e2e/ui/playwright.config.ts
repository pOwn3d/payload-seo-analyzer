import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, STORAGE_STATE } from './tests/helpers/constants'

/**
 * Playwright config for the SEO plugin admin UI smoke tests.
 *
 * - Boots the harness's Next.js dev server automatically (webServer).
 * - A "setup" project creates/authenticates the admin and saves storage state.
 * - The "chromium" project reuses that state and runs the view smoke tests.
 */
export default defineConfig({
  testDir: './tests',
  // One worker: every test is the same admin, and the plugin caps its expensive
  // endpoints at 10 requests/min per user, shared across them. Parallel workers
  // trip that cap and get a 429 — which the smoke test rightly treats as a
  // failure, since a 429 on a legitimate pass is a real bug (see the audit poll).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Generous per-test timeout: Next.js dev compiles the heavy admin views on first hit
  // (cold compile of the dashboard can take a couple of minutes on first load).
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    // PW_CHANNEL=chrome drives the locally installed Google Chrome instead of
    // Playwright's own build, for machines that cannot download it.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Video needs Playwright's ffmpeg, downloaded from the same CDN as its browser.
    video: process.env.PW_CHANNEL ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: /.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `${BASE_URL}/admin`,
    // Reuse a server already running locally; always boot a fresh one in CI.
    reuseExistingServer: !process.env.CI,
    // Cold Next.js + Payload boot (first compile, sqlite init) can take a while.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
