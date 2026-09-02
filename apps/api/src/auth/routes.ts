import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import {
  loginRequestSchema,
  loginResponseSchema,
  logoutRequestSchema,
  logoutResponseSchema,
  meResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
} from '@poker-range-trainer/contracts'
import type { z } from 'zod'
import type { Logger } from 'pino'

import type { ApiConfig } from '../config.js'
import { sendProblem } from '../problem.js'
import { clearAuthCookies, setAuthCookies } from './cookies.js'
import { createAuthMiddleware, sendCsrfFailed, type AuthMiddleware } from './middleware.js'
import type { AuthRepository } from './repository.js'
import { AuthService, EmailAlreadyExistsError, InvalidLoginError } from './service.js'

export interface AuthRouterOptions {
  config: ApiConfig
  logger: Logger
  repository: AuthRepository
  service?: AuthService
  middleware?: AuthMiddleware
}

function validationProblem(request: Request, response: Response, error: z.ZodError): void {
  sendProblem(request, response, {
    status: 422,
    title: 'Validation failed',
    detail: 'Request validation failed.',
    code: 'VALIDATION_FAILED',
    issues: error.issues.map((issue) => ({
      path: issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol'),
      code: issue.code,
      message: issue.message,
    })),
  })
}

function parseBody<T extends z.ZodType>(
  schema: T,
  request: Request,
  response: Response,
): z.output<T> | undefined {
  const parsed = schema.safeParse(request.body)
  if (!parsed.success) {
    validationProblem(request, response, parsed.error)
    return undefined
  }
  return parsed.data
}

function parseLogoutBody(request: Request, response: Response): boolean {
  // Express leaves body undefined when there is no JSON payload, which is the
  // normal logout request. A supplied JSON document must still be the strict
  // empty logout contract.
  if (request.body === undefined) return true
  return parseBody(logoutRequestSchema, request, response) !== undefined
}

function sendNoStore(response: Response, status: number, body: unknown): void {
  response.setHeader('Cache-Control', 'no-store')
  response.status(status).json(body)
}

function authLimiter(config: ApiConfig) {
  return rateLimit({
    windowMs: config.authRateLimitWindowMs,
    limit: config.authRateLimitMax,
    legacyHeaders: false,
    standardHeaders: 'draft-7',
    handler(request, response) {
      response.setHeader('Cache-Control', 'no-store')
      sendProblem(request, response, {
        status: 429,
        title: 'Too many requests',
        detail: 'Too many authentication attempts. Please try again later.',
        code: 'RATE_LIMITED',
      })
    },
  })
}

/** Router intentionally has no database construction side effects, making API tests fake-friendly. */
export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router()
  const service = options.service ?? new AuthService(options.repository, options.config)
  const middleware =
    options.middleware ??
    createAuthMiddleware({
      repository: options.repository,
      config: options.config,
      logger: options.logger,
    })
  const attempts = authLimiter(options.config)
  // Error paths (including validation and CSRF) are auth responses too.
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post('/register', attempts, async (request, response, next) => {
    const input = parseBody(registerRequestSchema, request, response)
    if (!input) return
    try {
      const result = await service.register(input)
      const body = registerResponseSchema.parse({ data: { user: result.user } })
      setAuthCookies(response, options.config, result.tokens)
      sendNoStore(response, 201, body)
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        response.setHeader('Cache-Control', 'no-store')
        sendProblem(request, response, {
          status: 409,
          title: 'Conflict',
          detail: 'An account with that email already exists.',
          code: 'CONFLICT',
        })
        return
      }
      next(error)
    }
  })

  router.post('/login', attempts, async (request, response, next) => {
    const input = parseBody(loginRequestSchema, request, response)
    if (!input) return
    try {
      const result = await service.login(input)
      const body = loginResponseSchema.parse({ data: { user: result.user } })
      setAuthCookies(response, options.config, result.tokens)
      sendNoStore(response, 200, body)
    } catch (error) {
      if (error instanceof InvalidLoginError) {
        response.setHeader('Cache-Control', 'no-store')
        sendProblem(request, response, {
          status: 401,
          title: 'Unauthenticated',
          detail: 'Invalid email or password.',
          code: 'UNAUTHENTICATED',
        })
        return
      }
      next(error)
    }
  })

  router.post('/logout', middleware.optional, async (request, response, next) => {
    if (!parseLogoutBody(request, response)) return
    try {
      const session = request.authContext
      // Logout is idempotent only after the session has become invalid. A still-live
      // cookie must prove the separate CSRF capability before it can revoke anything.
      if (session && !middleware.hasValidCsrf(request)) {
        sendCsrfFailed(request, response)
        return
      }
      if (session) await options.repository.revokeSession(session.user.id, session.session.id)
      clearAuthCookies(response, options.config)
      sendNoStore(response, 200, logoutResponseSchema.parse({ data: { success: true } }))
    } catch (error) {
      next(error)
    }
  })

  router.get('/me', middleware.optional, (request, response) => {
    const authContext = request.authContext
    const body = authContext
      ? meResponseSchema.parse({
          data: {
            authenticated: true,
            user: {
              id: authContext.user.id,
              email: authContext.user.email,
              createdAt: authContext.user.createdAt.toISOString(),
            },
          },
        })
      : meResponseSchema.parse({ data: { authenticated: false } })
    sendNoStore(response, 200, body)
  })

  return router
}
