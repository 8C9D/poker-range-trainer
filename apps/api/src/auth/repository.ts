import { and, eq, gt, isNull, lt } from 'drizzle-orm'

import type { Database } from '@poker-range-trainer/database'
import { authSessions, users } from '@poker-range-trainer/database'

const sha256Hex = /^[0-9a-f]{64}$/

export interface Clock {
  now(): Date
}

export interface PublicAuthUser {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface InternalCredentials extends PublicAuthUser {
  passwordHash: string
}

export interface AuthSessionMetadata {
  id: string
  userId: string
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
  lastSeenAt: Date
}

/** Internal-only session data needed to validate the separate CSRF capability. */
export interface InternalResolvedSession extends AuthSessionMetadata {
  csrfTokenHash: string
}

export interface ResolvedAuthSession {
  user: PublicAuthUser
  session: InternalResolvedSession
}

export interface SessionHashes {
  tokenHash: string
  csrfTokenHash: string
  expiresAt: Date
}

export interface CreateUserWithInitialSessionInput {
  email: string
  passwordHash: string
  session: SessionHashes
}

export interface CreateAdditionalSessionInput extends SessionHashes {
  userId: string
}

export interface TouchSessionInput {
  userId: string
  sessionId: string
  /** Do not write if this session was seen at or after this point. */
  lastSeenBefore: Date
}

export interface AuthRepository {
  createUserWithInitialSession(input: CreateUserWithInitialSessionInput): Promise<{
    user: PublicAuthUser
    session: AuthSessionMetadata
  }>
  findCredentialsByEmail(email: string): Promise<InternalCredentials | undefined>
  createAdditionalSession(input: CreateAdditionalSessionInput): Promise<AuthSessionMetadata>
  resolveActiveSession(tokenHash: string): Promise<ResolvedAuthSession | undefined>
  revokeSession(userId: string, sessionId: string): Promise<boolean>
  touchSessionLastSeen(input: TouchSessionInput): Promise<boolean>
}

/** A safe, typed conflict that can become a public duplicate-email response upstream. */
export class EmailAlreadyExistsError extends Error {
  readonly code = 'EMAIL_ALREADY_EXISTS'

  constructor() {
    super('An account with that email already exists.')
    this.name = 'EmailAlreadyExistsError'
  }
}

export class AuthRepositoryInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthRepositoryInputError'
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function validHash(hash: string): boolean {
  return sha256Hex.test(hash)
}

function publicUser(row: {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}): PublicAuthUser {
  return { id: row.id, email: row.email, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

function metadata(row: {
  id: string
  userId: string
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
  lastSeenAt: Date
}): AuthSessionMetadata {
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  }
}

function isEmailUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown }
  if (candidate.code === '23505' && candidate.constraint === 'users_email_lower_unique') return true
  return isEmailUniqueViolation(candidate.cause)
}

/** PostgreSQL-backed auth persistence. All time comes from the supplied clock. */
export class PostgresAuthRepository implements AuthRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock,
  ) {}

  async createUserWithInitialSession(
    input: CreateUserWithInitialSessionInput,
  ): Promise<{ user: PublicAuthUser; session: AuthSessionMetadata }> {
    const now = this.clock.now()
    const email = normalizeEmail(input.email)
    this.assertNewSession(input.session, now)

    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            email,
            passwordHash: input.passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
        if (!user) throw new Error('User insert did not return a row.')
        const session = await this.insertSession(transaction, user.id, input.session, now)
        return { user: publicUser(user), session }
      })
    } catch (error) {
      if (isEmailUniqueViolation(error)) throw new EmailAlreadyExistsError()
      throw error
    }
  }

  async findCredentialsByEmail(email: string): Promise<InternalCredentials | undefined> {
    const normalizedEmail = normalizeEmail(email)
    const [row] = await this.database
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)
    if (!row) return undefined
    return { ...publicUser(row), passwordHash: row.passwordHash }
  }

  async createAdditionalSession(input: CreateAdditionalSessionInput): Promise<AuthSessionMetadata> {
    const now = this.clock.now()
    this.assertNewSession(input, now)
    return this.insertSession(this.database, input.userId, input, now)
  }

  async resolveActiveSession(tokenHash: string): Promise<ResolvedAuthSession | undefined> {
    if (!validHash(tokenHash)) return undefined
    const now = this.clock.now()
    const [row] = await this.database
      .select({
        userId: users.id,
        email: users.email,
        userCreatedAt: users.createdAt,
        userUpdatedAt: users.updatedAt,
        sessionId: authSessions.id,
        expiresAt: authSessions.expiresAt,
        revokedAt: authSessions.revokedAt,
        csrfTokenHash: authSessions.csrfTokenHash,
        sessionCreatedAt: authSessions.createdAt,
        lastSeenAt: authSessions.lastSeenAt,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          gt(authSessions.expiresAt, now),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1)
    if (!row) return undefined
    return {
      user: {
        id: row.userId,
        email: row.email,
        createdAt: row.userCreatedAt,
        updatedAt: row.userUpdatedAt,
      },
      session: {
        id: row.sessionId,
        userId: row.userId,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        csrfTokenHash: row.csrfTokenHash,
        createdAt: row.sessionCreatedAt,
        lastSeenAt: row.lastSeenAt,
      },
    }
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const now = this.clock.now()
    const rows = await this.database
      .update(authSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({ id: authSessions.id })
    return rows.length === 1
  }

  async touchSessionLastSeen(input: TouchSessionInput): Promise<boolean> {
    const now = this.clock.now()
    if (input.lastSeenBefore >= now) return false
    const rows = await this.database
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(authSessions.id, input.sessionId),
          eq(authSessions.userId, input.userId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now),
          lt(authSessions.lastSeenAt, input.lastSeenBefore),
        ),
      )
      .returning({ id: authSessions.id })
    return rows.length === 1
  }

  private assertNewSession(session: SessionHashes, now: Date): void {
    if (!validHash(session.tokenHash) || !validHash(session.csrfTokenHash)) {
      throw new AuthRepositoryInputError('Session hashes must be SHA-256 lowercase hex strings.')
    }
    if (session.tokenHash === session.csrfTokenHash) {
      throw new AuthRepositoryInputError('Session and CSRF token hashes must differ.')
    }
    if (session.expiresAt <= now) {
      throw new AuthRepositoryInputError('Session expiry must be in the future.')
    }
  }

  private async insertSession(
    database: Pick<Database, 'insert'>,
    userId: string,
    session: SessionHashes,
    now: Date,
  ): Promise<AuthSessionMetadata> {
    const [row] = await database
      .insert(authSessions)
      .values({
        userId,
        tokenHash: session.tokenHash,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: session.expiresAt,
        createdAt: now,
        lastSeenAt: now,
      })
      .returning()
    if (!row) throw new Error('Session insert did not return a row.')
    return metadata(row)
  }
}
