import { createRange, expect, signUp, test } from './support'

test('another account cannot open, drill, or see a range', async ({ page, browser }) => {
  await signUp(page)
  const secret = await createRange(page, 'Private chart', ['AA'])

  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const intruder = await context.newPage()
  await signUp(intruder)

  await intruder.goto(`/app/library/${secret.id}`)
  await expect(intruder.getByRole('heading', { name: 'Range not found' })).toBeVisible()

  await intruder.goto(`/app/practice?range=${secret.id}`)
  await expect(intruder.getByRole('heading', { name: 'Nothing left to practice' })).toBeVisible()

  await intruder.goto('/app/library')
  await expect(intruder.getByText('Your library is empty')).toBeVisible()
  await expect(intruder.getByText('Private chart')).toHaveCount(0)

  const direct = await intruder.request.get(`/api/v1/ranges/${secret.id}`)
  expect(direct.status()).toBe(404)
  await context.close()
})

test('refuses a state change without the CSRF token', async ({ page }) => {
  await signUp(page)
  const response = await page.request.post('/api/v1/ranges', {
    data: { name: 'Forged', hands: ['AA'] },
  })
  expect(response.status()).toBe(403)
})

test('refuses a request from a foreign origin', async ({ page }) => {
  await signUp(page)
  const response = await page.request.get('/api/v1/ranges', {
    headers: { Origin: 'https://attacker.example' },
  })
  expect(response.status()).toBe(403)
})
