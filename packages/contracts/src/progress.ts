import { z } from 'zod'

import { accuracyPercentage } from '@poker-range-trainer/domain/domain/accuracy'
import { HAND_CLASSES } from '@poker-range-trainer/domain/domain/handClass'
import { POSITIONS } from '@poker-range-trainer/domain/types/range'

import { handCodeSchema, idSchema, successResponseSchema, timestampSchema } from './common.js'
import { dailyHandsGoalSchema } from './settings.js'

const percentageSchema = z.number().min(0).max(100)
const boundedCountSchema = z.number().int().nonnegative().max(1_000_000_000)
const boundedRangeCountSchema = z.number().int().nonnegative().max(1_000_000)
const calendarDateSchema = z.iso.date()

/** Service code validates that this syntactically bounded identifier is an installed IANA zone. */
export const ianaTimeZoneSchema = z.string().trim().min(1).max(100)
export const todayQuerySchema = z.object({ timeZone: ianaTimeZoneSchema }).strict()
export type TodayQuery = z.infer<typeof todayQuerySchema>
export const progressQuerySchema = z.object({ timeZone: ianaTimeZoneSchema }).strict()
export type ProgressQuery = z.infer<typeof progressQuerySchema>

function requireComputedAccuracy(
  value: { handsAnswered: number; correctAnswers: number; accuracyPercentage: number },
  context: z.RefinementCtx,
): void {
  if (value.accuracyPercentage !== accuracyPercentage(value.correctAnswers, value.handsAnswered)) {
    context.addIssue({
      code: 'custom',
      message: 'accuracyPercentage must be computed from the response counters.',
      path: ['accuracyPercentage'],
    })
  }
}

export const dueRangeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    dueAt: timestampSchema.nullable(),
    accuracyPercentage: percentageSchema.nullable(),
    lastPracticedAt: timestampSchema.nullable(),
  })
  .strict()

export const todayReadModelSchema = z
  .object({
    generatedAt: timestampSchema,
    streakDays: z.number().int().nonnegative().max(36_500),
    dailyGoal: z
      .object({
        target: dailyHandsGoalSchema.nullable(),
        handsAnswered: boundedCountSchema,
        remainingHands: boundedCountSchema,
      })
      .strict(),
    dueRanges: z.array(dueRangeSchema).max(100),
    caughtUp: z.boolean(),
  })
  .strict()
  .superRefine((today, context) => {
    if (today.caughtUp !== (today.dueRanges.length === 0)) {
      context.addIssue({
        code: 'custom',
        message: 'caughtUp must reflect whether any ranges are due.',
        path: ['caughtUp'],
      })
    }

    const { target, handsAnswered, remainingHands } = today.dailyGoal
    const expectedRemaining = target === null ? 0 : Math.max(target - handsAnswered, 0)
    if (remainingHands !== expectedRemaining) {
      context.addIssue({
        code: 'custom',
        message: 'remainingHands must be computed from the daily goal and answered hands.',
        path: ['dailyGoal', 'remainingHands'],
      })
    }
  })
export type TodayReadModel = z.infer<typeof todayReadModelSchema>

export const todayResponseSchema = successResponseSchema(todayReadModelSchema)

const activityPointSchema = z
  .object({
    day: calendarDateSchema,
    handsAnswered: boundedCountSchema,
  })
  .strict()

const accuracyTrendPointSchema = z
  .object({
    weekStart: calendarDateSchema,
    handsAnswered: boundedCountSchema,
    correctAnswers: boundedCountSchema,
    accuracyPercentage: percentageSchema,
  })
  .strict()
  .superRefine((point, context) => {
    if (point.correctAnswers > point.handsAnswered) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed hands answered.',
        path: ['correctAnswers'],
      })
    }
    requireComputedAccuracy(point, context)
  })

const weakHandSchema = z
  .object({
    rangeId: idSchema,
    hand: handCodeSchema,
    attempts: boundedCountSchema,
    correct: boundedCountSchema,
    accuracyPercentage: percentageSchema,
  })
  .strict()
  .superRefine((hand, context) => {
    if (hand.correct > hand.attempts) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed attempts.',
        path: ['correct'],
      })
    }
    if (hand.accuracyPercentage !== accuracyPercentage(hand.correct, hand.attempts)) {
      context.addIssue({
        code: 'custom',
        message: 'accuracyPercentage must be computed from attempts and correct.',
        path: ['accuracyPercentage'],
      })
    }
  })

const uniqueHandsSchema = z
  .array(handCodeSchema)
  .min(1)
  .max(169)
  .superRefine((hands, context) => {
    const seen = new Set<string>()
    hands.forEach((hand, index) => {
      if (seen.has(hand)) {
        context.addIssue({ code: 'custom', message: 'Hands must not contain duplicates.', path: [index] })
      }
      seen.add(hand)
    })
  })

