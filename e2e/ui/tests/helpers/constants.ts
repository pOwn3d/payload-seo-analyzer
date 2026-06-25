/** Shared configuration for the admin UI e2e harness. */

/** Base URL of the harness app. Overridable so the suite can target a remote deploy. */
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3456'

/** Credentials for the seeded admin user (created on first run via create-first-user). */
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@e2e.test',
  password: process.env.E2E_ADMIN_PASSWORD || 'test-Password-123!',
}

/** Where the authenticated browser state is persisted (reused by every spec). */
export const STORAGE_STATE = 'playwright/.auth/admin.json'

/**
 * Console-error substrings that are benign dev-mode noise and must NOT fail a
 * smoke test. Keep this list short and well-justified — anything not matched
 * here will fail the run. Uncaught page exceptions and same-origin 5xx
 * responses are ALWAYS treated as failures regardless of this list.
 */
export const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /favicon/i, // browsers request /favicon.ico; the admin doesn't serve one
  /Download the React DevTools/i, // React dev banner
  /react-dom.*Warning: ReactDOM\.preload/i, // Next.js preload hints in dev
  /\[Fast Refresh\]/i, // Next.js HMR chatter in dev mode
]
