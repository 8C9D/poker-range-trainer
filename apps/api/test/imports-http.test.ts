import type { RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  legacyBackupCommitResponseSchema,
  legacyBackupExportResponseSchema,
  legacyBackupPreviewResponseSchema,
  legacyBackupV1Schema,
  problemDetailsSchema,
  type LegacyBackupV1,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import type { AuthMiddleware } from '../src/auth/middleware.js'
import { sendCsrfFailed, sendUnauthenticated } from '../src/auth/middleware.js'
import { loadConfig } from '../src/config.js'
import {
  LegacyImportAlreadyImportedError,
  LegacyImportDigestMismatchError,
  LegacyImportInProgressError,
} from '../src/imports/repository.js'
import { createExportsRouter, createImportsRouter } from '../src/imports/routes.js'
import { createLogger } from '../src/logger.js'

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const timestamp = '2026-01-02T03:04:05.000Z'
const digest = `sha256:${'a'.repeat(64)}`

const backup: LegacyBackupV1 = legacyBackupV1Schema.parse({
  version: 1,
  exportedAt: timestamp,
  ranges: [
    {
      id: 'rng-1',
      name: 'BTN open',
      hands: ['AA', 'AKs'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tags: ['6-max'],
    },
  ],
  practiceStats: {},
  handAccuracy: {},
  actionAccuracy: {},
  sessionHistory: {},
  reviewStates: {},
  trainingGoal: 50,
})

const exportedBackup: LegacyBackupV1 = legacyBackupV1Schema.parse({
  ...backup,
  exportedAt: '2026-02-01T09:15:00.000Z',
})

const counts = {
  ranges: 1,
  practiceStats: 0,
  handAccuracy: 0,
  actionAccuracy: 0,
  sessions: 0,
  reviewStates: 0,
  spotAccuracy: 0,
}

const previewData = legacyBackupPreviewResponseSchema.parse({
  data: {
    digest,
    counts,
    preservationWarnings: [
      {
        kind: 'dormant_range_fields',
        path: ['ranges', 0, 'tags'],
        message: 'Range "rng-1" carries the dormant field "tags".',
      },
    ],
    conflicts: [{ kind: 'merge_required', rangeIds: [], message: 'The library is not empty.' }],
    alreadyImported: false,
  },
}).data

const commitData = legacyBackupCommitResponseSchema.parse({
  data: { result: 'committed', atomic: true, digest, strategy: 'merge', counts },
}).data

function testConfig() {
  return {
    ...loadConfig({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/poker',
      NODE_ENV: 'test',
    }),
    rateLimitMax: 1_000,
  }
}

function createImportsTestApp() {
  const service = {
    preview: vi.fn(async () => previewData),
    commit: vi.fn(async () => commitData),
    exportBackup: vi.fn(async () => exportedBackup),
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
  return { ...mountApp(service, { csrf, required }), service, csrf, required }
}

function mountApp(
  service: Parameters<typeof createImportsRouter>[0]['service'],
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'>,
) {
  const app = createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    readiness: async () => undefined,
    registerRoutes(api) {
      api.use('/api/v1/imports', createImportsRouter({ service, middleware }))
      api.use('/api/v1/exports', createExportsRouter({ service, middleware }))
    },
  })
  return { app }
}

function anonymousService() {
  return { preview: vi.fn(), commit: vi.fn(), exportBackup: vi.fn() }
}

describe('HTTP legacy import routes', () => {
  it('previews a backup for the authenticated owner without writing', async () => {
    const { app, service, csrf } = createImportsTestApp()
    const response = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({ backup })
      .expect(200)
    expect(legacyBackupPreviewResponseSchema.safeParse(response.body).success).toBe(true)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data).toEqual(previewData)
    expect(service.preview).toHaveBeenCalledWith(ownerId, backup)
    expect(csrf).toHaveBeenCalledOnce()
  })

  it('commits a backup and answers with the atomic contract result', async () => {
    const { app, service } = createImportsTestApp()
    const response = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .send({ backup, expectedDigest: digest, strategy: 'merge' })
      .expect(200)
    expect(legacyBackupCommitResponseSchema.safeParse(response.body).success).toBe(true)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data).toMatchObject({ result: 'committed', atomic: true })
    expect(service.commit).toHaveBeenCalledWith(ownerId, {
      backup,
      expectedDigest: digest,
      strategy: 'merge',
    })
  })

  it('exports the library as a downloadable, contract-valid backup file', async () => {
    const { app, service, required } = createImportsTestApp()
    const response = await request(app).get('/api/v1/exports/backup').expect(200)
    expect(legacyBackupExportResponseSchema.safeParse(response.body).success).toBe(true)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="poker-range-trainer-backup-2026-02-01.json"',
    )
    expect(response.body.data.backup).toEqual(exportedBackup)
    expect(service.exportBackup).toHaveBeenCalledWith(ownerId)
    expect(required).toHaveBeenCalledOnce()
  })

  it('rejects malformed bodies before any service work', async () => {
    const { app, service } = createImportsTestApp()
    const noBackup = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({})
      .expect(422)
    const unknownField = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({ backup, userId: ownerId })
      .expect(422)
    const badVersion = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({ backup: { ...backup, version: 2 } })
      .expect(422)
    const danglingRange = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({
        backup: {
          ...backup,
          reviewStates: {
            'rng-missing': {
              rangeId: 'rng-missing',
              ease: 2.5,
              intervalDays: 0,
              dueAt: '',
              lastReviewedAt: '',
            },
          },
        },
      })
      .expect(422)
    const badStrategy = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .send({ backup, expectedDigest: digest, strategy: 'overwrite' })
      .expect(422)
    const badDigest = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .send({ backup, expectedDigest: 'not-a-digest', strategy: 'merge' })
      .expect(422)

    for (const response of [
      noBackup,
      unknownField,
      badVersion,
      danglingRange,
      badStrategy,
      badDigest,
    ]) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body.code).toBe('VALIDATION_FAILED')
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(service.preview).not.toHaveBeenCalled()
    expect(service.commit).not.toHaveBeenCalled()
  })

  it('short-circuits CSRF failures and anonymous requests', async () => {
    const csrfService = anonymousService()
    const { app: csrfBlocked } = mountApp(csrfService, {
      csrf: (request, response) => sendCsrfFailed(request, response),
      required: (_request, _response, next) => next(),
    })
    for (const path of ['/api/v1/imports/legacy-backup/preview', '/api/v1/imports/legacy-backup']) {
      const response = await request(csrfBlocked).post(path).send({ backup }).expect(403)
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body.code).toBe('CSRF_FAILED')
    }
    expect(csrfService.preview).not.toHaveBeenCalled()
    expect(csrfService.commit).not.toHaveBeenCalled()

    const service = anonymousService()
    const pass: RequestHandler = (_request, _response, next) => next()
    const { app: anonymous } = mountApp(service, { csrf: pass, required: pass })
    const preview = await request(anonymous)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({ backup })
      .expect(401)
    const commit = await request(anonymous)
      .post('/api/v1/imports/legacy-backup')
      .send({ backup, expectedDigest: digest, strategy: 'merge' })
      .expect(401)
    const exported = await request(anonymous).get('/api/v1/exports/backup').expect(401)
    for (const response of [preview, commit, exported]) {
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true)
      expect(response.body.code).toBe('UNAUTHENTICATED')
    }
    expect(service.preview).not.toHaveBeenCalled()
    expect(service.commit).not.toHaveBeenCalled()
    expect(service.exportBackup).not.toHaveBeenCalled()
  })

  it('reads a backup-sized body only for a caller the CSRF check accepted', async () => {
    const padding = 'x'.repeat(2 * 1024 * 1024)

    const guarded = anonymousService()
    const { app: anonymous } = mountApp(guarded, {
      csrf: (request, response) => sendUnauthenticated(request, response),
      required: (request, response) => sendUnauthenticated(request, response),
    })
    // Refusing before reading means the client can see the connection reset
    // instead of the response; both outcomes prove the 2 MiB never arrived.
    const outcome = await request(anonymous)
      .post('/api/v1/imports/legacy-backup')
      .send({ backup: { ...backup, padding }, expectedDigest: digest, strategy: 'merge' })
      .then(
        (response) =>
          response.status === 401 && response.body.code === 'UNAUTHENTICATED'
            ? 'refused'
            : `answered ${response.status}`,
        (error: Error) =>
          /ECONNRESET|EPIPE|socket hang up/.test(error.message) ? 'refused' : error.message,
      )
    expect(outcome).toBe('refused')
    expect(guarded.commit).not.toHaveBeenCalled()

    // The same body is read, and validated, once the caller is known.
    const { app, service } = createImportsTestApp()
    const accepted = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .send({ backup: { ...backup, padding } })
      .expect(200)
    expect(legacyBackupPreviewResponseSchema.safeParse(accepted.body).success).toBe(true)
    expect(service.preview).toHaveBeenCalledOnce()
    const received = service.preview.mock.calls[0]?.[1] as unknown as { padding?: string }
    expect(received.padding).toHaveLength(2 * 1024 * 1024)

    const malformed = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding }))
      .expect(422)
    expect(malformed.body.code).toBe('VALIDATION_FAILED')
  })

  it('maps import conflicts to 409 and hides unexpected failures', async () => {
    const { app, service } = createImportsTestApp()
    const body = { backup, expectedDigest: digest, strategy: 'merge' as const }

    service.commit.mockRejectedValueOnce(new LegacyImportDigestMismatchError())
    const mismatch = await request(app).post('/api/v1/imports/legacy-backup').send(body).expect(409)
    expect(mismatch.body).toMatchObject({
      code: 'CONFLICT',
      detail: expect.stringContaining('changed since it was previewed'),
    })

    service.commit.mockRejectedValueOnce(new LegacyImportAlreadyImportedError())
    const imported = await request(app).post('/api/v1/imports/legacy-backup').send(body).expect(409)
    expect(imported.body).toMatchObject({
      code: 'CONFLICT',
      detail: 'This backup was already imported.',
    })

    service.commit.mockRejectedValueOnce(new LegacyImportInProgressError())
    const inProgress = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .send(body)
      .expect(409)
    expect(inProgress.body).toMatchObject({ code: 'CONFLICT' })

    service.commit.mockRejectedValueOnce(new Error('database connection detail'))
    const unexpected = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .send(body)
      .expect(500)
    expect(unexpected.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(unexpected.body)).not.toContain('connection detail')

    service.exportBackup.mockRejectedValueOnce(new Error('database connection detail'))
    const exportFailure = await request(app).get('/api/v1/exports/backup').expect(500)
    expect(problemDetailsSchema.safeParse(exportFailure.body).success).toBe(true)
    expect(exportFailure.headers['cache-control']).toBe('no-store')
  })
})
