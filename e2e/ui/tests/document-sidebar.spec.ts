/**
 * The plugin's fields inside a real document editor, where Payload mounts them
 * from the import map with its own props — the path the admin-view smoke tests
 * never exercise.
 *
 * The harness admin runs in English (Payload's default, no i18n config) on a
 * mono-locale site with no plugin `locale`, which is exactly the setup that
 * 4.2.0 got wrong: the interface must follow the admin language while the
 * analysis keeps the plugin's French default, like the dashboard audit.
 */
import { expect, test } from '@playwright/test'
import { API_HEADERS } from './helpers/constants'

const text = (value: string) => ({
  type: 'text',
  text: value,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const paragraph = (value: string) => ({
  type: 'paragraph',
  children: [text(value)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  version: 1,
})

const FRENCH_BODY =
  "Notre agence web accompagne les entreprises dans la création de sites performants. " +
  "Par ailleurs, chaque projet bénéficie d'un suivi personnalisé et d'un référencement soigné. " +
  'En effet, nous mesurons régulièrement les résultats afin de les améliorer.'

test('document sidebar: English interface, French analysis, generate button', async ({ page }) => {
  const created = await page.request.post('/api/posts', {
    headers: API_HEADERS,
    data: {
      title: 'Agence web à Limoges',
      slug: `agence-web-e2e-${Date.now()}`,
      focusKeyword: 'agence web',
      // Deliberately short: the critical meta-description check then reports
      // "Trop courte" in French and "Too short" in English.
      meta: { title: 'Agence web à Limoges : création de sites', description: 'Agence web à Limoges.' },
      content: {
        root: {
          type: 'root',
          children: [paragraph(FRENCH_BODY), paragraph(FRENCH_BODY)],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const { doc } = await created.json()

  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto(`/admin/collections/posts/${doc.id}`)

  // The analysis ran, in French: these messages come from the engine.
  await expect(page.getByText(/Meta description \(21 car\.\) — Trop courte/)).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText(/Score Flesch FR : \d+\/100/)).toBeVisible()
  await expect(page.getByText(/Too short\. Aim for 120 to 160/)).toHaveCount(0)

  // The interface around it follows the English admin.
  await expect(page.getByText(/^Critical \(\d+\/\d+\)$/i)).toBeVisible()
  await expect(page.getByText(/^Critiques/i)).toHaveCount(0)

  // metaFields() passes `hasGenerateFn` through admin.custom: the button shows,
  // and it reaches the generate endpoint, which runs the config's generateTitle.
  await page.getByRole('button', { name: /^generate$/i }).click()
  await expect
    .poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value)))
    .toContain('Agence web à Limoges | E2E UI Harness')

  expect(pageErrors).toEqual([])
})
