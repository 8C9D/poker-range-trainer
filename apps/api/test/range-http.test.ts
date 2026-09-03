import type { RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  bulkRangeMutationResponseSchema,
  problemDetailsSchema,
  rangeCreateResponseSchema,
  rangeDeleteResponseSchema,
  rangeDuplicateResponseSchema,
  rangeFavoriteResponseSchema,
  rangeListResponseSchema,
  rangeReadResponseSchema,
  rangeRestoreResponseSchema,
  rangeUpdateResponseSchema,
  rangeArchiveResponseSchema,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import type { AuthMiddleware } from '../src/auth/middleware.js'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'
import {
  RangeInputError,
  RangeNotFoundError,
  RangeVersionConflictError,
} from '../src/ranges/repository.js'
import { createRangeRouter } from '../src/ranges/routes.js'

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const otherOwnerId = '7a7e6f3e-17be-4b69-a31b-1f902417c561'
const rangeId = '4d0946bc-a2dc-4236-9cb9-f3e376bc871d'
const copiedRangeId = '4d0946bc-a2dc-4236-9cb9-f3e376bc871e'
const timestamp = '2026-01-02T03:04:05.000Z'

const readRange = {
  id: rangeId,
  version: 1,
  name: 'BTN open',
  hands: ['AA', 'AKs'],
  metadata: { gameType: 'cash' as const, position: 'btn' as const },
  displayOrder: 0,
  archived: false,
  favorite: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}

const listItem = {
  id: rangeId,
  version: 1,
  name: 'BTN open',
  metadata: { gameType: 'cash' as const, position: 'btn' as const },
  displayOrder: 0,
  handCount: 2,
  comboCount: 10,
  rangePercentage: (10 / 1326) * 100,
  archived: false,
  favorite: false,
  updatedAt: timestamp,
  deletedAt: null,
}

function testConfig() {
  return {
    ...loadConfig({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/poker',
      NODE_ENV: 'test',
    }),
    rateLimitMax: 1_000,
  }
}

function createRangeTestApp() {
  const service = {
    create: vi.fn(async () => readRange),
    list: vi.fn(async () => ({
      data: [listItem],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })),
    get: vi.fn(async () => readRange),
    update: vi.fn(async () => readRange),
    archive: vi.fn(async () => ({ ...readRange, archived: true, version: 2 })),
    unarchive: vi.fn(async () => readRange),
    favorite: vi.fn(async () => ({ ...readRange, favorite: true, version: 2 })),
    unfavorite: vi.fn(async () => readRange),
    delete: vi.fn(async () => ({ id: rangeId, version: 2, deletedAt: timestamp })),
    restore: vi.fn(async () => readRange),
    duplicate: vi.fn(async () => ({ ...readRange, id: copiedRangeId, name: 'BTN open (copy)' })),
    bulk: vi.fn(async () => ({
      action: 'favorite' as const,
      atomic: true as const,
      items: [listItem],
    })),
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
  const required = vi.fn(attachAuth)
  const csrf = vi.fn(attachAuth)
  const middleware: Pick<AuthMiddleware, 'required' | 'csrf'> = { required, csrf }
  const app = createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    readiness: async () => undefined,
    registerRoutes(api) {
      api.use('/api/v1/ranges', createRangeRouter({ service, middleware }))
    },
  })
  return {
    app,
    service,
    required,
    csrf,
  }
}

