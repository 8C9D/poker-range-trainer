import { randomUUID } from 'node:crypto'

import { api, createRange, expect, PASSWORD, signUp, test } from './support'

const REPLACEMENT = `New1-${randomUUID()}`

test('changes the password from the Account page @cross-browser', async ({ page, browser }) => {
  const account = await signUp(page)

  // A second device, signed in with the same password.
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const elsewhere = await context.newPage()
  await api(elsewhere, 'POST', '/auth/login', account)
  await elsewhere.goto('/app/library')
  await expect(elsewhere.getByRole('heading', { level: 1 })).toHaveText('Your preflop playbook')

  await page.goto('/app/account')
  await page.getByLabel('Current password').fill('not-the-password-1')
  await page.getByLabel('New password').fill(REPLACEMENT)
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('alert')).toHaveText('That password is not correct.')

  await page.getByLabel('Current password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Password changed. 1 other session was signed out.',
  )

  // This browser stays in; the other device is out.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible()
  await elsewhere.reload()
  await expect(elsewhere.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await context.close()

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.goto('/login')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
  await page.getByLabel('Password', { exact: true }).fill(REPLACEMENT)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app/)
})

test('signs out everywhere, this browser included', async ({ page, browser }) => {
  const account = await signUp(page)
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const elsewhere = await context.newPage()
  await api(elsewhere, 'POST', '/auth/login', account)

  await page.goto('/app/account')
  await page.getByRole('button', { name: 'Sign out everywhere' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/app/library')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await elsewhere.goto('/app/library')
  await expect(elsewhere.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await context.close()
})

test('deletes the account and frees its address @cross-browser', async ({ page }) => {
  const account = await signUp(page)
  await createRange(page, 'Goes with the account', ['AA'])
  await page.goto('/app/account')

  const button = page.getByRole('button', { name: 'Delete account' })
  await expect(button).toBeDisabled()
  await page.getByLabel('Your password').fill('not-the-password-1')
  await page.getByRole('checkbox', { name: /permanently deletes my account/ }).check()
  await button.click()
  await expect(page.getByRole('alert')).toHaveText('That password is not correct.')

  await page.getByLabel('Your password').fill(PASSWORD)
  await button.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know your ranges')

  await page.goto('/login')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')

  // The address is free again, and the new account starts empty.
  await page.goto('/register')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/app/)
  // Today has finished loading before the page is left: WebKit reports a fetch
  // that a navigation cancels as an uncaught error, which the health check fails.
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await page.goto('/app/library')
  await expect(page.getByText('Your library is empty')).toBeVisible()
})
