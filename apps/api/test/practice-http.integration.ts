import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import request from 'supertest'

import {
  practiceSessionSubmissionResponseSchema,
  progressResponseSchema,
  rangeCreateResponseSchema,
  rangePracticeReadResponseSchema,
  todayResponseSchema,
} from '@poker-range-trainer/contracts'
import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
  seedCanonicalHands,
} from '@poker-range-trainer/database'

import { createApp } from '../src/app.js'
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../src/auth/cookies.js'
import { createAuthMiddleware } from '../src/auth/middleware.js'
import { PostgresAuthRepository } from '../src/auth/repository.js'
import { createAuthRouter } from '../src/auth/routes.js'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'
import { PostgresPracticeRepository } from '../src/practice/repository.js'
import { createPracticeRouter } from '../src/practice/routes.js'
import { PracticeService } from '../src/practice/service.js'
import { PostgresRangeRepository } from '../src/ranges/repository.js'
import { createRangeRouter } from '../src/ranges/routes.js'
import { RangeService } from '../src/ranges/service.js'

const testDatabaseName = `poker_range_trainer_api_practice_http_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function cookieValue(header: string[] | undefined, name: string): string {
  const cookie = header?.find((value) => value.startsWith(`${name}=`))
  if (!cookie) throw new Error(`missing ${name} cookie`)
  return cookie.split(';', 1)[0]?.slice(name.length + 1) ?? ''
}

interface SessionCookies {
  cookie: string
  csrfToken: string
}

describe('HTTP practice sessions against PostgreSQL', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  const testUrl = databaseUrlFor(configuredUrl, testDatabaseName)
  const config = loadConfig({ DATABASE_URL: testUrl, NODE_ENV: 'test', RATE_LIMIT_MAX: '1000' })
  const logger = createLogger('silent')
  let testPool: Pool | undefined
  let app: ReturnType<typeof createApp>
  let databaseCreated = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    databaseCreated = true
    testPool = createPostgresPool(testUrl)
    await runMigrations(testPool)
    await seedCanonicalHands(testPool)
    const database = createDatabase(testPool)
    const authRepository = new PostgresAuthRepository(database, { now: () => new Date() })
    const middleware = createAuthMiddleware({ repository: authRepository, config, logger })
    const rangeService = new RangeService(new PostgresRangeRepository(database))
    const practiceService = new PracticeService(new PostgresPracticeRepository(database))
    app = createApp({
      config,
      logger,
      readiness: async () => {
        await testPool?.query('select 1')
      },
      registerRoutes(api) {
        api.use(
          '/api/v1/auth',
          createAuthRouter({ config, logger, repository: authRepository, middleware }),
        )
        api.use('/api/v1/ranges', createRangeRouter({ service: rangeService, middleware }))
        api.use('/api/v1/practice', createPracticeRouter({ service: practiceService, middleware }))
      },
    })
  })

  afterAll(async () => {
    await testPool?.end()
    if (databaseCreated) {
      await adminPool.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [testDatabaseName],
      )
      await adminPool.query(`drop database if exists ${quotedTestDatabaseName}`)
    }
    await adminPool.end()
  })

  async function register(label: string): Promise<SessionCookies> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${label}-${randomUUID()}@example.test`, password: 'password12345' })
      .expect(201)
    const sessionToken = cookieValue(response.headers['set-cookie'], SESSION_COOKIE_NAME)
    const csrfToken = cookieValue(response.headers['set-cookie'], CSRF_COOKIE_NAME)
    return {
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      csrfToken,
    }
  }

  function asUser(session: SessionCookies) {
    return { Cookie: session.cookie, 'x-csrf-token': session.csrfToken }
  }

  it('persists authenticated, server-scored sessions and safely replays idempotent submissions', async () => {
    const owner = await register('practice-owner')
    const other = await register('practice-other')
    await request(app).post('/api/v1/practice/sessions').send({}).expect(401)

    const createdRange = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({ name: 'BTN practice', hands: ['AA', 'AKs'] })
      .expect(201)
    expect(rangeCreateResponseSchema.safeParse(createdRange.body).success).toBe(true)
    const rangeId = createdRange.body.data.id as string
    const submission = {
      mode: 'recognition' as const,
      rangeId,
      idempotencyKey: randomUUID(),
      answers: [
        {
          questionId: randomUUID(),
          hand: 'AA',
          answer: false,
          answeredAt: '2024-01-01T00:00:00.000Z',
        },
        {
          questionId: randomUUID(),
          hand: 'AKo',
          answer: false,
          answeredAt: '2024-01-01T00:00:01.000Z',
        },
      ],
    }

    await request(app)
      .post('/api/v1/practice/sessions')
      .set('Cookie', owner.cookie)
      .send(submission)
      .expect(403)
    const first = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send(submission)
      .expect(200)
    expect(practiceSessionSubmissionResponseSchema.safeParse(first.body).success).toBe(true)
    expect(first.headers['cache-control']).toBe('no-store')
    expect(first.body.data).toMatchObject({
      session: {
        mode: 'recognition',
        totalQuestions: 2,
        correctAnswers: 1,
        accuracyPercentage: 50,
      },
      stats: { totalAttempts: 2, correctAttempts: 1, accuracyPercentage: 50 },
      review: { intervalDays: 1 },
    })
    const replay = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({ ...submission, answers: [...submission.answers].reverse() })
      .expect(200)
    expect(replay.body).toEqual(first.body)
    const persisted = await testPool?.query<{
      sessions: string
      attempts: string
      replays: string
    }>(
      `select
        (select count(*) from practice_sessions where range_id = $1) as sessions,
        (select count(*) from practice_attempts where range_id = $1) as attempts,
        (select count(*) from practice_submission_replays where session_id = $2) as replays`,
      [rangeId, first.body.data.session.id],
    )
    expect(persisted?.rows).toEqual([{ sessions: '1', attempts: '2', replays: '1' }])

    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({
        ...submission,
        answers: submission.answers.map((answer, index) =>
          index === 0 ? { ...answer, answer: true } : answer,
        ),
      })
      .expect(409)
    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(other))
      .send({ ...submission, idempotencyKey: randomUUID() })
      .expect(404)
    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({ ...submission, rangeId: randomUUID(), idempotencyKey: randomUUID() })
      .expect(404)

    const build = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({ mode: 'build', rangeId, idempotencyKey: randomUUID(), selectedHands: ['AA'] })
      .expect(200)
    expect(build.body.data).toMatchObject({
      session: { mode: 'build', totalQuestions: 2, correctAnswers: 1 },
      stats: { totalAttempts: 4, correctAttempts: 2 },
    })
    const attemptsAfterBuild = await testPool?.query<{ count: string }>(
      'select count(*) from practice_attempts where range_id = $1',
      [rangeId],
    )
    expect(attemptsAfterBuild?.rows).toEqual([{ count: '2' }])

    const malformed = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({ ...submission, userId: randomUUID() })
      .expect(422)
    expect(malformed.body).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('scores a drill against the chart it was dealt from, even after an edit elsewhere', async () => {
    const owner = await register('practice-dealt-chart')
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({ name: 'Edited mid-drill', hands: ['AA', 'AKs'] })
      .expect(201)
    const rangeId = created.body.data.id as string
    expect(created.body.data.version).toBe(1)

    async function patch(version: number, body: Record<string, unknown>): Promise<number> {
      const response = await request(app)
        .patch(`/api/v1/ranges/${rangeId}`)
        .set(asUser(owner))
        .send({ version, ...body })
        .expect(200)
      return response.body.data.version as number
    }

    /** AA and KK both called in: right on the first chart, half right on the edited one. */
    function drill(rangeVersion?: number, idempotencyKey = randomUUID()) {
      return {
        mode: 'recognition' as const,
        rangeId,
        ...(rangeVersion === undefined ? {} : { rangeVersion }),
        idempotencyKey,
        answers: ['AA', 'AKs', 'KK'].map((hand, index) => ({
          questionId: randomUUID(),
          hand,
          answer: hand !== 'KK',
          answeredAt: `2024-01-01T00:00:0${index}.000Z`,
        })),
      }
    }

    async function submit(body: ReturnType<typeof drill>) {
      const response = await request(app)
        .post('/api/v1/practice/sessions')
        .set(asUser(owner))
        .send(body)
        .expect(200)
      return practiceSessionSubmissionResponseSchema.parse(response.body).data
    }

    // Another tab replaces the chart while a drill dealt from version 1 is open.
    expect(await patch(1, { hands: ['KK', 'QQ'] })).toBe(2)
    const dealt = await submit(drill(1))
    expect(dealt.session).toMatchObject({ totalQuestions: 3, correctAnswers: 3 })
    expect(dealt.chartChanged).toBe(true)
    const accuracy = await request(app)
      .get(`/api/v1/practice/ranges/${rangeId}`)
      .set(asUser(owner))
      .expect(200)
    // Recorded against the chart the player saw: KK was out of it, so no miss.
    expect(accuracy.body.data.handAccuracy).toEqual([
      { hand: 'AA', attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0 },
      { hand: 'AKs', attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0 },
      { hand: 'KK', attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0 },
    ])

    // Dealt from the current chart, or sent by a page that names no version.
    for (const body of [drill(2), drill()]) {
      const current = await submit(body)
      expect(current.session).toMatchObject({ totalQuestions: 3, correctAnswers: 0 })
      // Exactly the shape a page from before versions existed parses strictly.
      expect(Object.keys(current).sort()).toEqual(['review', 'session', 'stats'])
    }

    // A rename, or re-saving the same cells, is not a new chart.
    expect(await patch(2, { name: 'Renamed mid-drill' })).toBe(3)
    expect(await patch(3, { hands: ['QQ', 'KK'] })).toBe(4)
    for (const version of [2, 3]) {
      const unchanged = await submit(drill(version))
      expect(unchanged.session.correctAnswers).toBe(0)
      expect(unchanged.chartChanged).toBeUndefined()
    }

    // Back to the first chart: versions 2 to 4 are now the retired KK/QQ chart.
    expect(await patch(4, { hands: ['AKs', 'AA'] })).toBe(5)
    const revisions = await testPool?.query(
      `select first_version, last_version, hands from range_chart_revisions
       where range_id = $1 order by last_version`,
      [rangeId],
    )
    expect(revisions?.rows).toEqual([
      { first_version: 1, last_version: 1, hands: ['AA', 'AKs'] },
      { first_version: 2, last_version: 4, hands: ['KK', 'QQ'] },
    ])
    const middle = await submit(drill(3))
    expect(middle.session.correctAnswers).toBe(0)
    expect(middle.chartChanged).toBe(true)
    expect((await submit(drill(5))).session.correctAnswers).toBe(3)

    // The build drill is scored against the dealt chart too.
    const build = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({
        mode: 'build',
        rangeId,
        rangeVersion: 2,
        idempotencyKey: randomUUID(),
        selectedHands: ['KK', 'QQ'],
      })
      .expect(200)
    expect(build.body.data).toMatchObject({
      session: { mode: 'build', totalQuestions: 2, correctAnswers: 2 },
      chartChanged: true,
    })

    // A version the range never had cannot have dealt anything.
    const ahead = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send(drill(6))
      .expect(409)
    expect(ahead.body).toMatchObject({ code: 'CONFLICT' })

    // One key is one submission: the version is part of what it names.
    const key = randomUUID()
    const original = drill(1, key)
    const replayed = await submit(original)
    expect(replayed.chartChanged).toBe(true)
    expect(await submit(original)).toEqual(replayed)
    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({ ...original, rangeVersion: 5 })
      .expect(409)
    // A replay saved before the flag existed still answers, as unchanged.
    await testPool?.query(
      `update practice_submission_replays
       set response_snapshot = response_snapshot #- '{data,chartChanged}'
       where idempotency_key = $1`,
      [key],
    )
    const { chartChanged: _flag, ...unflagged } = replayed
    expect(_flag).toBe(true)
    expect(await submit(original)).toEqual(unflagged)

    // Once purged, a long-open drill can only be scored against the current chart.
    await testPool?.query(
      "update range_chart_revisions set retired_at = now() - interval '31 days' where range_id = $1",
      [rangeId],
    )
    const purged = await new PostgresRangeRepository(createDatabase(testPool!)).purgeRetiredCharts(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    )
    expect(purged).toBeGreaterThanOrEqual(2)
    const fallback = await submit(drill(3))
    expect(fallback.session.correctAnswers).toBe(3)
    expect(fallback.chartChanged).toBe(true)
  })

  it('reads back the practice one submission produced, for its owner only', async () => {
    const owner = await register('practice-reader')
    const stranger = await register('practice-stranger')
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({ name: 'CO open', hands: ['AA', 'AKs'] })
      .expect(201)
    const rangeId = created.body.data.id as string

    await request(app).get(`/api/v1/practice/ranges/${rangeId}`).expect(401)
    await request(app).get('/api/v1/practice/today?timeZone=UTC').expect(401)
    await request(app).get('/api/v1/practice/progress?timeZone=UTC').expect(401)
    await request(app)
      .get('/api/v1/practice/today?timeZone=Not%2FAZone')
      .set(asUser(owner))
      .expect(422)

    const unpracticed = await request(app)
      .get(`/api/v1/practice/ranges/${rangeId}`)
      .set(asUser(owner))
      .expect(200)
    expect(rangePracticeReadResponseSchema.safeParse(unpracticed.body).success).toBe(true)
    expect(unpracticed.body.data).toEqual({
      rangeId,
      stats: null,
      review: null,
      handAccuracy: [],
      recentSessions: [],
    })

    // One played hand the chart folds, one folded hand it plays, one right answer.
    const submitted = await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({
        mode: 'recognition',
        rangeId,
        idempotencyKey: randomUUID(),
        answers: [
          {
            questionId: randomUUID(),
            hand: '22',
            answer: true,
            answeredAt: '2024-01-01T00:00:00.000Z',
          },
          {
            questionId: randomUUID(),
            hand: 'AA',
            answer: true,
            answeredAt: '2024-01-01T00:00:01.000Z',
          },
          {
            questionId: randomUUID(),
            hand: 'AKs',
            answer: false,
            answeredAt: '2024-01-01T00:00:02.000Z',
          },
        ],
      })
      .expect(200)
    expect(practiceSessionSubmissionResponseSchema.safeParse(submitted.body).success).toBe(true)

    const read = await request(app)
      .get(`/api/v1/practice/ranges/${rangeId}`)
      .set(asUser(owner))
      .expect(200)
    expect(rangePracticeReadResponseSchema.safeParse(read.body).success).toBe(true)
    expect(read.headers['cache-control']).toBe('no-store')
    expect(read.body.data.stats).toMatchObject({
      rangeId,
      totalAttempts: 3,
      correctAttempts: 1,
      accuracyPercentage: (1 / 3) * 100,
    })
    expect(read.body.data.review).toMatchObject({ rangeId, intervalDays: 1 })
    // Canonical matrix order, which alphabetical order would have put 22 first.
    expect(read.body.data.handAccuracy.map((stat: { hand: string }) => stat.hand)).toEqual([
      'AA',
      'AKs',
      '22',
    ])
    expect(read.body.data.handAccuracy).toContainEqual({
      hand: '22',
      attempts: 1,
      correct: 0,
      falsePositives: 1,
      falseNegatives: 0,
    })
    expect(read.body.data.recentSessions).toHaveLength(1)
    expect(read.body.data.recentSessions[0]).toMatchObject({
      id: submitted.body.data.session.id,
      rangeId,
      mode: 'recognition',
      totalQuestions: 3,
      correctAnswers: 1,
    })
    await request(app).get(`/api/v1/practice/ranges/${rangeId}`).set(asUser(stranger)).expect(404)

    const today = await request(app)
      .get('/api/v1/practice/today?timeZone=UTC')
      .set(asUser(owner))
      .expect(200)
    expect(todayResponseSchema.safeParse(today.body).success).toBe(true)
    expect(today.headers['cache-control']).toBe('no-store')
    expect(today.body.data.streakDays).toBe(1)
    expect(today.body.data.dailyGoal).toEqual({
      target: null,
      handsAnswered: 3,
      remainingHands: 0,
    })
    expect(today.body.data.trailingSevenDays).toMatchObject({
      handsAnswered: 3,
      correctAnswers: 1,
    })
    // Practiced just now, so the schedule holds it until tomorrow.
    expect(today.body.data.dueRanges).toEqual([])
    expect(today.body.data.caughtUp).toBe(true)
    expect(today.body.data.freePractice).toMatchObject({ kind: 'weakHands', handCount: 2 })

    const progress = await request(app)
      .get('/api/v1/practice/progress?timeZone=UTC')
      .set(asUser(owner))
      .expect(200)
    expect(progressResponseSchema.safeParse(progress.body).success).toBe(true)
    expect(progress.headers['cache-control']).toBe('no-store')
    expect(progress.body.data.allTime).toEqual({
      rangesPracticed: 1,
      handsAnswered: 3,
      correctAnswers: 1,
      accuracyPercentage: (1 / 3) * 100,
    })
    const activity = progress.body.data.dailyActivity as { day: string; handsAnswered: number }[]
    expect(activity).toHaveLength(7)
    expect(activity.reduce((total, day) => total + day.handsAnswered, 0)).toBe(3)
    expect(activity.at(-1)?.day).toBe(new Date().toISOString().slice(0, 10))
    expect(
      progress.body.data.weakestHands.map((entry: { hand: string }) => entry.hand).sort(),
    ).toEqual(['22', 'AKs'])
    expect(progress.body.data.mistakeBias).toMatchObject({ loose: 1, tight: 1, mistakes: 2 })

    // A stranger sees their own empty library, never this owner's records.
    const strangerProgress = await request(app)
      .get('/api/v1/practice/progress?timeZone=UTC')
      .set(asUser(stranger))
      .expect(200)
    expect(strangerProgress.body.data.allTime).toEqual({
      rangesPracticed: 0,
      handsAnswered: 0,
      correctAnswers: 0,
      accuracyPercentage: 0,
    })
  })

  it('keeps saving a range through a perfect streak longer than the schedule allows', async () => {
    const owner = await register('practice-streak')
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({ name: 'Streak chart', hands: ['AA'] })
      .expect(201)
    const rangeId = created.body.data.id as string

    let intervalDays = 0
    for (let session = 0; session < 14; session += 1) {
      const response = await request(app)
        .post('/api/v1/practice/sessions')
        .set(asUser(owner))
        .send({
          mode: 'recognition',
          rangeId,
          idempotencyKey: randomUUID(),
          answers: [
            {
              questionId: randomUUID(),
              hand: 'AA',
              answer: true,
              answeredAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        })
        .expect(200)
      intervalDays = practiceSessionSubmissionResponseSchema.parse(response.body).data.review
        .intervalDays
    }
    expect(intervalDays).toBe(36_500)

    const read = await request(app)
      .get(`/api/v1/practice/ranges/${rangeId}`)
      .set(asUser(owner))
      .expect(200)
    expect(rangePracticeReadResponseSchema.parse(read.body).data.review?.intervalDays).toBe(36_500)
  })
})
