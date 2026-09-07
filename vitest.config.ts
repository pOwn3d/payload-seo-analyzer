import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // scripts/ is published (package.json "files") and shipped as a bin, so its
    // tests must run too — the include used to be src-only.
    include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'scripts/**/__tests__/**/*.test.{ts,mjs}'],
    environment: 'node',
  },
})
