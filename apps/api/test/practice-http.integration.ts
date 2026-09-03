import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import request from 'supertest'

import {
  practiceSessionSubmissionResponseSchema,
  rangeCreateResponseSchema,
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
})
