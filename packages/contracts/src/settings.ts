import { z } from 'zod'

import { successResponseSchema, timestampSchema } from './common.js'

/**
 * The largest persisted daily target. It stays below PostgreSQL's signed integer
 * maximum and matches the bounded counters returned by the read models.
 *
 * `GOAL_OPTIONS` remains a UI suggestion list; legacy backups can contain any
 * positive integer target and must not lose a chosen value such as 50.
 */
export const MAX_DAILY_HANDS_GOAL = 1_000_000_000

export const dailyHandsGoalSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_DAILY_HANDS_GOAL)

export const trainingGoalReadSchema = z
  .object({
    dailyHandsGoal: dailyHandsGoalSchema.nullable(),
    updatedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((goal, context) => {
    if ((goal.dailyHandsGoal === null) !== (goal.updatedAt === null)) {
      context.addIssue({
        code: 'custom',
        message: 'A training-goal timestamp is present only when a goal is set.',
        path: ['updatedAt'],
      })
    }
  })
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
