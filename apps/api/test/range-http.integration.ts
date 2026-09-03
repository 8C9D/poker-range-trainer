import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import request from 'supertest'

import {
  bulkRangeMutationResponseSchema,
  rangeCreateResponseSchema,
  rangeDeleteResponseSchema,
  rangeListResponseSchema,
  rangeReadResponseSchema,
  rangeRestoreResponseSchema,
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
import { PostgresRangeRepository } from '../src/ranges/repository.js'
import { createRangeRouter } from '../src/ranges/routes.js'
import { RangeService } from '../src/ranges/service.js'

const testDatabaseName = `poker_range_trainer_api_ranges_http_${randomUUID().replaceAll('-', '')}`
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

describe('HTTP range library against PostgreSQL', () => {
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
    const service = new RangeService(new PostgresRangeRepository(database))
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
        api.use('/api/v1/ranges', createRangeRouter({ service, middleware }))
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

  it('persists the authenticated range lifecycle with contract-valid responses and owner isolation', async () => {
    const owner = await register('owner')
    const other = await register('other')
    await request(app).get('/api/v1/ranges').expect(401)
    await request(app)
      .post('/api/v1/ranges')
      .set('Cookie', owner.cookie)
      .send({ name: 'CSRF denied', hands: ['AA'] })
      .expect(403)
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({
        name: '  BTN open  ',
        hands: ['AA', 'AKs', 'AKo'],
        metadata: { gameType: 'cash', tableSize: 'sixMax', position: 'btn' },
      })
      .expect(201)
    expect(rangeCreateResponseSchema.safeParse(created.body).success).toBe(true)
    expect(created.headers['cache-control']).toBe('no-store')
    const original = created.body.data

    const listed = await request(app)
      .get('/api/v1/ranges?position=btn&search=aa')
      .set('Cookie', owner.cookie)
      .expect(200)
    expect(rangeListResponseSchema.safeParse(listed.body).success).toBe(true)
    expect(listed.body.data).toMatchObject([{ id: original.id, comboCount: 22 }])
    const read = await request(app)
      .get(`/api/v1/ranges/${original.id}`)
      .set('Cookie', owner.cookie)
      .expect(200)
    expect(rangeReadResponseSchema.safeParse(read.body).success).toBe(true)
    await request(app).get(`/api/v1/ranges/${original.id}`).set('Cookie', other.cookie).expect(404)

    const updated = await request(app)
      .patch(`/api/v1/ranges/${original.id}`)
      .set(asUser(owner))
      .send({ version: original.version, name: 'BTN opening range' })
      .expect(200)
    expect(updated.body.data).toMatchObject({ version: 2, name: 'BTN opening range' })
    await request(app)
      .patch(`/api/v1/ranges/${original.id}`)
      .set(asUser(owner))
      .send({ version: original.version, name: 'stale' })
      .expect(409)

    const favorited = await request(app)
      .post(`/api/v1/ranges/${original.id}/favorite`)
      .set(asUser(owner))
      .send({ version: updated.body.data.version, favorite: true })
      .expect(200)
    const archived = await request(app)
      .post(`/api/v1/ranges/${original.id}/archive`)
      .set(asUser(owner))
      .send({ version: favorited.body.data.version, archived: true })
      .expect(200)
    expect(archived.body.data).toMatchObject({ archived: true, favorite: true, version: 4 })

    const duplicate = await request(app)
      .post(`/api/v1/ranges/${original.id}/duplicate`)
      .set(asUser(owner))
      .send({ version: archived.body.data.version })
      .expect(200)
    expect(duplicate.body.data).toMatchObject({
      name: 'BTN opening range (copy)',
      archived: false,
      favorite: false,
    })

    const deleted = await request(app)
      .delete(`/api/v1/ranges/${original.id}`)
      .set(asUser(owner))
      .send({ version: archived.body.data.version })
      .expect(200)
    expect(rangeDeleteResponseSchema.safeParse(deleted.body).success).toBe(true)
    await request(app).get(`/api/v1/ranges/${original.id}`).set('Cookie', owner.cookie).expect(404)
    const restored = await request(app)
      .post(`/api/v1/ranges/${original.id}/restore`)
      .set(asUser(owner))
      .send({ version: deleted.body.data.version })
      .expect(200)
    expect(rangeRestoreResponseSchema.safeParse(restored.body).success).toBe(true)

    const bulk = await request(app)
      .post('/api/v1/ranges/bulk')
      .set(asUser(owner))
      .send({
        action: 'favorite',
        items: [
          { id: restored.body.data.id, version: restored.body.data.version },
          { id: duplicate.body.data.id, version: duplicate.body.data.version },
        ],
      })
      .expect(200)
    expect(bulkRangeMutationResponseSchema.safeParse(bulk.body).success).toBe(true)
    expect(bulk.body.data.items.map((item: { id: string }) => item.id)).toEqual([
      original.id,
      duplicate.body.data.id,
    ])
    await request(app)
      .post(`/api/v1/ranges/${original.id}/favorite`)
      .set(asUser(other))
      .send({ version: bulk.body.data.items[0].version, favorite: false })
      .expect(404)
  })
})
