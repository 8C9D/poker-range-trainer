import { expect, newEmail, PASSWORD, test } from './support'

test('registers, signs out, and signs back in through the forms @cross-browser', async ({
  page,
}) => {
  const email = newEmail()

  await page.goto('/')
  await page.getByRole('link', { name: 'Start training' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole('navigation', { name: 'Practice navigation' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()

  await page.goto('/app/library')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password-12345')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
})

test('issues the session as a Secure, HttpOnly, SameSite cookie', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Email address').fill(newEmail())
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/app/)

  const cookies = await page.context().cookies()
  const session = cookies.find((cookie) => cookie.name === 'prt_session')
  const csrf = cookies.find((cookie) => cookie.name === 'prt_csrf')
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' })
  expect(csrf).toMatchObject({ httpOnly: false, secure: true, sameSite: 'Lax', path: '/' })
  // Script can read the CSRF token by design, and must never see the session.
  expect(await page.evaluate(() => document.cookie)).not.toContain('prt_session')
})

test('shows the server password policy on the field that broke it', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Email address').fill(newEmail())
  await page.getByLabel('Password', { exact: true }).fill('onlylettershere')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toContainText('at least one letter and one number')
  await expect(page).toHaveURL(/\/register$/)
})

test('refuses a second account on the same email', async ({ page }) => {
  const email = newEmail()
  for (const expected of ['/app', '/register']) {
    await page.context().clearCookies()
    await page.goto('/register')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(new RegExp(expected))
  }
  await expect(page.getByRole('alert')).toContainText('already exists')
})
