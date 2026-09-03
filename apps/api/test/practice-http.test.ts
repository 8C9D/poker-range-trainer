import type { RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  practiceSessionSubmissionResponseSchema,
  problemDetailsSchema,
  progressReadModelSchema,
  progressResponseSchema,
  rangePracticeReadResponseSchema,
  rangePracticeReadSchema,
  todayReadModelSchema,
  todayResponseSchema,
  type PracticeSessionSubmission,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import type { AuthMiddleware } from '../src/auth/middleware.js'
import { sendCsrfFailed } from '../src/auth/middleware.js'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'
import {
  PracticeIdempotencyConflictError,
  PracticeRangeNotFoundError,
  PracticeReplayCorruptedError,
  PracticeUnscorableError,
} from '../src/practice/repository.js'
import { createPracticeRouter } from '../src/practice/routes.js'

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const rangeId = '4d0946bc-a2dc-4236-9cb9-f3e376bc871d'
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

function responseFor(mode: PracticeSessionSubmission['mode']) {
  return practiceSessionSubmissionResponseSchema.parse({
    data: {
      session: {
        id: 'a2fa11de-89ef-479e-8d9d-6780e1fb5d14',
        rangeId,
        mode,
        totalQuestions: 2,
        correctAnswers: 1,
        accuracyPercentage: 50,
        completedAt: timestamp,
      },
      stats: {
        rangeId,
        totalAttempts: 2,
        correctAttempts: 1,
        accuracyPercentage: 50,
        lastPracticedAt: timestamp,
      },
      review: {
        rangeId,
        ease: 2.5,
        intervalDays: 1,
        dueAt: '2026-01-03T03:04:05.000Z',
        lastReviewedAt: timestamp,
      },
    },
  })
}

const todayReadModel = todayReadModelSchema.parse({
  generatedAt: timestamp,
  streakDays: 2,
  dailyGoal: { target: 20, handsAnswered: 12, remainingHands: 8 },
  trailingSevenDays: {
    handsAnswered: 12,
    correctAnswers: 9,
    accuracyPercentage: 75,
    sharpestRange: {
      id: rangeId,
      name: 'BTN practice',
      handsAnswered: 12,
      correctAnswers: 9,
      accuracyPercentage: 75,
    },
  },
  dueRanges: [
    {
      id: rangeId,
      name: 'BTN practice',
      dueAt: timestamp,
      accuracyPercentage: 75,
      lastPracticedAt: timestamp,
    },
  ],
  caughtUp: false,
  freePractice: null,
})

const progressReadModel = progressReadModelSchema.parse({
  generatedAt: timestamp,
  streakDays: 2,
  allTime: { rangesPracticed: 1, handsAnswered: 12, correctAnswers: 9, accuracyPercentage: 75 },
  trailingThirtyDays: { handsAnswered: 12, correctAnswers: 9, accuracyPercentage: 75 },
  dailyActivity: [{ day: '2026-01-02', handsAnswered: 12 }],
  weeklyAccuracyTrend: [
    { weekStart: '2025-12-27', handsAnswered: 12, correctAnswers: 9, accuracyPercentage: 75 },
  ],
  handClassLeaks: [],
  mistakeBias: { loose: 0, tight: 0, mistakes: 0, loosePercentage: 0, bias: 'unknown' },
  positionLeans: [],
  weakestHands: [],
})

const rangePracticeRead = rangePracticeReadSchema.parse({
  rangeId,
  stats: {
    rangeId,
    totalAttempts: 12,
    correctAttempts: 9,
    accuracyPercentage: 75,
    lastPracticedAt: timestamp,
  },
  review: {
    rangeId,
    ease: 2.5,
    intervalDays: 1,
    dueAt: '2026-01-03T03:04:05.000Z',
    lastReviewedAt: timestamp,
  },
  handAccuracy: [{ hand: 'AA', attempts: 4, correct: 3, falsePositives: 1, falseNegatives: 0 }],
  recentSessions: [
    {
      id: 'a2fa11de-89ef-479e-8d9d-6780e1fb5d14',
      rangeId,
      mode: 'recognition',
      totalQuestions: 12,
      correctAnswers: 9,
      accuracyPercentage: 75,
      completedAt: timestamp,
    },
  ],
})

function requestFor(mode: PracticeSessionSubmission['mode']): PracticeSessionSubmission {
  const idempotencyKey = 'd4e2a1de-89ef-479e-8d9d-6780e1fb5d14'
  if (mode === 'build') {
    return { mode, rangeId, idempotencyKey, selectedHands: ['AA'] }
  }
  return {
    mode,
    rangeId,
    idempotencyKey,
    answers: [
      {
        questionId: 'e3e2a1de-89ef-479e-8d9d-6780e1fb5d14',
        hand: 'AA',
        answer: false,
        answeredAt: timestamp,
      },
    ],
  }
}

function createPracticeTestApp() {
  const service = {
    submit: vi.fn(async (_ownerId: string, input: PracticeSessionSubmission) =>
      responseFor(input.mode),
    ),
    readRange: vi.fn(async () => rangePracticeRead),
    today: vi.fn(async () => todayReadModel),
    progress: vi.fn(async () => progressReadModel),
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
  const csrf = vi.fn(attachAuth)
  const required = vi.fn(attachAuth)
  const middleware: Pick<AuthMiddleware, 'required' | 'csrf'> = { csrf, required }
  const app = createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    readiness: async () => undefined,
    registerRoutes(api) {
      api.use('/api/v1/practice', createPracticeRouter({ service, middleware }))
    },
  })
  return { app, service, csrf, required }
}

