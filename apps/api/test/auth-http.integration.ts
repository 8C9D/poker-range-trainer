import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import request from 'supertest'

import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
} from '@poker-range-trainer/database'

import {
  changePasswordResponseSchema,
  deleteAccountResponseSchema,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../src/auth/cookies.js'
import { PostgresAuthRepository } from '../src/auth/repository.js'
import { createAuthRouter } from '../src/auth/routes.js'
import { loadConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'

const testDatabaseName = `poker_range_trainer_api_http_${randomUUID().replaceAll('-', '')}`
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

describe('HTTP authentication against PostgreSQL', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  const testUrl = databaseUrlFor(configuredUrl, testDatabaseName)
  const config = loadConfig({
    DATABASE_URL: testUrl,
    NODE_ENV: 'test',
    AUTH_RATE_LIMIT_MAX: '1000',
  })
  const logger = createLogger('silent')
  let testPool: Pool | undefined
  let app: ReturnType<typeof createApp>
  let databaseCreated = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    databaseCreated = true
    testPool = createPostgresPool(testUrl)
    await runMigrations(testPool)
    const repository = new PostgresAuthRepository(createDatabase(testPool), {
      now: () => new Date(),
    })
    app = createApp({
      config,
      logger,
      readiness: async () => {
        await testPool?.query('select 1')
      },
      registerRoutes(api) {
        api.use('/api/v1/auth', createAuthRouter({ config, logger, repository }))
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

  it('registers, enforces CSRF, revokes on logout, and rotates a new login session', async () => {
    const email = 'http-integration@example.test'
    const password = 'password12345'
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201)
    const firstSessionToken = cookieValue(registered.headers['set-cookie'], SESSION_COOKIE_NAME)
    const firstCsrfToken = cookieValue(registered.headers['set-cookie'], CSRF_COOKIE_NAME)
    const firstCookie = `${SESSION_COOKIE_NAME}=${firstSessionToken}; ${CSRF_COOKIE_NAME}=${firstCsrfToken}`

    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${firstSessionToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ data: { authenticated: true, user: { email } } })
      })
    await request(app).post('/api/v1/auth/logout').set('Cookie', firstCookie).expect(403)

    const beforeLogout = await testPool?.query<{
      password_hash: string
      token_hash: string
      csrf_token_hash: string
      revoked_at: Date | null
    }>(
      `select u.password_hash, s.token_hash, s.csrf_token_hash, s.revoked_at
       from users u join auth_sessions s on s.user_id = u.id where u.email = $1`,
      [email],
    )
    const initialStored = beforeLogout?.rows[0]
    if (!initialStored) throw new Error('expected registered session row')
    expect(initialStored.password_hash).toMatch(/^\$argon2id\$/)
    expect(initialStored.password_hash).not.toBe(password)
    expect(initialStored.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(initialStored.csrf_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(beforeLogout?.rows)).not.toContain(firstSessionToken)
    expect(JSON.stringify(beforeLogout?.rows)).not.toContain(firstCsrfToken)
    expect(JSON.stringify(beforeLogout?.rows)).not.toContain(password)

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', firstCookie)
      .set('x-csrf-token', firstCsrfToken)
      .expect(200)
    const revoked = await testPool?.query<{ revoked_at: Date | null }>(
      `select s.revoked_at from auth_sessions s
       join users u on u.id = s.user_id where u.email = $1 and s.token_hash = $2`,
      [email, initialStored.token_hash],
    )
    expect(revoked?.rows).toEqual([expect.objectContaining({ revoked_at: expect.any(Date) })])
    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${firstSessionToken}`)
      .expect(200)
      .expect({ data: { authenticated: false } })

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const secondSessionToken = cookieValue(login.headers['set-cookie'], SESSION_COOKIE_NAME)
    expect(secondSessionToken).not.toBe(firstSessionToken)
    const storedSessions = await testPool?.query<{
      token_hash: string
      csrf_token_hash: string
      revoked_at: Date | null
    }>(
      `select s.token_hash, s.csrf_token_hash, s.revoked_at from auth_sessions s
       join users u on u.id = s.user_id where u.email = $1 order by s.created_at`,
      [email],
    )
    expect(storedSessions?.rows).toHaveLength(2)
    expect(storedSessions?.rows.filter((session) => session.revoked_at !== null)).toHaveLength(1)
    expect(storedSessions?.rows.filter((session) => session.revoked_at === null)).toHaveLength(1)
    expect(JSON.stringify(storedSessions?.rows)).not.toContain(secondSessionToken)
    expect(JSON.stringify(storedSessions?.rows)).not.toContain(
      cookieValue(login.headers['set-cookie'], CSRF_COOKIE_NAME),
    )
  })

  interface Session {
    cookie: string
    csrfToken: string
  }

  function sessionFrom(response: { headers: Record<string, unknown> }): Session {
    const header = response.headers['set-cookie'] as string[] | undefined
    const csrfToken = cookieValue(header, CSRF_COOKIE_NAME)
    const sessionToken = cookieValue(header, SESSION_COOKIE_NAME)
    return {
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      csrfToken,
    }
  }

  const asUser = (session: Session) => ({
    Cookie: session.cookie,
    'x-csrf-token': session.csrfToken,
  })

  async function register(email: string, password: string): Promise<Session> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201)
    return sessionFrom(response)
  }

  async function login(email: string, password: string): Promise<Session> {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    return sessionFrom(response)
  }

  async function isSignedIn(session: Session): Promise<boolean> {
    const response = await request(app).get('/api/v1/auth/me').set('Cookie', session.cookie)
    return response.body.data.authenticated as boolean
  }

  it('changes a password, keeping only the session that asked', async () => {
    const email = 'change-password@example.test'
    const password = 'password12345'
    const replacement = 'replacement-pass-6789'
    const here = await register(email, password)
    const elsewhere = await login(email, password)
    const body = { currentPassword: password, newPassword: replacement }

    await request(app).post('/api/v1/auth/password').send(body).expect(401)
    await request(app)
      .post('/api/v1/auth/password')
      .set('Cookie', here.cookie)
      .send(body)
      .expect(403)
    const wrong = await request(app)
      .post('/api/v1/auth/password')
      .set(asUser(here))
      .send({ ...body, currentPassword: 'not-the-password-1' })
      .expect(422)
    expect(wrong.body.issues[0].path).toEqual(['currentPassword'])
    await request(app)
      .post('/api/v1/auth/password')
      .set(asUser(here))
      .send({ ...body, newPassword: password })
      .expect(422)
    await request(app)
      .post('/api/v1/auth/password')
      .set(asUser(here))
      .send({ ...body, newPassword: 'too-short-1' })
      .expect(422)
    expect(await isSignedIn(elsewhere)).toBe(true)

    const changed = await request(app)
      .post('/api/v1/auth/password')
      .set(asUser(here))
      .send(body)
      .expect(200)
    expect(changePasswordResponseSchema.parse(changed.body).data.otherSessionsRevoked).toBe(1)
    expect(changed.headers['cache-control']).toBe('no-store')

    expect(await isSignedIn(here)).toBe(true)
    expect(await isSignedIn(elsewhere)).toBe(false)
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(401)
    await login(email, replacement)
  })

  it('signs out everywhere, this session included', async () => {
    const email = 'sign-out-everywhere@example.test'
    const password = 'password12345'
    const here = await register(email, password)
    const elsewhere = await login(email, password)

    await request(app)
      .post('/api/v1/auth/sign-out-everywhere')
      .set('Cookie', here.cookie)
      .expect(403)
    const response = await request(app)
      .post('/api/v1/auth/sign-out-everywhere')
      .set(asUser(here))
      .expect(200)
    expect(response.body).toEqual({ data: { sessionsRevoked: 2 } })
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining(`${SESSION_COOKIE_NAME}=;`)]),
    )
    expect(await isSignedIn(here)).toBe(false)
    expect(await isSignedIn(elsewhere)).toBe(false)
    await login(email, password)
  })

  it('deletes an account only with its password, and frees the address', async () => {
    const email = 'delete-account@example.test'
    const password = 'password12345'
    const here = await register(email, password)
    const bystander = await register('bystander@example.test', password)

    await request(app)
      .post('/api/v1/auth/delete-account')
      .set('Cookie', here.cookie)
      .send({ password, confirm: true })
      .expect(403)
    await request(app)
      .post('/api/v1/auth/delete-account')
      .set(asUser(here))
      .send({ password, confirm: false })
      .expect(422)
    const wrong = await request(app)
      .post('/api/v1/auth/delete-account')
      .set(asUser(here))
      .send({ password: 'not-the-password-1', confirm: true })
      .expect(422)
    expect(wrong.body.issues[0].path).toEqual(['password'])
    expect(await isSignedIn(here)).toBe(true)

    const deleted = await request(app)
      .post('/api/v1/auth/delete-account')
      .set(asUser(here))
      .send({ password, confirm: true })
      .expect(200)
    expect(deleteAccountResponseSchema.parse(deleted.body).data.success).toBe(true)

    expect(await isSignedIn(here)).toBe(false)
    expect(await isSignedIn(bystander)).toBe(true)
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(401)
    await register(email, password)
  })
})
