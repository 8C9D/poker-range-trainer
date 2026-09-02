import type { Logger } from 'pino'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  meResponseSchema,
  problemDetailsSchema,
  registerResponseSchema,
} from '@poker-range-trainer/contracts'

import { createApp } from '../src/app.js'
import { CSRF_COOKIE_NAME, parseCookies, SESSION_COOKIE_NAME } from '../src/auth/cookies.js'
import { createAuthMiddleware } from '../src/auth/middleware.js'
import {
  type AuthRepository,
  type AuthSessionMetadata,
  type CreateAdditionalSessionInput,
  type CreateUserWithInitialSessionInput,
  type InternalCredentials,
  type PublicAuthUser,
  type ResolvedAuthSession,
} from '../src/auth/repository.js'
import { createAuthRouter } from '../src/auth/routes.js'
import { AuthService } from '../src/auth/service.js'
import { generateAuthTokens, hashOpaqueToken } from '../src/auth/tokens.js'
import { loadConfig, type ApiConfig } from '../src/config.js'
import { createLogger } from '../src/logger.js'

const now = new Date('2026-01-02T03:04:05.000Z')
const user: PublicAuthUser = {
  id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
  email: 'person@example.test',
  createdAt: now,
  updatedAt: now,
}

function config(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    ...loadConfig({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/poker',
      NODE_ENV: 'test',
    }),
    rateLimitMax: 1_000,
    ...overrides,
  }
}

function metadata(id: string, userId = user.id): AuthSessionMetadata {
  return {
    id,
    userId,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
  }
}

class FakeRepository implements AuthRepository {
  readonly credentials = new Map<string, InternalCredentials>()
  readonly sessions = new Map<string, ResolvedAuthSession>()
  readonly createAdditionalSession = vi.fn(async (input: CreateAdditionalSessionInput) => {
    const session = metadata(
      `00000000-0000-4000-8000-${String(this.sessions.size + 1).padStart(12, '0')}`,
      input.userId,
    )
    const found = [...this.credentials.values()].find((candidate) => candidate.id === input.userId)
    if (!found) throw new Error('missing user')
    this.sessions.set(input.tokenHash, {
      user: found,
      session: { ...session, csrfTokenHash: input.csrfTokenHash },
    })
    return session
  })
  readonly touchSessionLastSeen = vi.fn(async () => true)
  readonly revokeSession = vi.fn(async (userId: string, sessionId: string) => {
    for (const [hash, resolved] of this.sessions) {
      if (resolved.user.id === userId && resolved.session.id === sessionId) {
        this.sessions.delete(hash)
        return true
      }
    }
    return false
  })

  readonly initialSessionInputs: CreateUserWithInitialSessionInput[] = []
  readonly resolveActiveSession = vi.fn(async (tokenHash: string) => this.sessions.get(tokenHash))

  async createUserWithInitialSession(input: CreateUserWithInitialSessionInput) {
    this.initialSessionInputs.push(input)
    const email = input.email.trim().toLowerCase()
    if (this.credentials.has(email)) {
      const { EmailAlreadyExistsError } = await import('../src/auth/repository.js')
      throw new EmailAlreadyExistsError()
    }
    const created: InternalCredentials = {
      ...user,
      id: crypto.randomUUID(),
      email,
      passwordHash: input.passwordHash,
    }
    this.credentials.set(email, created)
    const session = metadata(
      `10000000-0000-4000-8000-${String(this.sessions.size + 1).padStart(12, '0')}`,
      created.id,
    )
    this.sessions.set(input.session.tokenHash, {
      user: created,
      session: { ...session, csrfTokenHash: input.session.csrfTokenHash },
    })
    return { user: created, session }
  }

  async findCredentialsByEmail(email: string) {
    return this.credentials.get(email.trim().toLowerCase())
  }
}

