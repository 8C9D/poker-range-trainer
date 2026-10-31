import {
  api,
  answerCorrectly,
  createRange,
  expect,
  playDrill,
  signUp,
  test,
  type RangeRecord,
} from './support'

interface RangePractice {
  stats: { totalAttempts: number; correctAttempts: number } | null
  review: { intervalDays: number } | null
  recentSessions: { totalQuestions: number; correctAnswers: number }[]
}

const HANDS = ['AA', 'KK', 'QQ', 'AKs']

const readPractice = (page: Parameters<typeof api>[0], range: RangeRecord) =>
  api<RangePractice>(page, 'GET', `/practice/ranges/${range.id}`)

test('records a drill the server scored, and Today and Progress report it @cross-browser', async ({
  page,
}) => {
  await signUp(page)
  const range = await createRange(page, 'Premiums', HANDS)

  await page.goto('/app/today')
  await expect(page.getByRole('heading', { name: 'Due now' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Due now' })).toContainText('Premiums')

  await page.goto(`/app/practice?range=${range.id}&count=5`)
  await playDrill(page, 5, HANDS)
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Session summary' })).toContainText('No misses')

  const practice = await readPractice(page, range)
  expect(practice.stats).toMatchObject({ totalAttempts: 5, correctAttempts: 5 })
  expect(practice.recentSessions).toHaveLength(1)
  expect(practice.review?.intervalDays).toBe(1)

  await page.goto('/app/today')
  await expect(page.getByRole('region', { name: 'Due now' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible()

  await page.goto('/app/progress')
  const overview = page.getByRole('region', { name: 'Training overview' })
  await expect(overview).toContainText('100%')
  await expect(overview).toContainText('1 day')
  await expect(overview).toContainText('5')
})

test('scores a build-from-memory drill against the saved chart', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Rebuild me', ['AA', 'KK'])
  await page.goto(`/app/practice?range=${range.id}&mode=build`)

  const grid = page.getByRole('group', { name: 'Starting hand grid' })
  await grid.getByRole('button', { name: 'AA', exact: true }).click()
  await grid.getByRole('button', { name: 'QQ', exact: true }).click()
  await page.getByRole('button', { name: /Check/ }).click()

  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
  const practice = await readPractice(page, range)
  expect(practice.recentSessions).toHaveLength(1)
  expect(practice.recentSessions[0]?.correctAnswers).toBeLessThan(
    practice.recentSessions[0]?.totalQuestions ?? 0,
  )
})

test('ends a timed drill on the clock and records what was answered', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Against the clock', HANDS)
  await page.clock.install()
  await page.goto(`/app/practice?range=${range.id}&mode=timed&seconds=30`)
  await expect(page.getByText('30s left · 0 answered')).toBeVisible()

  await answerCorrectly(page, HANDS)
  await expect(page.getByText(/s left · 1 answered/)).toBeVisible()

  await page.clock.runFor(31_000)
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
  expect((await readPractice(page, range)).stats?.totalAttempts).toBe(1)
})

test('keeps the answers through a failed save and records them once on retry', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Offline moment', HANDS)
  await page.goto(`/app/practice?range=${range.id}&count=5`)
  await playDrill(page, 5, HANDS)

  await page.route('**/api/v1/practice/sessions', (route) => route.abort(), { times: 1 })
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('heading', { name: 'We could not save this session' })).toBeVisible()
  await expect(page.getByText('Your 5 answers are still here.')).toBeVisible()
  expect((await readPractice(page, range)).recentSessions).toHaveLength(0)

  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
  expect((await readPractice(page, range)).recentSessions).toHaveLength(1)
})

test('never records a drill twice when the reply is lost on the way back', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Lost reply', HANDS)
  await page.goto(`/app/practice?range=${range.id}&count=5`)
  await playDrill(page, 5, HANDS)

  // The server commits; the browser never hears about it.
  await page.route(
    '**/api/v1/practice/sessions',
    async (route) => {
      await route.fetch()
      await route.abort()
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('heading', { name: 'We could not save this session' })).toBeVisible()
  expect((await readPractice(page, range)).recentSessions).toHaveLength(1)

  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
  const practice = await readPractice(page, range)
  expect(practice.recentSessions).toHaveLength(1)
  expect(practice.stats?.totalAttempts).toBe(5)
})

test('keeps saving through a streak longer than the schedule allows', async ({ page }) => {
  await signUp(page)
  const range = await createRange(page, 'Long streak', ['AA'])
  for (let session = 0; session < 13; session += 1) {
    await api(page, 'POST', '/practice/sessions', {
      mode: 'recognition',
      rangeId: range.id,
      idempotencyKey: crypto.randomUUID(),
      answers: [
        {
          questionId: crypto.randomUUID(),
          hand: 'AA',
          answer: true,
          answeredAt: new Date().toISOString(),
        },
      ],
    })
  }
  await page.goto(`/app/practice?range=${range.id}&count=5`)
  await playDrill(page, 5, ['AA'])
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible()
})
