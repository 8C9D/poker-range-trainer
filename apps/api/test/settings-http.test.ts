import type { RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  MAX_DAILY_HANDS_GOAL,
  problemDetailsSchema,
  resetPracticeStatsResponseSchema,
  trainingGoalResponseSchema,
  type TrainingGoalRead,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import type { AuthMiddleware } from '../src/auth/middleware.js'
import { sendCsrfFailed } from '../src/auth/middleware.js'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'
import { createSettingsRouter } from '../src/settings/routes.js'
import type { PracticeStatsReset } from '../src/settings/service.js'

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const timestamp = '2026-01-02T03:04:05.000Z'

function testConfig() {
  return {
    ...loadConfig({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/poker',
      NODE_ENV: 'test',
    }),
    rateLimitMax: 1_000,
  }
}

function createSettingsService() {
  return {
    readTrainingGoal: vi.fn(async (): Promise<TrainingGoalRead> => ({
      dailyHandsGoal: 50,
      updatedAt: timestamp,
    })),
    writeTrainingGoal: vi.fn(
      async (_ownerId: string, dailyHandsGoal: number | null): Promise<TrainingGoalRead> =>
        dailyHandsGoal === null
          ? { dailyHandsGoal: null, updatedAt: null }
          : { dailyHandsGoal, updatedAt: timestamp },
    ),
    resetPracticeStats: vi.fn(async (): Promise<PracticeStatsReset> => ({
      resetAt: timestamp,
      rangesReset: 2,
    })),
  }
}

const attachAuth: RequestHandler = (request, _response, next) => {
  request.authContext = {
    user: {
      id: ownerId,
      email: 'owner@example.test',
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    },
    session: {
      id: '039f01de-89ef-479e-8d9d-6780e1fb5d14',
      userId: ownerId,
      expiresAt: new Date('2026-01-03T03:04:05.000Z'),
      revokedAt: null,
      csrfTokenHash: 'a'.repeat(64),
      createdAt: new Date(timestamp),
      lastSeenAt: new Date(timestamp),
    },
  }
  next()
}

function createSettingsTestApp(
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'> = {
    required: attachAuth,
    csrf: attachAuth,
  },
) {
  const service = createSettingsService()
  const app = createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    readiness: async () => undefined,
    registerRoutes(api) {
      api.use('/api/v1/settings', createSettingsRouter({ service, middleware }))
    },
  })
  return { app, service }
}

function expectUntouched(service: ReturnType<typeof createSettingsService>): void {
  expect(service.readTrainingGoal).not.toHaveBeenCalled()
  expect(service.writeTrainingGoal).not.toHaveBeenCalled()
  expect(service.resetPracticeStats).not.toHaveBeenCalled()
}

