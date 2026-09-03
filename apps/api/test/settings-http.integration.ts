import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import request from 'supertest'

import {
  rangeCreateResponseSchema,
  resetPracticeStatsResponseSchema,
  trainingGoalResponseSchema,
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
import { PostgresSettingsRepository } from '../src/settings/repository.js'
import { createSettingsRouter } from '../src/settings/routes.js'
import { SettingsService } from '../src/settings/service.js'

const testDatabaseName = `poker_range_trainer_api_settings_http_${randomUUID().replaceAll('-', '')}`
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

interface TestUser {
  id: string
  cookie: string
  csrfToken: string
}

interface OwnerCounts {
  sessions: string
  attempts: string
  replays: string
  stats: string
  hand_accuracy: string
  reviews: string
  ranges: string
  range_hands: string
  goals: string
}

describe('HTTP user settings against PostgreSQL', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  const testUrl = databaseUrlFor(configuredUrl, testDatabaseName)
  const config = loadConfig({ DATABASE_URL: testUrl, NODE_ENV: 'test', RATE_LIMIT_MAX: '1000' })
  const logger = createLogger('silent')
  let testPool: Pool
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
    const settingsService = new SettingsService(new PostgresSettingsRepository(database))
    app = createApp({
      config,
      logger,
      readiness: async () => {
        await testPool.query('select 1')
      },
      registerRoutes(api) {
        api.use(
          '/api/v1/auth',
          createAuthRouter({ config, logger, repository: authRepository, middleware }),
        )
        api.use('/api/v1/ranges', createRangeRouter({ service: rangeService, middleware }))
        api.use('/api/v1/practice', createPracticeRouter({ service: practiceService, middleware }))
        api.use('/api/v1/settings', createSettingsRouter({ service: settingsService, middleware }))
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

  async function register(label: string): Promise<TestUser> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${label}-${randomUUID()}@example.test`, password: 'password12345' })
      .expect(201)
    const sessionToken = cookieValue(response.headers['set-cookie'], SESSION_COOKIE_NAME)
    const csrfToken = cookieValue(response.headers['set-cookie'], CSRF_COOKIE_NAME)
    return {
      id: response.body.data.user.id as string,
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      csrfToken,
    }
  }

  function asUser(user: TestUser) {
    return { Cookie: user.cookie, 'x-csrf-token': user.csrfToken }
  }

  async function ownerCounts(userId: string): Promise<OwnerCounts | undefined> {
    const result = await testPool.query<OwnerCounts>(
      `select
        (select count(*) from practice_sessions where user_id = $1)::text as sessions,
        (select count(*) from practice_attempts where user_id = $1)::text as attempts,
        (select count(*) from practice_submission_replays where user_id = $1)::text as replays,
        (select count(*) from range_practice_stats where user_id = $1)::text as stats,
        (select count(*) from range_hand_accuracy where user_id = $1)::text as hand_accuracy,
        (select count(*) from review_states where user_id = $1)::text as reviews,
        (select count(*) from ranges where user_id = $1)::text as ranges,
        (select count(*) from range_hands where user_id = $1)::text as range_hands,
        (select count(*) from user_training_goals where user_id = $1)::text as goals`,
      [userId],
    )
    return result.rows[0]
  }

  async function practiceOnce(user: TestUser): Promise<string> {
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(user))
      .send({ name: 'BTN settings', hands: ['AA', 'AKs'] })
      .expect(201)
    expect(rangeCreateResponseSchema.safeParse(created.body).success).toBe(true)
    const rangeId = created.body.data.id as string
    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(user))
      .send({
        mode: 'recognition',
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
      })
      .expect(200)
    return rangeId
  }

  it('stores a per-user daily hands goal and clears it on request', async () => {
    const owner = await register('settings-goal-owner')
    const other = await register('settings-goal-other')
    await request(app).get('/api/v1/settings/training-goal').expect(401)

    const empty = await request(app)
      .get('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .expect(200)
    expect(trainingGoalResponseSchema.safeParse(empty.body).success).toBe(true)
    expect(empty.body).toEqual({ data: { dailyHandsGoal: null, updatedAt: null } })
    expect(empty.headers['cache-control']).toBe('no-store')

    await request(app)
      .put('/api/v1/settings/training-goal')
      .set('Cookie', owner.cookie)
      .send({ dailyHandsGoal: 50 })
      .expect(403)

    const updated = await request(app)
      .put('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .send({ dailyHandsGoal: 50 })
      .expect(200)
    expect(trainingGoalResponseSchema.safeParse(updated.body).success).toBe(true)
    expect(updated.body.data.dailyHandsGoal).toBe(50)
    expect(typeof updated.body.data.updatedAt).toBe('string')

    const persisted = await request(app)
      .get('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .expect(200)
    expect(persisted.body.data.dailyHandsGoal).toBe(50)
    expect(persisted.body.data.updatedAt).toBe(updated.body.data.updatedAt)

    const otherGoal = await request(app)
      .get('/api/v1/settings/training-goal')
      .set(asUser(other))
      .expect(200)
    expect(otherGoal.body).toEqual({ data: { dailyHandsGoal: null, updatedAt: null } })

    const cleared = await request(app)
      .put('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .send({ dailyHandsGoal: null })
      .expect(200)
    expect(cleared.body).toEqual({ data: { dailyHandsGoal: null, updatedAt: null } })
    const afterClear = await request(app)
      .get('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .expect(200)
    expect(afterClear.body).toEqual({ data: { dailyHandsGoal: null, updatedAt: null } })
    expect((await ownerCounts(owner.id))?.goals).toBe('0')
  })

  it('erases only the caller practice records, keeping ranges and the training goal', async () => {
    const owner = await register('settings-reset-owner')
    const other = await register('settings-reset-other')
    await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .send({ confirm: true })
      .expect(401)

    await request(app)
      .put('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .send({ dailyHandsGoal: 75 })
      .expect(200)
    await practiceOnce(owner)
    await practiceOnce(other)

    const before = await ownerCounts(owner.id)
    expect(before).toEqual({
      sessions: '1',
      attempts: '2',
      replays: '1',
      stats: '1',
      hand_accuracy: '2',
      reviews: '1',
      ranges: '1',
      range_hands: '2',
      goals: '1',
    })

    await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .set('Cookie', owner.cookie)
      .send({ confirm: true })
      .expect(403)

    const reset = await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .set(asUser(owner))
      .send({ confirm: true })
      .expect(200)
    expect(resetPracticeStatsResponseSchema.safeParse(reset.body).success).toBe(true)
    expect(reset.body.data.rangesReset).toBe(1)
    expect(typeof reset.body.data.resetAt).toBe('string')
    expect(reset.headers['cache-control']).toBe('no-store')

    expect(await ownerCounts(owner.id)).toEqual({
      sessions: '0',
      attempts: '0',
      replays: '0',
      stats: '0',
      hand_accuracy: '0',
      reviews: '0',
      ranges: '1',
      range_hands: '2',
      goals: '1',
    })
    const survivingGoal = await request(app)
      .get('/api/v1/settings/training-goal')
      .set(asUser(owner))
      .expect(200)
    expect(survivingGoal.body.data.dailyHandsGoal).toBe(75)

    expect(await ownerCounts(other.id)).toEqual({
      sessions: '1',
      attempts: '2',
      replays: '1',
      stats: '1',
      hand_accuracy: '2',
      reviews: '1',
      ranges: '1',
      range_hands: '2',
      goals: '0',
    })

    const secondReset = await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .set(asUser(owner))
      .send({ confirm: true })
      .expect(200)
    expect(secondReset.body.data.rangesReset).toBe(0)
  })
})