const drillPoolsSchema = z.record(idSchema, uniqueHandsSchema).superRefine((pools, context) => {
  if (Object.keys(pools).length > 100) {
    context.addIssue({
      code: 'custom',
      message: 'A drill pool report cannot name more than 100 ranges.',
    })
  }
})

const handClassLeakSchema = z
  .object({
    handClass: z.enum(HAND_CLASSES),
    attempts: boundedCountSchema,
    correct: boundedCountSchema,
    accuracyPercentage: percentageSchema,
    missedHands: uniqueHandsSchema,
    pools: drillPoolsSchema,
  })
  .strict()
  .superRefine((leak, context) => {
    if (leak.correct > leak.attempts) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed attempts.',
        path: ['correct'],
      })
    }
    if (leak.accuracyPercentage !== accuracyPercentage(leak.correct, leak.attempts)) {
      context.addIssue({
        code: 'custom',
        message: 'accuracyPercentage must be computed from attempts and correct.',
        path: ['accuracyPercentage'],
      })
    }
    const missedHands = new Set(leak.missedHands)
    for (const [rangeId, hands] of Object.entries(leak.pools)) {
      hands.forEach((hand, index) => {
        if (!missedHands.has(hand)) {
          context.addIssue({
            code: 'custom',
            message: 'A drill pool can only contain hands named by the leak.',
            path: ['pools', rangeId, index],
          })
        }
      })
    }
  })

const mistakeBiasSchema = z
  .object({
    loose: boundedCountSchema,
    tight: boundedCountSchema,
    mistakes: boundedCountSchema,
    loosePercentage: percentageSchema,
    bias: z.enum(['loose', 'tight', 'balanced', 'unknown']),
  })
  .strict()
  .superRefine((bias, context) => {
    if (bias.mistakes !== bias.loose + bias.tight) {
      context.addIssue({
        code: 'custom',
        message: 'mistakes must equal loose plus tight misses.',
        path: ['mistakes'],
      })
    }
    if (bias.loosePercentage !== accuracyPercentage(bias.loose, bias.mistakes)) {
      context.addIssue({
        code: 'custom',
        message: 'loosePercentage must be computed from the directional miss counts.',
        path: ['loosePercentage'],
      })
    }
  })

const positionLeanSchema = z
  .object({
    position: z.enum(POSITIONS),
    summary: mistakeBiasSchema,
    pools: drillPoolsSchema,
  })
  .strict()
  .superRefine((lean, context) => {
    if (lean.summary.bias !== 'loose' && lean.summary.bias !== 'tight') {
      context.addIssue({
        code: 'custom',
        message: 'A position lean must have a decisive loose or tight bias.',
        path: ['summary', 'bias'],
      })
    }
  })

export const progressReadModelSchema = z
  .object({
    generatedAt: timestampSchema,
    allTime: z
      .object({
        rangesPracticed: boundedRangeCountSchema,
        handsAnswered: boundedCountSchema,
        correctAnswers: boundedCountSchema,
        accuracyPercentage: percentageSchema,
      })
      .strict(),
    dailyActivity: z.array(activityPointSchema).max(90),
    weeklyAccuracyTrend: z.array(accuracyTrendPointSchema).max(52),
    handClassLeaks: z.array(handClassLeakSchema).max(HAND_CLASSES.length),
    mistakeBias: mistakeBiasSchema,
    positionLeans: z.array(positionLeanSchema).max(POSITIONS.length),
    weakestHands: z.array(weakHandSchema).max(20),
  })
  .strict()
  .superRefine((progress, context) => {
    if (progress.allTime.correctAnswers > progress.allTime.handsAnswered) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed hands answered.',
        path: ['allTime', 'correctAnswers'],
      })
    }
    requireComputedAccuracy(progress.allTime, context)
    if (progress.allTime.rangesPracticed > progress.allTime.handsAnswered) {
      context.addIssue({
        code: 'custom',
        message: 'rangesPracticed cannot exceed all-time hands answered.',
        path: ['allTime', 'rangesPracticed'],
      })
    }

    const seenHandClasses = new Set<string>()
    progress.handClassLeaks.forEach((leak, index) => {
      if (seenHandClasses.has(leak.handClass)) {
        context.addIssue({
          code: 'custom',
          message: 'A hand class can appear only once in the leak report.',
          path: ['handClassLeaks', index, 'handClass'],
        })
      }
      seenHandClasses.add(leak.handClass)
    })

    const seenPositions = new Set<string>()
    progress.positionLeans.forEach((lean, index) => {
      if (seenPositions.has(lean.position)) {
        context.addIssue({
          code: 'custom',
          message: 'A position can appear only once in the lean report.',
          path: ['positionLeans', index, 'position'],
        })
      }
      seenPositions.add(lean.position)
    })
  })
export type ProgressReadModel = z.infer<typeof progressReadModelSchema>

export const progressResponseSchema = successResponseSchema(progressReadModelSchema)
