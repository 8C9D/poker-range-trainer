import { and, eq, gt, isNotNull, isNull, lt, ne, or } from 'drizzle-orm'

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
  /**
   * The hash the caller verified. The session is refused if the account no longer
   * has it, so a sign-in racing a password change cannot outlive that change.
   */
  verifiedPasswordHash?: string
}

export interface ReplacePasswordInput {
  userId: string
  passwordHash: string
  /** The session making the change, which alone stays signed in. */
  keepSessionId: string
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
  findPasswordHash(userId: string): Promise<string | undefined>
  /** `undefined` when `verifiedPasswordHash` no longer matches the account. */
  createAdditionalSession(
    input: CreateAdditionalSessionInput,
  ): Promise<AuthSessionMetadata | undefined>
  resolveActiveSession(tokenHash: string): Promise<ResolvedAuthSession | undefined>
  revokeSession(userId: string, sessionId: string): Promise<boolean>
  touchSessionLastSeen(input: TouchSessionInput): Promise<boolean>
  /** Swaps the password and revokes every other session, as one change; returns how many. */
  replacePassword(input: ReplacePasswordInput): Promise<number>
  /** Revokes every live session the user has; returns how many. */
  revokeAllSessions(userId: string): Promise<number>
  /** Deletes the account and, by cascade, everything it owns. */
  deleteUser(userId: string): Promise<boolean>
  /** Deletes sessions that expired or were revoked before `before`; returns how many. */
  purgeDeadSessions(before: Date): Promise<number>
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

  async findPasswordHash(userId: string): Promise<string | undefined> {
    const [row] = await this.database
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row?.passwordHash
  }

  async createAdditionalSession(
    input: CreateAdditionalSessionInput,
  ): Promise<AuthSessionMetadata | undefined> {
    const now = this.clock.now()
    this.assertNewSession(input, now)
    const { verifiedPasswordHash } = input
    if (verifiedPasswordHash === undefined) {
      return this.insertSession(this.database, input.userId, input, now)
    }
    return this.database.transaction(async (transaction) => {
      // The share lock waits out a password change in progress, so this reads its
      // result: either that change revokes this session, or this one is refused.
      const [owner] = await transaction
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('share')
      if (owner?.passwordHash !== verifiedPasswordHash) return undefined
      return this.insertSession(transaction, input.userId, input, now)
    })
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

  async replacePassword(input: ReplacePasswordInput): Promise<number> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ passwordHash: input.passwordHash, updatedAt: now })
        .where(eq(users.id, input.userId))
      const revoked = await transaction
        .update(authSessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(authSessions.userId, input.userId),
            ne(authSessions.id, input.keepSessionId),
            isNull(authSessions.revokedAt),
          ),
        )
        .returning({ id: authSessions.id })
      return revoked.length
    })
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const rows = await this.database
      .update(authSessions)
      .set({ revokedAt: this.clock.now() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
      .returning({ id: authSessions.id })
    return rows.length
  }

  async deleteUser(userId: string): Promise<boolean> {
    const rows = await this.database
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id })
    return rows.length === 1
  }

  async purgeDeadSessions(before: Date): Promise<number> {
    const rows = await this.database
      .delete(authSessions)
      .where(
        or(
          lt(authSessions.expiresAt, before),
          and(isNotNull(authSessions.revokedAt), lt(authSessions.revokedAt, before)),
        ),
      )
      .returning({ id: authSessions.id })
    return rows.length
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
    database: Pick<Database, 'insert'> | Parameters<Parameters<Database['transaction']>[0]>[0],
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