/** A router whose auth middleware runs but leaves the request anonymous. */
function createAnonymousPracticeApp() {
  const service = {
    submit: vi.fn(),
    readRange: vi.fn(),
    today: vi.fn(),
    progress: vi.fn(),
  }
  const pass: RequestHandler = (_request, _response, next) => next()
  const app = createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    readiness: async () => undefined,
    registerRoutes(api) {
      api.use(
        '/api/v1/practice',
        createPracticeRouter({ service, middleware: { csrf: pass, required: pass } }),
      )
    },
  })
  return { app, service }
}

describe('HTTP practice session route', () => {
  it.each(['recognition', 'timed', 'weakness', 'edges', 'mistakes', 'build'] as const)(
    'forwards authenticated %s submissions through the service port with a contract response',
    async (mode) => {
      const { app, service, csrf } = createPracticeTestApp()
      const submission = requestFor(mode)
      const response = await request(app)
        .post('/api/v1/practice/sessions')
        .send(submission)
        .expect(200)
      expect(practiceSessionSubmissionResponseSchema.safeParse(response.body).success).toBe(true)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(service.submit).toHaveBeenCalledWith(ownerId, submission)
      expect(csrf).toHaveBeenCalledOnce()
    },
  )

  it('short-circuits auth, CSRF, and strict contract failures before service work', async () => {
    const { app, service } = createPracticeTestApp()
    const malformed = requestFor('recognition')
    const invalidContentType = await request(app)
      .post('/api/v1/practice/sessions')
      .type('text')
      .send(JSON.stringify(malformed))
      .expect(422)
    const unknownField = await request(app)
      .post('/api/v1/practice/sessions')
      .send({ ...malformed, userId: '7a7e6f3e-17be-4b69-a31b-1f902417c561' })
      .expect(422)
    const badMode = await request(app)
      .post('/api/v1/practice/sessions')
      .send({ ...malformed, mode: 'unknown' })
      .expect(422)
    const badRangeId = await request(app)
      .post('/api/v1/practice/sessions')
      .send({ ...malformed, rangeId: 'not-a-uuid' })
      .expect(422)
    const duplicateQuestion = await request(app)
      .post('/api/v1/practice/sessions')
      .send({
        ...malformed,
        answers: [malformed.answers[0], { ...malformed.answers[0], hand: 'AKo' }],
      })
      .expect(422)
    const badTimestamp = await request(app)
      .post('/api/v1/practice/sessions')
      .send({ ...malformed, answers: [{ ...malformed.answers[0]!, answeredAt: 'not-a-date' }] })
      .expect(422)
    for (const response of [
      invalidContentType,
      unknownField,
      badMode,
      badRangeId,
      duplicateQuestion,
      badTimestamp,
    ]) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(service.submit).not.toHaveBeenCalled()

    const csrfService = { submit: vi.fn(), readRange: vi.fn(), today: vi.fn(), progress: vi.fn() }
    const csrfBlocked = createApp({
      config: testConfig(),
      logger: createLogger('silent'),
      readiness: async () => undefined,
      registerRoutes(api) {
        api.use(
          '/api/v1/practice',
          createPracticeRouter({
            service: csrfService,
            middleware: {
              csrf: (req, res) => sendCsrfFailed(req, res),
              required: (_req, _res, next) => next(),
            },
          }),
        )
      },
    })
    const csrfFailure = await request(csrfBlocked)
      .post('/api/v1/practice/sessions')
      .send(malformed)
      .expect(403)
    expect(problemDetailsSchema.safeParse(csrfFailure.body).success).toBe(true)
    expect(csrfService.submit).not.toHaveBeenCalled()

    const unauthenticatedService = {
      submit: vi.fn(),
      readRange: vi.fn(),
      today: vi.fn(),
      progress: vi.fn(),
    }
    const unauthenticated = createApp({
      config: testConfig(),
      logger: createLogger('silent'),
      readiness: async () => undefined,
      registerRoutes(api) {
        api.use(
          '/api/v1/practice',
          createPracticeRouter({
            service: unauthenticatedService,
            middleware: {
              csrf: (_req, _res, next) => next(),
              required: (_req, _res, next) => next(),
            },
          }),
        )
      },
    })
    const unauthenticatedFailure = await request(unauthenticated)
      .post('/api/v1/practice/sessions')
      .send(malformed)
      .expect(401)
    expect(problemDetailsSchema.safeParse(unauthenticatedFailure.body).success).toBe(true)
    expect(unauthenticatedService.submit).not.toHaveBeenCalled()
  })

  it('maps domain errors safely and delegates corrupt or unexpected failures centrally', async () => {
    const { app, service } = createPracticeTestApp()
    service.submit.mockRejectedValueOnce(new PracticeRangeNotFoundError())
    const missing = await request(app)
      .post('/api/v1/practice/sessions')
      .send(requestFor('recognition'))
      .expect(404)
    expect(missing.body).toMatchObject({
      code: 'NOT_FOUND',
      detail: 'The requested range does not exist.',
    })

    service.submit.mockRejectedValueOnce(new PracticeIdempotencyConflictError())
    const conflict = await request(app)
      .post('/api/v1/practice/sessions')
      .send(requestFor('recognition'))
      .expect(409)
    expect(conflict.body).toMatchObject({ code: 'CONFLICT' })

    service.submit.mockRejectedValueOnce(new PracticeUnscorableError())
    const unscorable = await request(app)
      .post('/api/v1/practice/sessions')
      .send(requestFor('build'))
      .expect(422)
    expect(unscorable.body).toMatchObject({ code: 'VALIDATION_FAILED' })

    service.submit.mockRejectedValueOnce(new PracticeReplayCorruptedError())
    const corrupted = await request(app)
      .post('/api/v1/practice/sessions')
      .send(requestFor('recognition'))
      .expect(500)
    expect(problemDetailsSchema.safeParse(corrupted.body).success).toBe(true)
    expect(JSON.stringify(corrupted.body)).not.toContain('stored practice replay')
    expect(corrupted.headers['cache-control']).toBe('no-store')

    service.submit.mockRejectedValueOnce(new Error('database connection detail'))
    const unexpected = await request(app)
      .post('/api/v1/practice/sessions')
      .send(requestFor('recognition'))
      .expect(500)
    expect(unexpected.body).toMatchObject({ code: 'INTERNAL_ERROR' })
  })
})

