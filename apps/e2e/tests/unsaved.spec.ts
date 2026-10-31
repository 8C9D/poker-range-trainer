import { createRange, expect, playDrill, signUp, test } from './support'

test('asks before the editor loses a draft to a link or the Back button', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Draft chart', ['AA'])
  await page.goto('/app/library')
  await page.getByRole('link', { name: 'Draft chart' }).click()
  await page.getByLabel('Range name').fill('Unsaved rename')

  const declined: string[] = []
  page.once('dialog', (dialog) => {
    declined.push(dialog.message())
    void dialog.dismiss()
  })
  await page.getByRole('link', { name: 'Progress' }).click()
  await expect.poll(() => declined).toEqual(['Discard unsaved range changes?'])
  await expect(page.getByLabel('Range name')).toHaveValue('Unsaved rename')
  await expect(page).toHaveURL(new RegExp(`/app/library/${range.id}$`))

  const dismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss())
  await page.goBack()
  await dismissed
  await expect(page.getByLabel('Range name')).toHaveValue('Unsaved rename')
  await expect(page).toHaveURL(new RegExp(`/app/library/${range.id}$`))

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('link', { name: 'Progress' }).click()
  await expect(page).toHaveURL(/\/app\/progress$/)
})

test('saving a new range leaves the editor without asking', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/library/new')
  page.on('dialog', () => {
    throw new Error('A saved range must not prompt.')
  })
  await page.getByLabel('Range name').fill('Clean exit')
  await page
    .getByRole('group', { name: 'Starting hand grid' })
    .getByRole('button', { name: 'AA', exact: true })
    .click()
  await page.getByRole('button', { name: 'Create range' }).click()
  await expect(page).toHaveURL(/\/app\/library\/[0-9a-f-]{36}$/)
})

test('asks before a failed drill save is abandoned', async ({ page }) => {
  await signUp(page)
  const hands = ['AA']
  const range = await createRange(page, 'Unsaved drill', hands)
  await page.goto(`/app/practice?range=${range.id}&count=5`)
  await playDrill(page, 5, hands)

  await page.route('**/api/v1/practice/sessions', (route) => route.abort())
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('heading', { name: 'We could not save this session' })).toBeVisible()

  const asked: string[] = []
  page.once('dialog', (dialog) => {
    asked.push(dialog.message())
    void dialog.dismiss()
  })
  await page.getByRole('link', { name: 'Back to library' }).click()
  await expect.poll(() => asked).toEqual(['Leave this drill? Your answers have not been saved.'])
  await expect(page.getByRole('heading', { name: 'We could not save this session' })).toBeVisible()
})
