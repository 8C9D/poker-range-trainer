import { z } from 'zod'

import { GOAL_OPTIONS } from '@poker-range-trainer/domain/domain/trainingGoal'

import { successResponseSchema, timestampSchema } from './common.js'

export const dailyHandsGoalSchema = z.number().int().refine(
  (goal): goal is (typeof GOAL_OPTIONS)[number] => GOAL_OPTIONS.includes(goal as (typeof GOAL_OPTIONS)[number]),
  { message: 'Expected one of the supported daily hand goals.' },
)

export const trainingGoalReadSchema = z
  .object({
    dailyHandsGoal: dailyHandsGoalSchema.nullable(),
    updatedAt: timestampSchema.nullable(),
  })
  .strict()
export type TrainingGoalRead = z.infer<typeof trainingGoalReadSchema>

export const trainingGoalResponseSchema = successResponseSchema(trainingGoalReadSchema)

export const trainingGoalUpdateRequestSchema = z
  .object({ dailyHandsGoal: dailyHandsGoalSchema.nullable() })
  .strict()
export type TrainingGoalUpdateRequest = z.infer<typeof trainingGoalUpdateRequestSchema>

export const resetPracticeStatsRequestSchema = z.object({ confirm: z.literal(true) }).strict()

export const resetPracticeStatsResponseSchema = successResponseSchema(
  z
    .object({
      resetAt: timestampSchema,
      rangesReset: z.number().int().nonnegative(),
    })
    .strict(),
)
