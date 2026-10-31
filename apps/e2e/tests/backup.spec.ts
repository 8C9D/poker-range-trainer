import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { api, expect, signUp, test } from './support'

const SEED_BACKUP = fileURLToPath(new URL('../../../screenshots/seed-backup.json', import.meta.url))

test('imports a backup, exports it back, and restores from it @cross-browser', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/account')

  await page.getByLabel('Backup file').setInputFiles(SEED_BACKUP)
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Merge' }).click()
  await expect(page.getByRole('status')).toContainText('Imported 4 ranges by merging')

  await page.goto('/app/library')
  const list = page.getByRole('list', { name: 'Saved ranges' })
  await expect(list.getByRole('listitem')).toHaveCount(4)

  // Export what the library now holds.
  await page.goto('/app/account')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^poker-range-trainer-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await file.path()
  const exported = JSON.parse(await readFile(path, 'utf8')) as {
    version: number
    ranges: unknown[]
  }
  expect(exported.version).toBe(1)
  expect(exported.ranges).toHaveLength(4)

  // Lose a range, then restore from the same file that was imported before.
  await page.goto('/app/library')
  await page.getByLabel('Manage UTG open 100bb').getByRole('button', { name: 'Delete' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(3)

  await page.goto('/app/account')
  await page.getByLabel('Backup file').setInputFiles(SEED_BACKUP)
  await expect(page.getByText(/merging it would add nothing/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Merge' })).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: 'I understand this replaces my current library' })
    .check()
  await page.getByRole('button', { name: 'Replace' }).click()
  await expect(page.getByRole('status')).toContainText('Imported 4 ranges by replacing')

  await page.goto('/app/library')
  await expect(list.getByRole('listitem')).toHaveCount(4)
})

test('refuses a file that is not a backup, before anything reaches the server', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/app/account')
  await page.getByLabel('Backup file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
  })
  await expect(page.getByRole('alert')).toContainText('not a version 1 backup')
  await expect(page.getByRole('heading', { name: 'Preview' })).toHaveCount(0)
})

test('resets practice stats and keeps the ranges', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/account')
  await page.getByLabel('Backup file').setInputFiles(SEED_BACKUP)
  await page.getByRole('button', { name: 'Merge' }).click()
  await expect(page.getByRole('status')).toContainText('Imported 4 ranges')

  await page.goto('/app/progress')
  const overview = page.getByRole('region', { name: 'Training overview' })
  await expect(overview).toContainText('340Hands answered all-time')

  const reset = await api<{ rangesReset: number }>(page, 'POST', '/settings/reset-practice-stats', {
    confirm: true,
  })
  expect(reset.rangesReset).toBe(4)

  await page.reload()
  await expect(overview).toContainText('0Hands answered all-time')
  await page.goto('/app/library')
  await expect(page.getByRole('list', { name: 'Saved ranges' }).getByRole('listitem')).toHaveCount(
    4,
  )
})
