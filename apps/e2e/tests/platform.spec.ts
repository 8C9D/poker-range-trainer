import AxeBuilder from '@axe-core/playwright'

import { createRange, expect, signUp, test } from './support'

test('serves documents with the production security headers', async ({ page }) => {
  const response = await page.goto('/')
  const headers = (await response?.allHeaders()) ?? {}
  const policy = headers['content-security-policy'] ?? ''
  expect(policy).toContain("script-src 'self'")
  expect(policy).toContain('upgrade-insecure-requests')
  expect(policy).toContain("frame-ancestors 'none'")
  expect(headers['strict-transport-security']).toContain('max-age=')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-powered-by']).toBeUndefined()
  expect(headers['cache-control']).toBe('no-cache')
})

test('caches hashed assets for good and answers a missing one with a 404', async ({ page }) => {
  await page.goto('/')
  const script = await page.locator('script[type="module"]').getAttribute('src')
  const asset = await page.request.get(script ?? '')
  expect(asset.status()).toBe(200)
  expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable')

  const missing = await page.request.get('/assets/never-built.js')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/problem+json')
})

test('answers a deep link and a reload from the app, and an unknown API path as JSON', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/app/progress')
  await expect(page.getByRole('heading', { name: 'Progress', level: 1 })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Progress', level: 1 })).toBeVisible()

  await page.goto('/no/such/page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  const missing = await page.request.get('/api/v1/nothing-here')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/problem+json')
})

test('reports readiness through the proxy', async ({ page }) => {
  const ready = await page.request.get('/api/v1/health/ready')
  expect(ready.status()).toBe(200)
  expect(await ready.json()).toMatchObject({ data: { status: 'ok', service: 'api' } })
})

test.describe('accessibility', () => {
  const scan = async (page: Parameters<typeof signUp>[0]) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.map(
      (violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ')}`,
    )
    expect(violations).toEqual([])
  }

  for (const path of ['/', '/login', '/register']) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await scan(page)
    })
  }

  test('every signed-in page', async ({ page }) => {
    test.slow()
    await signUp(page)
    const range = await createRange(page, 'Audited chart', ['AA', 'KK'])
    for (const path of [
      '/app/today',
      '/app/library',
      '/app/library/new',
      `/app/library/${range.id}`,
      `/app/practice?range=${range.id}`,
      `/app/practice?range=${range.id}&mode=build`,
      '/app/progress',
      '/app/account',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await scan(page)
    }
  })
})
