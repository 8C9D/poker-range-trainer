import { randomUUID } from 'node:crypto'

import { expect, test as base, type Page } from '@playwright/test'

export { expect }

/** Throwaway accounts on a throwaway database; random so no credential lives in the repo. */
export const PASSWORD = `Pw1-${randomUUID()}`

export interface Account {
  email: string
  password: string
}

export interface RangeRecord {
  id: string
  version: number
}

export const newEmail = (): string => `player-${randomUUID()}@example.test`

/** A resource the browser could not load is reported as an error for 4xx too. */
const EXPECTED_NOISE = /Failed to load resource|NetworkError|Failed to fetch|Load failed/i

/**
 * Every test also asserts the page stayed healthy: no uncaught exception, and no
 * console error, which is where a Content-Security-Policy violation shows up.
 */
export const test = base.extend<{ healthyPage: void }>({
  healthyPage: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`))
      page.on('console', (message) => {
        if (message.type() !== 'error' || EXPECTED_NOISE.test(message.text())) return
        problems.push(`console: ${message.text()}`)
      })
      await use()
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

async function csrfHeader(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies()
  const token = cookies.find((cookie) => cookie.name === 'prt_csrf')?.value
  return token === undefined ? {} : { 'x-csrf-token': token }
}

/** A call against the live API in this browser's session, for setup and for checking the truth. */
export async function api<Result>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<Result> {
  const response = await page.request.fetch(`/api/v1${path}`, {
    method,
    headers: await csrfHeader(page),
    ...(data === undefined ? {} : { data }),
  })
  expect(response.ok(), `${method} ${path} answered ${response.status()}`).toBe(true)
  return ((await response.json()) as { data: Result }).data
}

export async function signUp(page: Page): Promise<Account> {
  const account = { email: newEmail(), password: PASSWORD }
  await api(page, 'POST', '/auth/register', account)
  return account
}

export function createRange(page: Page, name: string, hands: string[]): Promise<RangeRecord> {
  return api<RangeRecord>(page, 'POST', '/ranges', { name, hands })
}

/** Answers correctly by reading the dealt hand: `In range` exactly when it belongs. */
export async function answerCorrectly(page: Page, rangeHands: readonly string[]): Promise<void> {
  const hand = (await page.locator('.prompt-hand-code').innerText()).trim()
  await page.keyboard.press(rangeHands.includes(hand) ? 'i' : 'o')
  await expect(page.getByText('Correct', { exact: true })).toBeVisible()
}

/** Plays a whole drill of `questions` correct answers, up to the results button. */
export async function playDrill(
  page: Page,
  questions: number,
  rangeHands: readonly string[],
): Promise<void> {
  for (let question = 1; question <= questions; question += 1) {
    await expect(page.getByText(`Question ${question} of ${questions}`)).toBeVisible()
    await answerCorrectly(page, rangeHands)
    if (question < questions) await page.keyboard.press('Enter')
  }
}
