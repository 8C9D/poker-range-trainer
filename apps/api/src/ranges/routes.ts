import { Router } from 'express'
import { z } from 'zod'

import {
  bulkRangeMutationRequestSchema,
  bulkRangeMutationResponseSchema,
  idSchema,
  rangeArchiveRequestSchema,
  rangeArchiveResponseSchema,
  rangeCreateRequestSchema,
  rangeCreateResponseSchema,
  rangeDeleteRequestSchema,
  rangeDeleteResponseSchema,
  rangeDuplicateRequestSchema,
  rangeDuplicateResponseSchema,
  rangeFavoriteRequestSchema,
  rangeFavoriteResponseSchema,
  rangeListQuerySchema,
  rangeListResponseSchema,
  rangeReadResponseSchema,
  rangeRestoreRequestSchema,
  rangeRestoreResponseSchema,
  rangeUpdateRequestSchema,
  rangeUpdateResponseSchema,
} from '@poker-range-trainer/contracts'

import type { AuthMiddleware } from '../auth/middleware.js'
import { sendUnauthenticated } from '../auth/middleware.js'
import { sendNoStoreJson } from '../http/response.js'
import { parseRequestBody, parseRequestParams, parseRequestQuery } from '../http/validation.js'
import { sendProblem } from '../problem.js'
import { RangeInputError, RangeNotFoundError, RangeVersionConflictError } from './repository.js'
import { RangeService } from './service.js'

const rangeParamsSchema = z.object({ rangeId: idSchema }).strict()

export interface RangeRouterOptions {
  service: Pick<
    RangeService,
    | 'create'
    | 'list'
    | 'get'
    | 'update'
    | 'archive'
    | 'unarchive'
    | 'favorite'
    | 'unfavorite'
    | 'delete'
    | 'restore'
    | 'duplicate'
    | 'bulk'
  >
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'>
}

function ownerId(request: Parameters<typeof sendUnauthenticated>[0]): string | undefined {
  return request.authContext?.user.id
}

function mapRangeError(
  error: unknown,
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
): boolean {
  if (error instanceof RangeNotFoundError) {
    sendProblem(request, response, {
      status: 404,
      title: 'Not found',
      detail: 'The requested range does not exist.',
      code: 'NOT_FOUND',
    })
    return true
  }
  if (error instanceof RangeVersionConflictError) {
    sendProblem(request, response, {
      status: 409,
      title: 'Conflict',
      detail: 'The range was modified by another request.',
      code: 'CONFLICT',
    })
    return true
  }
  if (error instanceof RangeInputError) {
    sendProblem(request, response, {
      status: 422,
      title: 'Validation failed',
      detail: 'The range operation is invalid.',
      code: 'VALIDATION_FAILED',
    })
    return true
  }
  return false
}

/**
 * Authenticated range-library HTTP boundary. The router receives all stateful
 * dependencies, so tests can use a fake service and no router constructs a DB
 * pool or selects a user from request input.
 */
export function createRangeRouter(options: RangeRouterOptions): Router {
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

  router.post('/', options.middleware.csrf, async (request, response, next) => {
    const parsed = parseRequestBody(rangeCreateRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.create(userId, parsed.data)
      sendNoStoreJson(response, 201, rangeCreateResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.get('/', options.middleware.required, async (request, response, next) => {
    const parsed = parseRequestQuery(rangeListQuerySchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.list(userId, parsed.data)
      sendNoStoreJson(response, 200, rangeListResponseSchema.parse(result))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  // Deliberately before /:rangeId so the literal route remains unambiguous.
  router.post('/bulk', options.middleware.csrf, async (request, response, next) => {
    const parsed = parseRequestBody(bulkRangeMutationRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.bulk(userId, parsed.data)
      sendNoStoreJson(response, 200, bulkRangeMutationResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.get('/:rangeId', options.middleware.required, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.get(userId, params.data.rangeId)
      sendNoStoreJson(response, 200, rangeReadResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.patch('/:rangeId', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeUpdateRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.update(userId, params.data.rangeId, parsed.data)
      sendNoStoreJson(response, 200, rangeUpdateResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.delete('/:rangeId', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeDeleteRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.delete(userId, params.data.rangeId, parsed.data.version)
      sendNoStoreJson(response, 200, rangeDeleteResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.post('/:rangeId/archive', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeArchiveRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = parsed.data.archived
        ? await options.service.archive(userId, params.data.rangeId, parsed.data.version)
        : await options.service.unarchive(userId, params.data.rangeId, parsed.data.version)
      sendNoStoreJson(response, 200, rangeArchiveResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.post('/:rangeId/favorite', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeFavoriteRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = parsed.data.favorite
        ? await options.service.favorite(userId, params.data.rangeId, parsed.data.version)
        : await options.service.unfavorite(userId, params.data.rangeId, parsed.data.version)
      sendNoStoreJson(response, 200, rangeFavoriteResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.post('/:rangeId/restore', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeRestoreRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.restore(userId, params.data.rangeId, parsed.data.version)
      sendNoStoreJson(response, 200, rangeRestoreResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  router.post('/:rangeId/duplicate', options.middleware.csrf, async (request, response, next) => {
    const params = parseRequestParams(rangeParamsSchema, request, response)
    if (!params.ok) return
    const parsed = parseRequestBody(rangeDuplicateRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.duplicate(userId, params.data.rangeId, parsed.data)
      sendNoStoreJson(response, 200, rangeDuplicateResponseSchema.parse({ data: result }))
    } catch (error) {
      if (!mapRangeError(error, request, response)) next(error)
    }
  })

  return router
}
