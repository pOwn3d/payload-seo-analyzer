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
  // The smoke tests are read-only against a shared server — safe to parallelize.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Generous per-test timeout: Next.js dev compiles the heavy admin views on first hit
  // (cold compile of the dashboard can take a couple of minutes on first load).
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
