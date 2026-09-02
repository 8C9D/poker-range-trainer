import {
  type AuthenticatedUser,
  loginResponseSchema,
  registerResponseSchema,
} from '@poker-range-trainer/contracts'

import type { ApiConfig } from '../config.js'
import { hashPassword, verifyPasswordOrDummy } from './password.js'
import {
  EmailAlreadyExistsError,
  type AuthRepository,
  type Clock,
  type PublicAuthUser,
} from './repository.js'
import { generateAuthTokens, hashOpaqueToken, type AuthTokens } from './tokens.js'

export interface AuthServiceDependencies {
  clock?: Clock
  hashPassword?: (password: string) => Promise<string>
  verifyPasswordOrDummy?: (password: string, passwordHash: string | undefined) => Promise<boolean>
  generateTokens?: () => AuthTokens
}

export class InvalidLoginError extends Error {
  constructor() {
    super('Invalid email or password.')
    this.name = 'InvalidLoginError'
  }
}

export interface AuthSessionResult {
  user: AuthenticatedUser
  tokens: AuthTokens
}

function publicUser(user: PublicAuthUser): AuthenticatedUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() }
}

/** Authentication orchestration: persistence only ever receives capability hashes. */
export class AuthService {
  private readonly clock: Clock
  private readonly hash: (password: string) => Promise<string>
  private readonly verify: (password: string, passwordHash: string | undefined) => Promise<boolean>
  private readonly generateTokens: () => AuthTokens

  constructor(
    private readonly repository: AuthRepository,
    private readonly config: Pick<ApiConfig, 'sessionTtlSeconds'>,
    dependencies: AuthServiceDependencies = {},
  ) {
    this.clock = dependencies.clock ?? { now: () => new Date() }
    this.hash = dependencies.hashPassword ?? hashPassword
    this.verify = dependencies.verifyPasswordOrDummy ?? verifyPasswordOrDummy
    this.generateTokens = dependencies.generateTokens ?? generateAuthTokens
  }

  async register(input: { email: string; password: string }): Promise<AuthSessionResult> {
    const passwordHash = await this.hash(input.password)
    const tokens = this.generateTokens()
    const created = await this.repository.createUserWithInitialSession({
      email: input.email,
      passwordHash,
      session: this.sessionHashes(tokens),
    })
    const result = { user: publicUser(created.user), tokens }
    // Keep the controller response coupled to the published contract.
    registerResponseSchema.parse({ data: { user: result.user } })
    return result
  }

  async login(input: { email: string; password: string }): Promise<AuthSessionResult> {
    const credentials = await this.repository.findCredentialsByEmail(input.email)
    // Deliberately exactly one expensive verification for either branch.
    const verified = await this.verify(input.password, credentials?.passwordHash)
    if (!credentials || !verified) throw new InvalidLoginError()

    const tokens = this.generateTokens()
    await this.repository.createAdditionalSession({
      userId: credentials.id,
      ...this.sessionHashes(tokens),
    })
    const result = { user: publicUser(credentials), tokens }
    loginResponseSchema.parse({ data: { user: result.user } })
    return result
  }

  private sessionHashes(tokens: AuthTokens) {
    const now = this.clock.now()
    return {
      tokenHash: hashOpaqueToken(tokens.sessionToken),
      csrfTokenHash: hashOpaqueToken(tokens.csrfToken),
      expiresAt: new Date(now.getTime() + this.config.sessionTtlSeconds * 1000),
    }
  }
}

export { EmailAlreadyExistsError }