function createAuthTestApp(
  repository = new FakeRepository(),
  options: {
    apiConfig?: Partial<ApiConfig>
    verifier?: (password: string, passwordHash: string | undefined) => Promise<boolean>
    logger?: Logger
    protectedRoute?: boolean
    middlewareNow?: Date
  } = {},
) {
  const apiConfig = config(options.apiConfig)
  const verifier = options.verifier ?? vi.fn(async () => true)
  const service = new AuthService(repository, apiConfig, {
    clock: { now: () => now },
    hashPassword: async () => '$argon2id$test-password-hash',
    verifyPasswordOrDummy: verifier,
  })
  const logger = options.logger ?? createLogger('silent')
  const middleware = createAuthMiddleware({
    repository,
    config: apiConfig,
    logger,
    clock: { now: () => options.middlewareNow ?? now },
  })
  return {
    app: createApp({
      config: apiConfig,
      logger,
      readiness: async () => undefined,
      registerRoutes(api) {
        api.use(
          '/api/v1/auth',
          createAuthRouter({ config: apiConfig, logger, repository, service, middleware }),
        )
        if (options.protectedRoute) {
          api.get('/api/v1/protected', middleware.required, (_request, response) => {
            response.status(200).json({ data: { protected: true } })
          })
        }
      },
    }),
    repository,
    verifier,
  }
}

function cookieValue(header: string[] | undefined, name: string): string {
  const cookie = header?.find((value) => value.startsWith(`${name}=`))
  if (!cookie) throw new Error(`missing ${name} cookie`)
  return cookie.split(';', 1)[0]?.slice(name.length + 1) ?? ''
}