describe('HTTP settings routes', () => {
  it('serves authenticated training-goal reads and writes with contract responses', async () => {
    const { app, service } = createSettingsTestApp()

    const read = await request(app).get('/api/v1/settings/training-goal').expect(200)
    expect(trainingGoalResponseSchema.safeParse(read.body).success).toBe(true)
    expect(read.body).toEqual({ data: { dailyHandsGoal: 50, updatedAt: timestamp } })
    expect(read.headers['cache-control']).toBe('no-store')
    expect(service.readTrainingGoal).toHaveBeenCalledWith(ownerId)

    const updated = await request(app)
      .put('/api/v1/settings/training-goal')
      .send({ dailyHandsGoal: 50 })
      .expect(200)
    expect(trainingGoalResponseSchema.safeParse(updated.body).success).toBe(true)
    expect(updated.body).toEqual({ data: { dailyHandsGoal: 50, updatedAt: timestamp } })
    expect(updated.headers['cache-control']).toBe('no-store')
    expect(service.writeTrainingGoal).toHaveBeenCalledWith(ownerId, 50)

    const cleared = await request(app)
      .put('/api/v1/settings/training-goal')
      .send({ dailyHandsGoal: null })
      .expect(200)
    expect(trainingGoalResponseSchema.safeParse(cleared.body).success).toBe(true)
    expect(cleared.body).toEqual({ data: { dailyHandsGoal: null, updatedAt: null } })
    expect(service.writeTrainingGoal).toHaveBeenLastCalledWith(ownerId, null)
  })

  it('resets practice stats only for an explicit confirmation', async () => {
    const { app, service } = createSettingsTestApp()
    const reset = await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .send({ confirm: true })
      .expect(200)
    expect(resetPracticeStatsResponseSchema.safeParse(reset.body).success).toBe(true)
    expect(reset.body).toEqual({ data: { resetAt: timestamp, rangesReset: 2 } })
    expect(reset.headers['cache-control']).toBe('no-store')
    expect(service.resetPracticeStats).toHaveBeenCalledWith(ownerId)
  })

  it('requires an authenticated owner on every settings route', async () => {
    const passthrough: RequestHandler = (_request, _response, next) => next()
    const { app, service } = createSettingsTestApp({ required: passthrough, csrf: passthrough })
    const responses = [
      await request(app).get('/api/v1/settings/training-goal').expect(401),
      await request(app)
        .put('/api/v1/settings/training-goal')
        .send({ dailyHandsGoal: 50 })
        .expect(401),
      await request(app)
        .post('/api/v1/settings/reset-practice-stats')
        .send({ confirm: true })
        .expect(401),
    ]
    for (const response of responses) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' })
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expectUntouched(service)
  })

  it('refuses mutations when CSRF validation fails', async () => {
    const { app, service } = createSettingsTestApp({
      required: attachAuth,
      csrf: (req, res) => sendCsrfFailed(req, res),
    })
    const responses = [
      await request(app)
        .put('/api/v1/settings/training-goal')
        .send({ dailyHandsGoal: 50 })
        .expect(403),
      await request(app)
        .post('/api/v1/settings/reset-practice-stats')
        .send({ confirm: true })
        .expect(403),
    ]
    for (const response of responses) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'CSRF_FAILED' })
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(service.writeTrainingGoal).not.toHaveBeenCalled()
    expect(service.resetPracticeStats).not.toHaveBeenCalled()
  })

  it('rejects over-posted, non-integer, and out-of-range training goals', async () => {
    const { app, service } = createSettingsTestApp()
    const invalidBodies: unknown[] = [
      { dailyHandsGoal: 50, extra: true },
      { dailyHandsGoal: 0 },
      { dailyHandsGoal: -1 },
      { dailyHandsGoal: 20.5 },
      { dailyHandsGoal: MAX_DAILY_HANDS_GOAL + 1 },
      { dailyHandsGoal: '50' },
      {},
    ]
    for (const body of invalidBodies) {
      const response = await request(app)
        .put('/api/v1/settings/training-goal')
        .send(body as object)
        .expect(422)
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' })
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(service.writeTrainingGoal).not.toHaveBeenCalled()

    const accepted = await request(app)
      .put('/api/v1/settings/training-goal')
      .send({ dailyHandsGoal: MAX_DAILY_HANDS_GOAL })
      .expect(200)
    expect(trainingGoalResponseSchema.safeParse(accepted.body).success).toBe(true)
    expect(service.writeTrainingGoal).toHaveBeenCalledWith(ownerId, MAX_DAILY_HANDS_GOAL)
  })

  it('rejects a practice-stats reset without an explicit confirmation', async () => {
    const { app, service } = createSettingsTestApp()
    const invalidBodies: unknown[] = [
      { confirm: false },
      {},
      { confirm: 'true' },
      { confirm: true, extra: 1 },
    ]
    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/v1/settings/reset-practice-stats')
        .send(body as object)
        .expect(422)
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' })
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(service.resetPracticeStats).not.toHaveBeenCalled()
  })

  it('delegates unexpected service failures to the central problem handler', async () => {
    const { app, service } = createSettingsTestApp()
    service.readTrainingGoal.mockRejectedValueOnce(new Error('database password is secret'))
    const read = await request(app).get('/api/v1/settings/training-goal').expect(500)
    expect(read.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(problemDetailsSchema.safeParse(read.body).success).toBe(true)
    expect(JSON.stringify(read.body)).not.toContain('password')
    expect(read.headers['cache-control']).toBe('no-store')

    service.writeTrainingGoal.mockRejectedValueOnce(new Error('database password is secret'))
    const write = await request(app)
      .put('/api/v1/settings/training-goal')
      .send({ dailyHandsGoal: 50 })
      .expect(500)
    expect(write.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(write.headers['cache-control']).toBe('no-store')

    service.resetPracticeStats.mockRejectedValueOnce(new Error('database password is secret'))
    const reset = await request(app)
      .post('/api/v1/settings/reset-practice-stats')
      .send({ confirm: true })
      .expect(500)
    expect(reset.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(reset.headers['cache-control']).toBe('no-store')
  })
})
