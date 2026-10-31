import { api, createRange, expect, signUp, test, type RangeRecord } from './support'

test('builds a range on the grid and keeps it across a reload @cross-browser', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/library/new')
  await page.getByLabel('Range name').fill('BTN open, 100bb')
  const grid = page.getByRole('group', { name: 'Starting hand grid' })
  for (const hand of ['AA', 'KK', 'AKs', 'AKo']) {
    await grid.getByRole('button', { name: hand, exact: true }).click()
  }
  await expect(page.getByText('4 of 169 hand classes selected')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Include context' }).check()
  await page.getByLabel('Your position').selectOption({ label: 'BTN' })
  await page.getByLabel('Notes').fill('Open everything premium.')
  await page.getByRole('button', { name: 'Create range' }).click()

  await expect(page).toHaveURL(/\/app\/library\/[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByLabel('Range name')).toHaveValue('BTN open, 100bb')
  await expect(page.getByLabel('Notes')).toHaveValue('Open everything premium.')
  await expect(grid.getByRole('button', { name: 'AKo', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('4 of 169 hand classes selected')).toBeVisible()
})

test('paints every cell a fast drag crosses', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Pointer capture is covered once.')
  await signUp(page)
  await page.goto('/app/library/new')
  const grid = page.getByRole('group', { name: 'Starting hand grid' })
  await grid.scrollIntoViewIfNeeded()
  const from = await grid.getByRole('button', { name: 'AA', exact: true }).boundingBox()
  const to = await grid.getByRole('button', { name: 'A2s', exact: true }).boundingBox()
  if (!from || !to) throw new Error('The grid cells have no layout.')

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // Across the whole top row in a few coarse moves, as a quick flick of the mouse does.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText('13 of 169 hand classes selected')).toBeVisible()
})

test('moves through the grid from the keyboard', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/library/new')
  const grid = page.getByRole('group', { name: 'Starting hand grid' })
  await grid.getByRole('button', { name: 'AA', exact: true }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await expect(grid.getByRole('button', { name: 'AKs', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('2 of 169 hand classes selected')).toBeVisible()
})

test('finds, favorites, duplicates, deletes, and undoes from the library', async ({ page }) => {
  await signUp(page)
  await createRange(page, 'UTG open', ['AA', 'KK'])
  await createRange(page, 'CO steal', ['A5s', 'KQo'])
  await page.goto('/app/library')

  const list = page.getByRole('list', { name: 'Saved ranges' })
  await expect(list.getByRole('listitem')).toHaveCount(2)

  await page.getByLabel('Search').fill('a5s')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByRole('link', { name: 'CO steal' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(2)

  const manage = page.getByLabel('Manage UTG open', { exact: true })
  await manage.getByRole('button', { name: 'Favorite' }).click()
  await expect(list.getByLabel('Favorite')).toBeVisible()

  await manage.getByRole('button', { name: 'Duplicate' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(3)

  await manage.getByRole('button', { name: 'Delete' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: /Undo delete of/ }).click()
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await expect(list.getByRole('link', { name: 'UTG open', exact: true })).toBeVisible()
})

test('keeps local edits through a version conflict', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Conflict chart', ['AA'])
  await page.goto(`/app/library/${range.id}`)
  await expect(page.getByLabel('Range name')).toHaveValue('Conflict chart')

  // Another tab saves first.
  await api<RangeRecord>(page, 'PATCH', `/ranges/${range.id}`, {
    version: range.version,
    name: 'Changed elsewhere',
  })

  await page.getByLabel('Range name').fill('My local edit')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert')).toContainText('Your unsaved edits are still here.')
  await expect(page.getByLabel('Range name')).toHaveValue('My local edit')

  await page.getByRole('button', { name: 'Reload current saved range' }).click()
  await expect(page.getByLabel('Range name')).toHaveValue('Changed elsewhere')
})
