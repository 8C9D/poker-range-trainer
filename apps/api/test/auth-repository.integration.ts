import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'

import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
} from '@poker-range-trainer/database'

import { DUMMY_PASSWORD_HASH } from '../src/auth/password.js'
import {
  EmailAlreadyExistsError,
  PostgresAuthRepository,
  type SessionHashes,
} from '../src/auth/repository.js'
import { generateAuthTokens, hashOpaqueToken } from '../src/auth/tokens.js'

const testDatabaseName = `poker_range_trainer_api_auth_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function hashedSession(expiresAt: Date): SessionHashes & {
  rawSessionToken: string
  rawCsrfToken: string
} {
  const { sessionToken, csrfToken } = generateAuthTokens()
  return {
    rawSessionToken: sessionToken,
    rawCsrfToken: csrfToken,
    tokenHash: hashOpaqueToken(sessionToken),
    csrfTokenHash: hashOpaqueToken(csrfToken),
    expiresAt,
  }
}

describe('PostgreSQL auth repository', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  let testPool: Pool
  let now = new Date('2026-01-02T03:04:05.000Z')
  let repository: PostgresAuthRepository
  let databaseCreated = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    databaseCreated = true
    testPool = createPostgresPool(databaseUrlFor(configuredUrl, testDatabaseName))
    await runMigrations(testPool)
    repository = new PostgresAuthRepository(createDatabase(testPool), { now: () => new Date(now) })
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

  async function createUser(email: string, expiresAt = new Date(now.getTime() + 60 * 60 * 1000)) {
    const session = hashedSession(expiresAt)
    const created = await repository.createUserWithInitialSession({
      email,
      passwordHash: DUMMY_PASSWORD_HASH,
      session,
    })
    return { ...created, sessionInput: session }
  }

  it('normalizes email, creates user and initial session atomically, and returns a public user', async () => {
    const created = await createUser('  Mixed.Case@Example.test  ')
    expect(created.user).toMatchObject({ email: 'mixed.case@example.test' })
    expect(created.user).not.toHaveProperty('passwordHash')
    expect(created.session).not.toHaveProperty('tokenHash')
    expect(created.session).not.toHaveProperty('csrfTokenHash')

    const stored = await testPool.query<{ token_hash: string; csrf_token_hash: string }>(
      'select token_hash, csrf_token_hash from auth_sessions where id = $1',
      [created.session.id],
    )
    expect(stored.rows).toEqual([
      {
        token_hash: created.sessionInput.tokenHash,
        csrf_token_hash: created.sessionInput.csrfTokenHash,
      },
    ])
    expect(JSON.stringify(stored.rows)).not.toContain(created.sessionInput.rawSessionToken)
  })

  it('maps duplicate case-normalized email to a typed conflict without driver details', async () => {
    await createUser('duplicate@example.test')
    await expect(createUser(' DUPLICATE@example.test ')).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    )
  })

  it('looks up normalized email credentials only through the internal shape', async () => {
    const created = await createUser('credentials@example.test')
    const credentials = await repository.findCredentialsByEmail(' CREDENTIALS@EXAMPLE.TEST ')
    expect(credentials).toMatchObject({
      id: created.user.id,
      email: 'credentials@example.test',
      passwordHash: DUMMY_PASSWORD_HASH,
    })
    expect(credentials).not.toHaveProperty('tokenHash')
    expect(credentials).not.toHaveProperty('csrfTokenHash')
  })

  it('rolls back the user when initial-session persistence fails', async () => {
    const existing = await createUser('existing-token@example.test')
    const duplicateToken = hashedSession(new Date(now.getTime() + 60 * 60 * 1000))
    duplicateToken.tokenHash = existing.sessionInput.tokenHash
    await expect(
      repository.createUserWithInitialSession({
        email: 'rolled-back@example.test',
        passwordHash: DUMMY_PASSWORD_HASH,
        session: duplicateToken,
      }),
    ).rejects.toBeDefined()
    await expect(
      repository.findCredentialsByEmail('rolled-back@example.test'),
    ).resolves.toBeUndefined()
  })

  it('resolves active sessions by stored hash only with internal CSRF data', async () => {
    const created = await createUser('lookup@example.test')
    const resolved = await repository.resolveActiveSession(created.sessionInput.tokenHash)
    expect(resolved).toMatchObject({
      user: { id: created.user.id, email: 'lookup@example.test' },
      session: { id: created.session.id, userId: created.user.id },
    })
    expect(resolved?.user).not.toHaveProperty('passwordHash')
    expect(resolved?.session).toMatchObject({ csrfTokenHash: created.sessionInput.csrfTokenHash })
    expect(resolved?.session).not.toHaveProperty('tokenHash')
    expect(JSON.stringify(resolved)).not.toContain(created.sessionInput.rawSessionToken)
    expect(JSON.stringify(resolved)).not.toContain(created.sessionInput.rawCsrfToken)
    await expect(
      repository.resolveActiveSession(created.sessionInput.rawSessionToken),
    ).resolves.toBeUndefined()
    await expect(repository.resolveActiveSession('not-a-hash')).resolves.toBeUndefined()
  })

  it('does not resolve expired or revoked sessions and revocation is idempotent', async () => {
    const expiring = await createUser('expiry@example.test')
    now = new Date(expiring.session.expiresAt.getTime() + 1)
    await expect(
      repository.resolveActiveSession(expiring.sessionInput.tokenHash),
    ).resolves.toBeUndefined()

    now = new Date('2026-01-03T03:04:05.000Z')
    const active = await createUser('revoke@example.test')
    await expect(repository.revokeSession(active.user.id, active.session.id)).resolves.toBe(true)
    await expect(repository.revokeSession(active.user.id, active.session.id)).resolves.toBe(false)
    await expect(
      repository.resolveActiveSession(active.sessionInput.tokenHash),
    ).resolves.toBeUndefined()
  })

  it('creates additional sessions and scopes mutations to both owner and session', async () => {
    now = new Date('2026-01-04T03:04:05.000Z')
    const owner = await createUser('owner@example.test')
    const other = await createUser('other@example.test')
    const additionalInput = hashedSession(new Date(now.getTime() + 60 * 60 * 1000))
    const additional = await repository.createAdditionalSession({
      userId: owner.user.id,
      ...additionalInput,
    })
    await expect(repository.resolveActiveSession(additionalInput.tokenHash)).resolves.toMatchObject(
      {
        user: { id: owner.user.id },
        session: { id: additional.id },
      },
    )

    await expect(repository.revokeSession(other.user.id, additional.id)).resolves.toBe(false)
    await expect(
      repository.touchSessionLastSeen({
        userId: other.user.id,
        sessionId: additional.id,
        lastSeenBefore: new Date(now.getTime() + 1),
      }),
    ).resolves.toBe(false)
    await expect(
      repository.touchSessionLastSeen({
        userId: owner.user.id,
        sessionId: additional.id,
        lastSeenBefore: new Date(now.getTime() - 1),
      }),
    ).resolves.toBe(false)

    now = new Date(now.getTime() + 10 * 60 * 1000)
    await expect(
      repository.touchSessionLastSeen({
        userId: owner.user.id,
        sessionId: additional.id,
        lastSeenBefore: new Date(now.getTime() - 1),
      }),
    ).resolves.toBe(true)
  })
})
