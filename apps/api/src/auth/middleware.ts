import { timingSafeEqual } from 'node:crypto'

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Logger } from 'pino'

import type { ApiConfig } from '../config.js'
import { requestId, sendProblem } from '../problem.js'
import { clearAuthCookies, CSRF_COOKIE_NAME, parseCookies, SESSION_COOKIE_NAME } from './cookies.js'
import type { AuthRepository, Clock, ResolvedAuthSession } from './repository.js'
import { hashOpaqueToken, isOpaqueToken, tokenHashMatches } from './tokens.js'

declare module 'express-serve-static-core' {
  interface Request {
    /** Internal-only context; never serialize this session representation. */
    authContext?: ResolvedAuthSession
  }
}

export const SESSION_TOUCH_INTERVAL_MS = 15 * 60 * 1000

export interface AuthMiddlewareOptions {
  repository: AuthRepository
  config: ApiConfig
  logger: Logger
  clock?: Clock
  touchIntervalMs?: number
}

export function sendUnauthenticated(request: Request, response: Response): void {
  sendProblem(request, response, {
    status: 401,
    title: 'Unauthenticated',
    detail: 'Authentication is required.',
    code: 'UNAUTHENTICATED',
  })
}

export function sendCsrfFailed(request: Request, response: Response): void {
  sendProblem(request, response, {
    status: 403,
    title: 'Forbidden',
    detail: 'CSRF validation failed.',
    code: 'CSRF_FAILED',
  })
}

function tokensEqual(left: string, right: string): boolean {
  if (!isOpaqueToken(left) || !isOpaqueToken(right)) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

export interface AuthMiddleware {
  /** Resolves a valid session when present; invalid credentials are cleared and treated as anonymous. */
  optional: RequestHandler
  /** Requires a valid session. */
  required: RequestHandler
  /** Requires a valid session plus the double-submit CSRF capability. */
  csrf: RequestHandler
  /** Checks CSRF for an already-loaded live session, without writing a response. */
  hasValidCsrf(request: Request): boolean
}

export function createAuthMiddleware(options: AuthMiddlewareOptions): AuthMiddleware {
  const { repository, config, logger } = options
  const clock = options.clock ?? { now: () => new Date() }
  const touchIntervalMs = options.touchIntervalMs ?? SESSION_TOUCH_INTERVAL_MS

  async function loadSession(
    request: Request,
    response: Response,
  ): Promise<ResolvedAuthSession | undefined> {
    const rawSessionToken = parseCookies(request).get(SESSION_COOKIE_NAME)
    if (rawSessionToken === undefined) return undefined
    if (!isOpaqueToken(rawSessionToken)) {
      clearAuthCookies(response, config)
      return undefined
    }

    let resolved: ResolvedAuthSession | undefined
    try {
      resolved = await repository.resolveActiveSession(hashOpaqueToken(rawSessionToken))
    } catch (error: unknown) {
      logger.warn(
        { requestId: requestId(request), errorName: error instanceof Error ? error.name : 'Error' },
        'auth session lookup failed',
      )
      throw error
    }
    if (!resolved) {
      clearAuthCookies(response, config)
      return undefined
    }
    request.authContext = resolved
    const lastSeenBefore = new Date(clock.now().getTime() - touchIntervalMs)
    if (resolved.session.lastSeenAt < lastSeenBefore) {
      try {
        await repository.touchSessionLastSeen({
          userId: resolved.user.id,
          sessionId: resolved.session.id,
          lastSeenBefore,
        })
      } catch (error: unknown) {
        logger.warn(
          {
            requestId: requestId(request),
            errorName: error instanceof Error ? error.name : 'Error',
          },
          'auth session touch failed',
        )
      }
    }
    return resolved
  }

  function loadThen(
    request: Request,
    response: Response,
    next: NextFunction,
    onLoaded: (session: ResolvedAuthSession | undefined) => void,
  ): void {
    void loadSession(request, response).then(onLoaded, next)
  }

  function hasValidCsrf(request: Request): boolean {
    const session = request.authContext
    const cookies = parseCookies(request)
    const cookieToken = cookies.get(CSRF_COOKIE_NAME)
    const headerToken = request.get('x-csrf-token')
    return Boolean(
      session &&
      cookieToken &&
      headerToken &&
      tokensEqual(cookieToken, headerToken) &&
      tokenHashMatches(headerToken, session.session.csrfTokenHash),
    )
  }

  const optional: RequestHandler = (request, response, next): void => {
    loadThen(request, response, next, () => next())
  }

  const required: RequestHandler = (request, response, next): void => {
    loadThen(request, response, next, (session) => {
      if (!session) return sendUnauthenticated(request, response)
      next()
    })
  }

  const csrf: RequestHandler = (request, response, next): void => {
    loadThen(request, response, next, (session) => {
      if (!session) return sendUnauthenticated(request, response)
      if (!hasValidCsrf(request)) return sendCsrfFailed(request, response)
      next()
    })
  }

  return { optional, required, csrf, hasValidCsrf }
}
