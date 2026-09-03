import { Router } from 'express'
import { z } from 'zod'

import {
  idSchema,
  practiceSessionSubmissionResponseSchema,
  practiceSessionSubmissionSchema,
  progressQuerySchema,
  progressResponseSchema,
  rangePracticeReadResponseSchema,
  todayQuerySchema,
  todayResponseSchema,
} from '@poker-range-trainer/contracts'
import { zonedCalendarDays } from '@poker-range-trainer/domain/domain/calendarDay'

import type { AuthMiddleware } from '../auth/middleware.js'
import { sendUnauthenticated } from '../auth/middleware.js'
import { sendNoStoreJson } from '../http/response.js'
import { parseRequestBody, parseRequestParams, parseRequestQuery } from '../http/validation.js'
import { sendProblem } from '../problem.js'
import {
  PracticeIdempotencyConflictError,
  PracticeRangeNotFoundError,
  PracticeUnscorableError,
} from './repository.js'
import { PracticeService } from './service.js'

const practiceRangeParamsSchema = z.object({ rangeId: idSchema }).strict()

export interface PracticeRouterOptions {
  service: Pick<PracticeService, 'submit' | 'readRange' | 'today' | 'progress'>
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'>
}

function ownerId(request: Parameters<typeof sendUnauthenticated>[0]): string | undefined {
  return request.authContext?.user.id
}

/**
 * The contract can only bound the identifier's shape; whether a zone exists is a
 * fact about this runtime's IANA database, and only building the calendar answers it.
 */
function isInstalledTimeZone(timeZone: string): boolean {
  try {
    zonedCalendarDays(timeZone)
    return true
  } catch {
    return false
  }
}

function sendUnknownTimeZone(
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
): void {
  sendProblem(request, response, {
    status: 422,
    title: 'Validation failed',
    detail: 'Request validation failed.',
    code: 'VALIDATION_FAILED',
    issues: [
      {
        path: ['timeZone'],
        code: 'invalid_time_zone',
        message: 'Expected an IANA time zone identifier such as Pacific/Auckland.',
      },
    ],
  })
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
 * Authenticated practice HTTP boundary. The router receives a service
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

  router.get('/today', options.middleware.required, async (request, response, next) => {
    const query = parseRequestQuery(todayQuerySchema, request, response)
    if (!query.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    if (!isInstalledTimeZone(query.data.timeZone)) {
      sendUnknownTimeZone(request, response)
      return
    }
    try {
      const result = await options.service.today(userId, query.data.timeZone)
      sendNoStoreJson(response, 200, todayResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapPracticeError(error, request, response)) next(error)
    }
  })

  router.get('/progress', options.middleware.required, async (request, response, next) => {
    const query = parseRequestQuery(progressQuerySchema, request, response)
    if (!query.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    if (!isInstalledTimeZone(query.data.timeZone)) {
      sendUnknownTimeZone(request, response)
      return
    }
    try {
      const result = await options.service.progress(userId, query.data.timeZone)
      sendNoStoreJson(response, 200, progressResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapPracticeError(error, request, response)) next(error)
    }
  })

  router.get('/ranges/:rangeId', options.middleware.required, async (request, response, next) => {
    const params = parseRequestParams(practiceRangeParamsSchema, request, response)
    if (!params.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.readRange(userId, params.data.rangeId)
      sendNoStoreJson(response, 200, rangePracticeReadResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapPracticeError(error, request, response)) next(error)
    }
  })

  return router
}
