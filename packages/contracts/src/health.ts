import { z } from 'zod'

import { successResponseSchema, timestampSchema } from './common.js'

/** Liveness/readiness response for the Express API. */
export const healthDataSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('api'),
    timestamp: timestampSchema,
  })
  .strict()
export const healthResponseSchema = successResponseSchema(healthDataSchema)
export type HealthResponse = z.infer<typeof healthResponseSchema>
