import { Router } from 'express'

import {
  resetPracticeStatsRequestSchema,
  resetPracticeStatsResponseSchema,
  trainingGoalResponseSchema,
  trainingGoalUpdateRequestSchema,
} from '@poker-range-trainer/contracts'

import type { AuthMiddleware } from '../auth/middleware.js'
import { sendUnauthenticated } from '../auth/middleware.js'
import { sendNoStoreJson } from '../http/response.js'
import { parseRequestBody } from '../http/validation.js'
import { SettingsService } from './service.js'

export interface SettingsRouterOptions {
  service: Pick<SettingsService, 'readTrainingGoal' | 'writeTrainingGoal' | 'resetPracticeStats'>
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'>
}

function ownerId(request: Parameters<typeof sendUnauthenticated>[0]): string | undefined {
  return request.authContext?.user.id
}

/**
 * Authenticated user-settings HTTP boundary. The router receives a service port,
 * so it owns no database pool and never derives identity from request input.
 */
export function createSettingsRouter(options: SettingsRouterOptions): Router {
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

  router.get('/training-goal', options.middleware.required, async (request, response, next) => {
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.readTrainingGoal(userId)
      sendNoStoreJson(response, 200, trainingGoalResponseSchema.parse({ data: result }))
    } catch (error) {
      next(error)
    }
  })

  router.put('/training-goal', options.middleware.csrf, async (request, response, next) => {
    const parsed = parseRequestBody(trainingGoalUpdateRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.writeTrainingGoal(userId, parsed.data.dailyHandsGoal)
      sendNoStoreJson(response, 200, trainingGoalResponseSchema.parse({ data: result }))
    } catch (error) {
      next(error)
    }
  })

  router.post('/reset-practice-stats', options.middleware.csrf, async (request, response, next) => {
    const parsed = parseRequestBody(resetPracticeStatsRequestSchema, request, response)
    if (!parsed.ok) return
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const result = await options.service.resetPracticeStats(userId)
      sendNoStoreJson(response, 200, resetPracticeStatsResponseSchema.parse({ data: result }))
    } catch (error) {
      next(error)
    }
  })

  return router
}