describe('HTTP range library routes', () => {
  it('uses required auth for reads, CSRF auth for mutations, maps every operation, and returns contract envelopes', async () => {
    const { app, service, required, csrf } = createRangeTestApp()

    const created = await request(app)
      .post('/api/v1/ranges')
      .send({ name: ' BTN open ', hands: ['AA', 'AKs'] })
      .expect(201)
    expect(rangeCreateResponseSchema.safeParse(created.body).success).toBe(true)
    expect(created.headers['cache-control']).toBe('no-store')
    expect(service.create).toHaveBeenCalledWith(ownerId, { name: 'BTN open', hands: ['AA', 'AKs'] })

    const listed = await request(app).get('/api/v1/ranges?favorite=true').expect(200)
    expect(rangeListResponseSchema.safeParse(listed.body).success).toBe(true)
    expect(service.list).toHaveBeenCalledWith(ownerId, expect.objectContaining({ favorite: true }))
    const read = await request(app).get(`/api/v1/ranges/${rangeId}`).expect(200)
    expect(rangeReadResponseSchema.safeParse(read.body).success).toBe(true)

    const bulk = await request(app)
      .post('/api/v1/ranges/bulk')
      .send({ action: 'favorite', items: [{ id: rangeId, version: 1 }] })
      .expect(200)
    expect(bulkRangeMutationResponseSchema.safeParse(bulk.body).success).toBe(true)
    const updated = await request(app)
      .patch(`/api/v1/ranges/${rangeId}`)
      .send({ version: 1, name: 'Updated' })
      .expect(200)
    expect(rangeUpdateResponseSchema.safeParse(updated.body).success).toBe(true)
    const deleted = await request(app)
      .delete(`/api/v1/ranges/${rangeId}`)
      .send({ version: 1 })
      .expect(200)
    expect(rangeDeleteResponseSchema.safeParse(deleted.body).success).toBe(true)
    const archived = await request(app)
      .post(`/api/v1/ranges/${rangeId}/archive`)
      .send({ version: 1, archived: true })
      .expect(200)
    expect(rangeArchiveResponseSchema.safeParse(archived.body).success).toBe(true)
    const unarchived = await request(app)
      .post(`/api/v1/ranges/${rangeId}/archive`)
      .send({ version: 1, archived: false })
      .expect(200)
    expect(rangeArchiveResponseSchema.safeParse(unarchived.body).success).toBe(true)
    const favorited = await request(app)
      .post(`/api/v1/ranges/${rangeId}/favorite`)
      .send({ version: 1, favorite: true })
      .expect(200)
    expect(rangeFavoriteResponseSchema.safeParse(favorited.body).success).toBe(true)
    const unfavorited = await request(app)
      .post(`/api/v1/ranges/${rangeId}/favorite`)
      .send({ version: 1, favorite: false })
      .expect(200)
    expect(rangeFavoriteResponseSchema.safeParse(unfavorited.body).success).toBe(true)
    const restored = await request(app)
      .post(`/api/v1/ranges/${rangeId}/restore`)
      .send({ version: 2 })
      .expect(200)
    expect(rangeRestoreResponseSchema.safeParse(restored.body).success).toBe(true)
    const duplicate = await request(app)
      .post(`/api/v1/ranges/${rangeId}/duplicate`)
      .send({ version: 1 })
      .expect(200)
    expect(rangeDuplicateResponseSchema.safeParse(duplicate.body).success).toBe(true)

    expect(service.bulk).toHaveBeenCalledWith(ownerId, {
      action: 'favorite',
      items: [{ id: rangeId, version: 1 }],
    })
    expect(service.update).toHaveBeenCalledWith(ownerId, rangeId, { version: 1, name: 'Updated' })
    expect(service.delete).toHaveBeenCalledWith(ownerId, rangeId, 1)
    expect(service.archive).toHaveBeenCalledWith(ownerId, rangeId, 1)
    expect(service.unarchive).toHaveBeenCalledWith(ownerId, rangeId, 1)
    expect(service.favorite).toHaveBeenCalledWith(ownerId, rangeId, 1)
    expect(service.unfavorite).toHaveBeenCalledWith(ownerId, rangeId, 1)
    expect(service.restore).toHaveBeenCalledWith(ownerId, rangeId, 2)
    expect(service.duplicate).toHaveBeenCalledWith(ownerId, rangeId, { version: 1 })
    expect(required).toHaveBeenCalledTimes(2)
    expect(csrf).toHaveBeenCalledTimes(10)
  })

  it('validates strict params, query, and bodies before invoking the service and never accepts an owner in input', async () => {
    const { app, service } = createRangeTestApp()
    const badParams = await request(app).get('/api/v1/ranges/not-a-uuid').expect(422)
    expect(problemDetailsSchema.safeParse(badParams.body).success).toBe(true)
    expect(badParams.headers['cache-control']).toBe('no-store')
    await request(app).get('/api/v1/ranges?unknown=value').expect(422)
    await request(app)
      .post('/api/v1/ranges')
      .send({ name: 'Valid', hands: ['AA'], userId: otherOwnerId })
      .expect(422)
    await request(app).delete(`/api/v1/ranges/${rangeId}`).send({}).expect(422)
    expect(service.get).not.toHaveBeenCalled()
    expect(service.list).not.toHaveBeenCalled()
    expect(service.create).not.toHaveBeenCalled()
    expect(service.delete).not.toHaveBeenCalled()
  })

  it('short-circuits validation before checking a malformed injected auth context', async () => {
    const middleware: Pick<AuthMiddleware, 'required' | 'csrf'> = {
      required: (_request, _response, next) => next(),
      csrf: (_request, _response, next) => next(),
    }
    const app = createApp({
      config: testConfig(),
      logger: createLogger('silent'),
      readiness: async () => undefined,
      registerRoutes(api) {
        api.use(
          '/api/v1/ranges',
          createRangeRouter({
            service: {} as Parameters<typeof createRangeRouter>[0]['service'],
            middleware,
          }),
        )
      },
    })

    await request(app).post('/api/v1/ranges').send({ name: '', hands: [] }).expect(422)
  })

  it('maps domain failures without leaking ownership and delegates unexpected errors centrally', async () => {
    const { app, service } = createRangeTestApp()
    service.get.mockRejectedValueOnce(new RangeNotFoundError())
    const missing = await request(app).get(`/api/v1/ranges/${rangeId}`).expect(404)
    expect(missing.body).toMatchObject({
      code: 'NOT_FOUND',
      detail: 'The requested range does not exist.',
    })
    expect(missing.headers['cache-control']).toBe('no-store')

    service.update.mockRejectedValueOnce(new RangeVersionConflictError())
    const conflict = await request(app)
      .patch(`/api/v1/ranges/${rangeId}`)
      .send({ version: 1, name: 'Updated' })
      .expect(409)
    expect(conflict.body).toMatchObject({ code: 'CONFLICT' })

    service.create.mockRejectedValueOnce(new RangeInputError('internal details'))
    const invalid = await request(app)
      .post('/api/v1/ranges')
      .send({ name: 'Valid', hands: ['AA'] })
      .expect(422)
    expect(invalid.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      detail: 'The range operation is invalid.',
    })
    expect(JSON.stringify(invalid.body)).not.toContain('internal details')

    service.duplicate.mockRejectedValueOnce(new Error('database detail'))
    const unexpected = await request(app)
      .post(`/api/v1/ranges/${rangeId}/duplicate`)
      .send({ version: 1 })
      .expect(500)
    expect(unexpected.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(unexpected.headers['cache-control']).toBe('no-store')
  })
})