describe('HTTP practice read routes', () => {
  it('returns one range practice read for the authenticated owner', async () => {
    const { app, service, required } = createPracticeTestApp()

    const response = await request(app).get(`/api/v1/practice/ranges/${rangeId}`).expect(200)

    expect(rangePracticeReadResponseSchema.safeParse(response.body).success).toBe(true)
    expect(response.body.data).toMatchObject({ rangeId, stats: { totalAttempts: 12 } })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(service.readRange).toHaveBeenCalledWith(ownerId, rangeId)
    expect(required).toHaveBeenCalledOnce()
  })

  it('rejects a malformed range id and reports a missing range as not found', async () => {
    const { app, service } = createPracticeTestApp()

    const malformed = await request(app).get('/api/v1/practice/ranges/not-a-uuid').expect(422)
    expect(problemDetailsSchema.safeParse(malformed.body).success).toBe(true)
    expect(service.readRange).not.toHaveBeenCalled()

    service.readRange.mockRejectedValueOnce(new PracticeRangeNotFoundError())
    const missing = await request(app).get(`/api/v1/practice/ranges/${rangeId}`).expect(404)
    expect(missing.body).toMatchObject({
      code: 'NOT_FOUND',
      detail: 'The requested range does not exist.',
    })
    expect(missing.headers['cache-control']).toBe('no-store')
  })

  it('returns the Today and Progress projections for a known zone', async () => {
    const { app, service } = createPracticeTestApp()

    const today = await request(app)
      .get('/api/v1/practice/today?timeZone=Pacific%2FAuckland')
      .expect(200)
    const progress = await request(app).get('/api/v1/practice/progress?timeZone=UTC').expect(200)

    expect(todayResponseSchema.safeParse(today.body).success).toBe(true)
    expect(progressResponseSchema.safeParse(progress.body).success).toBe(true)
    expect(today.body.data).toMatchObject({ streakDays: 2, caughtUp: false })
    expect(progress.body.data).toMatchObject({ allTime: { handsAnswered: 12 } })
    expect(today.headers['cache-control']).toBe('no-store')
    expect(progress.headers['cache-control']).toBe('no-store')
    expect(service.today).toHaveBeenCalledWith(ownerId, 'Pacific/Auckland')
    expect(service.progress).toHaveBeenCalledWith(ownerId, 'UTC')
  })

  it('refuses a missing, unknown, or over-specified time zone before any service work', async () => {
    const { app, service } = createPracticeTestApp()

    const missing = await request(app).get('/api/v1/practice/today').expect(422)
    const unknown = await request(app)
      .get('/api/v1/practice/today?timeZone=Not%2FAZone')
      .expect(422)
    const unknownProgress = await request(app)
      .get('/api/v1/practice/progress?timeZone=Mars%2FOlympus')
      .expect(422)
    const extraQuery = await request(app)
      .get('/api/v1/practice/progress?timeZone=UTC&window=90')
      .expect(422)

    for (const response of [missing, unknown, unknownProgress, extraQuery]) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' })
      expect(response.headers['cache-control']).toBe('no-store')
    }
    // An installed-zone failure is reported against the field the caller sent.
    for (const response of [unknown, unknownProgress]) {
      expect(response.body.issues).toEqual([
        { path: ['timeZone'], code: 'invalid_time_zone', message: expect.any(String) },
      ])
    }
    expect(service.today).not.toHaveBeenCalled()
    expect(service.progress).not.toHaveBeenCalled()
  })

  it('never reads for an anonymous request', async () => {
    const { app, service } = createAnonymousPracticeApp()

    for (const path of [
      `/api/v1/practice/ranges/${rangeId}`,
      '/api/v1/practice/today?timeZone=UTC',
      '/api/v1/practice/progress?timeZone=UTC',
    ]) {
      const response = await request(app).get(path).expect(401)
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' })
    }
    expect(service.readRange).not.toHaveBeenCalled()
    expect(service.today).not.toHaveBeenCalled()
    expect(service.progress).not.toHaveBeenCalled()
  })
})