describe('HTTP authentication and CSRF', () => {
  it('parses the fixed URL-safe token shape without decoding or altering it', () => {
    const { sessionToken, csrfToken } = generateAuthTokens()
    const cookies = parseCookies({
      headers: {
        cookie: `ignored; ${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}; ${SESSION_COOKIE_NAME}=later`,
      },
    })
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(sessionToken)
    expect(cookies.get(CSRF_COOKIE_NAME)).toBe(csrfToken)
  })

  it('validates request bodies, rejects over-posting, and emits public contract-valid data', async () => {
    const { app, repository } = createAuthTestApp()
    const invalid = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bad' })
      .expect(422)
    expect(problemDetailsSchema.safeParse(invalid.body).success).toBe(true)
    expect(invalid.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['password'] })]),
    )
    expect(invalid.headers['cache-control']).toBe('no-store')

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'person@example.test', password: 'password12345', admin: true })
      .expect(422)

    const created = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: '  Person@Example.test ', password: 'password12345' })
      .expect(201)
    expect(registerResponseSchema.safeParse(created.body).success).toBe(true)
    expect(created.body.data.user).toMatchObject({ email: 'person@example.test' })
    expect(created.body.data.user).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(created.body)).not.toContain('prt_')
    expect(repository.initialSessionInputs).toEqual([
      expect.objectContaining({
        email: 'person@example.test',
        passwordHash: '$argon2id$test-password-hash',
        session: expect.objectContaining({
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          csrfTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      }),
    ])
    const stored = repository.initialSessionInputs[0]
    expect(stored?.session.tokenHash).not.toBe(
      cookieValue(created.headers['set-cookie'], SESSION_COOKIE_NAME),
    )
    expect(stored?.session.csrfTokenHash).not.toBe(
      cookieValue(created.headers['set-cookie'], CSRF_COOKIE_NAME),
    )
  })

  it('uses host-only scoped session and CSRF cookies, with Secure only in production', async () => {
    const { app } = createAuthTestApp()
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'flags@example.test', password: 'password12345' })
      .expect(201)
    const cookies = response.headers['set-cookie'] as string[]
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^prt_session=[A-Za-z0-9_-]{43}; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
        ),
        expect.stringMatching(
          /^prt_csrf=[A-Za-z0-9_-]{43}; Max-Age=604800; Path=\/; Expires=.+; SameSite=Lax$/,
        ),
      ]),
    )
    expect(cookies.join(';')).not.toContain('Domain=')

    const production = createAuthTestApp(undefined, {
      apiConfig: { nodeEnv: 'production', frontendOrigins: ['https://app.example.test'] },
    })
    const secure = await request(production.app)
      .post('/api/v1/auth/register')
      .send({ email: 'secure@example.test', password: 'password12345' })
      .expect(201)
    expect(
      (secure.headers['set-cookie'] as string[]).every((cookie) => cookie.includes('; Secure')),
    ).toBe(true)
  })

  it('normalizes duplicate emails and gives missing and wrong login attempts the identical response', async () => {
    const repository = new FakeRepository()
    repository.credentials.set(user.email, { ...user, passwordHash: '$argon2id$stored' })
    const verifier = vi
      .fn<(password: string, hash: string | undefined) => Promise<boolean>>()
      .mockImplementation(async (_password, hash) => hash === '$argon2id$stored' && false)
    const { app } = createAuthTestApp(repository, { verifier })
    const missing = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.test', password: 'password12345' })
      .expect(401)
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password12345' })
      .expect(401)
    expect({ ...missing.body, requestId: undefined }).toEqual({
      ...wrong.body,
      requestId: undefined,
    })
    expect(verifier).toHaveBeenCalledTimes(2)
    expect(verifier.mock.calls.map((call) => call[1])).toEqual([undefined, '$argon2id$stored'])

    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'Duplicate@Example.test', password: 'password12345' })
      .expect(201)
    expect(register.headers['set-cookie']).toBeDefined()
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: ' duplicate@example.test ', password: 'password12345' })
      .expect(409)
    expect(duplicate.body).toMatchObject({ code: 'CONFLICT' })
  })

  it('rotates sessions on login and clears malformed, expired, and revoked sessions', async () => {
    const repository = new FakeRepository()
    repository.credentials.set(user.email, { ...user, passwordHash: '$argon2id$stored' })
    const { app } = createAuthTestApp(repository)
    const absent = await request(app).get('/api/v1/auth/me').expect(200)
    expect(absent.body).toEqual({ data: { authenticated: false } })

    const malformed = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=bad`)
      .expect(200)
    expect(malformed.headers['set-cookie'].join(';')).toContain(`${SESSION_COOKIE_NAME}=;`)

    const first = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password12345' })
      .expect(200)
    const second = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password12345' })
      .expect(200)
    expect(cookieValue(first.headers['set-cookie'], SESSION_COOKIE_NAME)).not.toBe(
      cookieValue(second.headers['set-cookie'], SESSION_COOKIE_NAME),
    )
    const valid = await request(app)
      .get('/api/v1/auth/me')
      .set(
        'Cookie',
        `${SESSION_COOKIE_NAME}=${cookieValue(second.headers['set-cookie'], SESSION_COOKIE_NAME)}`,
      )
      .expect(200)
    expect(meResponseSchema.safeParse(valid.body).success).toBe(true)
    expect(valid.body.data.authenticated).toBe(true)

    const expiredToken = generateAuthTokens().sessionToken
    repository.resolveActiveSession.mockResolvedValueOnce(undefined)
    const expired = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${expiredToken}`)
      .expect(200)
    expect(expired.body).toEqual({ data: { authenticated: false } })
    expect(expired.headers['set-cookie'].join(';')).toContain(`${SESSION_COOKIE_NAME}=;`)

    const revokedToken = generateAuthTokens().sessionToken
    repository.resolveActiveSession.mockResolvedValueOnce(undefined)
    const revoked = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${revokedToken}`)
      .expect(200)
    expect(revoked.body).toEqual({ data: { authenticated: false } })
    expect(revoked.headers['set-cookie'].join(';')).toContain(`${CSRF_COOKIE_NAME}=;`)
  })

  it('requires matching cookie/header/stored CSRF hash for logout and revokes then clears cookies', async () => {
    const repository = new FakeRepository()
    repository.credentials.set(user.email, { ...user, passwordHash: '$argon2id$stored' })
    const { app } = createAuthTestApp(repository)
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password12345' })
      .expect(200)
    const session = cookieValue(login.headers['set-cookie'], SESSION_COOKIE_NAME)
    const csrf = cookieValue(login.headers['set-cookie'], CSRF_COOKIE_NAME)
    const cookie = `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${csrf}`

    await request(app)
      .post('/api/v1/auth/logout')
      .send({ unexpected: true })
      .expect(422)
      .expect((response) => {
        expect(response.headers['cache-control']).toBe('no-store')
      })
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(403)
    await request(app)
      .post('/api/v1/auth/logout')
      .set(
        'Cookie',
        `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${generateAuthTokens().csrfToken}`,
      )
      .set('x-csrf-token', csrf)
      .expect(403)
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', generateAuthTokens().csrfToken)
      .expect(403)

    const resolved = repository.sessions.get(hashOpaqueToken(session))
    if (!resolved) throw new Error('expected test session')
    resolved.session.csrfTokenHash = hashOpaqueToken(generateAuthTokens().csrfToken)
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf)
      .expect(403)
    resolved.session.csrfTokenHash = hashOpaqueToken(csrf)

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf)
      .expect(200)
    expect(logout.body).toEqual({ data: { success: true } })
    expect(repository.revokeSession).toHaveBeenCalledOnce()
    expect(logout.headers['set-cookie'].join(';')).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(logout.headers['set-cookie'].join(';')).toContain(`${CSRF_COOKIE_NAME}=;`)
    const repeatedLogout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200)
    expect(repeatedLogout.body).toEqual({ data: { success: true } })
    expect(repository.revokeSession).toHaveBeenCalledOnce()
    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect({ data: { authenticated: false } })
  })

  it('returns 401 from required middleware and routes lookup failures through the central 500 handler', async () => {
    const repository = new FakeRepository()
    const { app } = createAuthTestApp(repository, { protectedRoute: true })
    const missing = await request(app).get('/api/v1/protected').expect(401)
    expect(missing.body).toMatchObject({ code: 'UNAUTHENTICATED' })

    repository.resolveActiveSession.mockRejectedValueOnce(new Error('database connection failed'))
    const lookupFailure = await request(app)
      .get('/api/v1/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${generateAuthTokens().sessionToken}`)
      .expect(500)
    expect(lookupFailure.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(lookupFailure.body)).not.toContain('database connection failed')
  })

  it('uses a dedicated auth limiter contract and lets touch failures preserve valid authentication', async () => {
    const repository = new FakeRepository()
    repository.credentials.set(user.email, { ...user, passwordHash: '$argon2id$stored' })
    const logger = createLogger('silent')
    const warn = vi.spyOn(logger, 'warn')
    const limited = createAuthTestApp(repository, { apiConfig: { authRateLimitMax: 1 }, logger })
    await request(limited.app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.test', password: 'password12345' })
      .expect(401)
    const limitedResponse = await request(limited.app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.test', password: 'password12345' })
      .expect(429)
    expect(problemDetailsSchema.safeParse(limitedResponse.body).success).toBe(true)

    const tokens = generateAuthTokens()
    const session = metadata('20000000-0000-4000-8000-000000000001')
    repository.sessions.set(hashOpaqueToken(tokens.sessionToken), {
      user,
      session: {
        ...session,
        csrfTokenHash: hashOpaqueToken(tokens.csrfToken),
        lastSeenAt: new Date(0),
      },
    })
    repository.touchSessionLastSeen.mockRejectedValueOnce(new Error('token-do-not-log'))
    const healthy = await request(
      createAuthTestApp(repository, {
        logger,
        middlewareNow: new Date(now.getTime() + 16 * 60 * 1000),
      }).app,
    )
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${tokens.sessionToken}`)
      .expect(200)
    expect(healthy.body.data.authenticated).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ errorName: 'Error' }),
      'auth session touch failed',
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token-do-not-log')
  })

  it('touches only stale sessions and does not make touch failures unauthenticate a user', async () => {
    const repository = new FakeRepository()
    const tokens = generateAuthTokens()
    repository.sessions.set(hashOpaqueToken(tokens.sessionToken), {
      user,
      session: {
        ...metadata('30000000-0000-4000-8000-000000000001'),
        csrfTokenHash: hashOpaqueToken(tokens.csrfToken),
        lastSeenAt: now,
      },
    })
    const current = await request(createAuthTestApp(repository).app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${tokens.sessionToken}`)
      .expect(200)
    expect(current.body.data.authenticated).toBe(true)
    expect(repository.touchSessionLastSeen).not.toHaveBeenCalled()

    const resolved = repository.sessions.get(hashOpaqueToken(tokens.sessionToken))
    if (!resolved) throw new Error('expected test session')
    resolved.session.lastSeenAt = new Date(0)
    await request(createAuthTestApp(repository).app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${tokens.sessionToken}`)
      .expect(200)
    expect(repository.touchSessionLastSeen).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        sessionId: resolved.session.id,
        lastSeenBefore: new Date(now.getTime() - 15 * 60 * 1000),
      }),
    )
  })
})
