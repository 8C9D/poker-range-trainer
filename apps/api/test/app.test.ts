import express, { type Express } from 'express'
import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import type { Logger } from 'pino'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  healthResponseSchema,
  MAX_LEGACY_BACKUP_BYTES,
  problemDetailsSchema,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import { loadConfig, type ApiConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'
import { createServerRuntime } from '../src/server.js'

const requestId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const ready = async (): Promise<void> => undefined
const silentLogger = createLogger('silent')
const config = (overrides: Partial<ApiConfig> = {}): ApiConfig => ({
  ...loadConfig({
    DATABASE_URL: 'postgresql://user:password@localhost:5432/poker',
    NODE_ENV: 'test',
  }),
  ...overrides,
})

function assertProblem(body: unknown, status: number, code: string): void {
  expect(body).toMatchObject({ status, code })
  expect(body).toStrictEqual(
    expect.objectContaining({
      type: expect.stringMatching(/^https:\/\//),
      title: expect.any(String),
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }),
  )
  expect(problemDetailsSchema.safeParse(body).success).toBe(true)
}

describe('API app factory', () => {
  it('has no listener side effect and returns contract-valid liveness', async () => {
    const now = () => new Date('2026-01-02T03:04:05.000Z')
    const app = createApp({ config: config(), logger: silentLogger, readiness: ready, now })
    expect(app).toBeTypeOf('function')
    const response = await request(app).get('/api/v1/health/live')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: { status: 'ok', service: 'api', timestamp: now().toISOString() },
    })
    expect(healthResponseSchema.safeParse(response.body).success).toBe(true)
  })

  it('checks injected PostgreSQL readiness and conceals failures', async () => {
    const readiness = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const app = createApp({ config: config(), logger: silentLogger, readiness })
    await request(app).get('/api/v1/health/live').expect(200)
    expect(readiness).not.toHaveBeenCalled()
    await request(app).get('/api/v1/health/ready').expect(200)
    expect(readiness).toHaveBeenCalledOnce()

    const unavailable = createApp({
      config: config(),
      logger: silentLogger,
      readiness: async () => {
        throw new Error('postgres://secret-host')
      },
    })
    const response = await request(unavailable).get('/api/v1/health/ready').expect(503)
    expect(response.headers['content-type']).toContain('application/problem+json')
    assertProblem(response.body, 503, 'INTERNAL_ERROR')
    expect(JSON.stringify(response.body)).not.toContain('secret-host')
  })

  it('propagates only valid UUID request IDs', async () => {
    const app = createApp({ config: config(), logger: silentLogger, readiness: ready })
    const accepted = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', requestId)
      .expect(200)
    expect(accepted.headers['x-request-id']).toBe(requestId)
    const generated = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', 'not-a-uuid')
      .expect(200)
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i)
    expect(generated.headers['x-request-id']).not.toBe('not-a-uuid')
  })

  it('uses credentialed CORS only for exact allowed origins', async () => {
    const app = createApp({
      config: config({ frontendOrigins: ['https://app.example.com'] }),
      logger: silentLogger,
      readiness: ready,
    })
    const allowed = await request(app)
      .get('/api/v1/health/live')
      .set('Origin', 'https://app.example.com')
      .expect(200)
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')

    const preflight = await request(app)
      .options('/api/v1/health/live')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
    expect(preflight.headers['access-control-allow-origin']).toBe('https://app.example.com')
    expect(preflight.headers['access-control-allow-credentials']).toBe('true')

    const noOrigin = await request(app).get('/api/v1/health/live').expect(200)
    expect(noOrigin.headers['access-control-allow-origin']).toBeUndefined()

    const denied = await request(app)
      .get('/api/v1/health/live')
      .set('Origin', 'https://attacker.example')
      .expect(403)
    assertProblem(denied.body, 403, 'FORBIDDEN')
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('sets security headers and maps parsing, payload, rate-limit, and 404 failures', async () => {
    const app = createApp({
      config: config({ rateLimitMax: 100 }),
      logger: silentLogger,
      readiness: ready,
    })
    const headers = await request(app).get('/api/v1/health/live').expect(200)
    expect(headers.headers['x-content-type-options']).toBe('nosniff')
    expect(headers.headers['content-security-policy']).toContain("default-src 'self'")

    const invalidJson = await request(app)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)
    assertProblem(invalidJson.body, 400, 'VALIDATION_FAILED')

    const oversized = await request(app)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(1024 * 1024) }))
      .expect(413)
    assertProblem(oversized.body, 413, 'PAYLOAD_TOO_LARGE')

    const missing = await request(app).get('/api/v1/absent').expect(404)
    assertProblem(missing.body, 404, 'NOT_FOUND')

    const limited = createApp({
      config: config({ rateLimitMax: 1 }),
      logger: silentLogger,
      readiness: ready,
    })
    await request(limited).get('/api/v1/health/live').expect(200)
    const limitedResponse = await request(limited).get('/api/v1/health/live').expect(429)
    assertProblem(limitedResponse.body, 429, 'RATE_LIMITED')

    const parseProtected = createApp({
      config: config({ rateLimitMax: 1 }),
      logger: silentLogger,
      readiness: ready,
    })
    await request(parseProtected)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)
    const rejectedBeforeParsing = await request(parseProtected)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(429)
    assertProblem(rejectedBeforeParsing.body, 429, 'RATE_LIMITED')
  })

  it('never reads an import body itself and caps every other route at 1 MiB', async () => {
    const oversized = JSON.stringify({ padding: 'x'.repeat(2 * 1024 * 1024) })
    const app = createApp({
      config: config({ rateLimitMax: 100 }),
      logger: silentLogger,
      readiness: ready,
      registerRoutes(api: Express) {
        api.post('/api/v1/imports/unparsed', (req, res) => {
          res.status(200).json({ padding: (req.body as { padding?: string } | undefined)?.padding })
        })
        api.post(
          '/api/v1/imports/legacy-backup/preview',
          express.json({ limit: MAX_LEGACY_BACKUP_BYTES, strict: true }),
          (req, res) => {
            res.status(200).json({ padding: (req.body as { padding: string }).padding.length })
          },
        )
      },
    })

    const rejected = await request(app)
      .post('/api/v1/ranges')
      .set('Content-Type', 'application/json')
      .send(oversized)
      .expect(413)
    assertProblem(rejected.body, 413, 'PAYLOAD_TOO_LARGE')

    // The import prefix reaches its router with the body still unread, so only
    // that router decides what an authenticated caller may send.
    const untouched = await request(app)
      .post('/api/v1/imports/unparsed')
      .set('Content-Type', 'application/json')
      .send('{"padding":"small"}')
      .expect(200)
    expect(untouched.body).toEqual({})

    const accepted = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .set('Content-Type', 'application/json')
      .send(oversized)
      .expect(200)
    expect(accepted.body).toEqual({ padding: 2 * 1024 * 1024 })
  })

  it('conceals internal errors in production and logs no request body', async () => {
    const logger = { info: vi.fn(), error: vi.fn() } as unknown as Logger
    const app = createApp({
      config: config({ nodeEnv: 'production', frontendOrigins: ['https://app.example.com'] }),
      logger,
      readiness: ready,
      registerRoutes(api: Express) {
        api.get('/api/v1/throws', () => {
          throw new Error('database password is secret')
        })
      },
    })
    const response = await request(app).get('/api/v1/throws').expect(500)
    assertProblem(response.body, 500, 'INTERNAL_ERROR')
    expect(JSON.stringify(response.body)).not.toContain('password')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorName: 'Error' }),
      'request failed',
    )
  })

  it('redacts credential-bearing log fields', () => {
    const lines: string[] = []
    const logger = createLogger('info', { base: undefined }, {
      write: (line: string) => {
        lines.push(line)
      },
    } as never)
    logger.info(
      {
        authorization: 'Bearer top-secret',
        cookie: 'session=top-secret',
        'set-cookie': 'session=top-secret',
        body: { password: 'top-secret' },
        req: { headers: { authorization: 'top-secret', cookie: 'session=top-secret' } },
        res: { headers: { 'set-cookie': 'session=top-secret' } },
      },
      'safe',
    )
    expect(lines.join('')).not.toContain('top-secret')
  })

  it('keeps mandatory redaction when callers supply their own policy', () => {
    const lines: string[] = []
    const logger = createLogger(
      'info',
      { redact: { paths: ['customSecret'], remove: false, censor: 'visible' } },
      { write: (line: string) => lines.push(line) } as never,
    )
    logger.info(
      { authorization: 'top-secret', customSecret: 'custom-secret' },
      'redaction cannot be overridden',
    )
    expect(lines.join('')).not.toContain('top-secret')
    expect(lines.join('')).not.toContain('custom-secret')
  })

  it('logs readiness failures safely', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger
    const app = createApp({
      config: config(),
      logger,
      readiness: async () => {
        throw new Error('postgresql://username:password@secret-host')
      },
    })
    await request(app).get('/api/v1/health/ready').set('x-request-id', requestId).expect(503)
    expect(logger.warn).toHaveBeenCalledWith(
      { requestId, errorName: 'Error' },
      'readiness check failed',
    )
  })

  it('closes the owned pool once and logs pool errors without connection details', async () => {
    class TestPool extends EventEmitter {
      readonly query = vi.fn(async () => undefined)
      readonly end = vi.fn(async () => undefined)
    }
    const pool = new TestPool()
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger
    let mountedApp: Express | undefined
    const runtime = createServerRuntime(config(), logger, {
      createPool: () => pool as never,
      createHttpServer: (app) => {
        mountedApp = app
        return createServer(app)
      },
    })
    await request(mountedApp).get('/api/v1/ranges').expect(401).expect('Cache-Control', 'no-store')
    await request(mountedApp)
      .post('/api/v1/practice/sessions')
      .expect(401)
      .expect('Cache-Control', 'no-store')
    await request(mountedApp)
      .get('/api/v1/settings/training-goal')
      .expect(401)
      .expect('Cache-Control', 'no-store')
    pool.emit('error', new Error('postgresql://username:password@secret-host'))
    expect(logger.error).toHaveBeenCalledWith({ errorName: 'Error' }, 'PostgreSQL pool error')
    await Promise.all([runtime.close(), runtime.close()])
    expect(pool.end).toHaveBeenCalledOnce()
  })
})
