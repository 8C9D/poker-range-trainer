import { Router } from 'express'

import {
  practiceSessionSubmissionResponseSchema,
  practiceSessionSubmissionSchema,
} from '@poker-range-trainer/contracts'

import type { AuthMiddleware } from '../auth/middleware.js'
import { sendUnauthenticated } from '../auth/middleware.js'
import { sendNoStoreJson } from '../http/response.js'
import { parseRequestBody } from '../http/validation.js'
import { sendProblem } from '../problem.js'
import {
  PracticeIdempotencyConflictError,
  PracticeRangeNotFoundError,
  PracticeUnscorableError,
} from './repository.js'
import { PracticeService } from './service.js'

export interface PracticeRouterOptions {
  service: Pick<PracticeService, 'submit'>
  middleware: Pick<AuthMiddleware, 'csrf'>
}

function ownerId(request: Parameters<typeof sendUnauthenticated>[0]): string | undefined {
  return request.authContext?.user.id
}

function mapPracticeError(
  error: unknown,
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
): boolean {
  if (error instanceof PracticeRangeNotFoundError) {
    sendProblem(request, response, {
      status: 404,
      title: 'Not found',
      detail: 'The requested range does not exist.',
      code: 'NOT_FOUND',
    })
    return true
  }
  if (error instanceof PracticeIdempotencyConflictError) {
    sendProblem(request, response, {
      status: 409,
      title: 'Conflict',
      detail: 'This idempotency key was already used for a different submission.',
      code: 'CONFLICT',
    })
    return true
  }
  if (error instanceof PracticeUnscorableError) {
    sendProblem(request, response, {
      status: 422,
      title: 'Validation failed',
      detail: 'The submission contains no scorable decisions.',
      code: 'VALIDATION_FAILED',
    })
    return true
  }
  return false
}

/**
 * Authenticated practice-session HTTP boundary. The router receives a service
 * port, so it owns no database pool and never derives identity from input.
 */
export function createPracticeRouter(options: PracticeRouterOptions): Router {
  const router = Router()
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  function requireOwner(
    request: Parameters<typeof sendUnauthenticated>[0],
    response: Parameters<typeof sendUnauthenticated>[1],
  ): string | undefined {
    const userId = ownerId(request)
    if (!userId) sendUnauthenticated(request, response)
    return userId
  }

  router.post('/sessions', options.middleware.csrf, async (request, response, next) => {
    const parsed = parseRequestBody(practiceSessionSubmissionSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.submit(userId, parsed.data)
      sendNoStoreJson(response, 200, practiceSessionSubmissionResponseSchema.parse(result))
    } catch (error) {
      if (!mapPracticeError(error, request, response)) next(error)
    }
  })

  return router
}
