import { z } from 'zod'

import { accuracyPercentage } from '@poker-range-trainer/domain/domain/accuracy'
import { HAND_CLASSES } from '@poker-range-trainer/domain/domain/handClass'
import { POSITIONS } from '@poker-range-trainer/domain/types/range'

import { handCodeSchema, idSchema, successResponseSchema, timestampSchema } from './common.js'
import { dailyHandsGoalSchema, MAX_DAILY_HANDS_GOAL } from './settings.js'

const percentageSchema = z.number().min(0).max(100)
const boundedCountSchema = z.number().int().nonnegative().max(MAX_DAILY_HANDS_GOAL)
const boundedRangeCountSchema = z.number().int().nonnegative().max(1_000_000)
const calendarDateSchema = z.iso.date()
const streakDaysSchema = z.number().int().nonnegative().max(36_500)

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

const answerSummarySchema = z
  .object({
    handsAnswered: boundedCountSchema,
    correctAnswers: boundedCountSchema,
    accuracyPercentage: percentageSchema,
  })
  .strict()
  .superRefine((summary, context) => {
    if (summary.correctAnswers > summary.handsAnswered) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed hands answered.',
        path: ['correctAnswers'],
      })
    }
    requireComputedAccuracy(summary, context)
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

export const dueRangeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    dueAt: timestampSchema.nullable(),
    accuracyPercentage: percentageSchema.nullable(),
    lastPracticedAt: timestampSchema.nullable(),
  })
  .strict()

const sharpestRangeSchema = answerSummarySchema
  .extend({
    id: idSchema,
    name: z.string().min(1).max(120),
  })
  .strict()
  .superRefine((range, context) => {
    if (range.handsAnswered === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A sharpest range must have answered hands.',
        path: ['handsAnswered'],
      })
    }
  })

const trailingSevenDaysSchema = answerSummarySchema
  .extend({ sharpestRange: sharpestRangeSchema.nullable() })
  .strict()
  .superRefine((summary, context) => {
    const { sharpestRange } = summary
    if (summary.handsAnswered === 0 && sharpestRange !== null) {
      context.addIssue({
        code: 'custom',
        message: 'A seven-day summary without answers cannot name a sharpest range.',
        path: ['sharpestRange'],
      })
    }
    if (summary.handsAnswered > 0 && sharpestRange === null) {
      context.addIssue({
        code: 'custom',
        message: 'A seven-day summary with answers must name a sharpest range.',
        path: ['sharpestRange'],
      })
    }
    if (
      sharpestRange !== null &&
      (sharpestRange.handsAnswered > summary.handsAnswered ||
        sharpestRange.correctAnswers > summary.correctAnswers)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Sharpest-range counters must be included in the seven-day summary.',
        path: ['sharpestRange'],
      })
    }
  })

const MAX_FREE_PRACTICE_HANDS = 10

const freePracticeWeakHandsSchema = z
  .object({
    kind: z.literal('weakHands'),
    rangeIds: z.array(idSchema).min(1).max(MAX_FREE_PRACTICE_HANDS),
    pools: drillPoolsSchema,
    handCount: z.number().int().min(1).max(MAX_FREE_PRACTICE_HANDS),
  })
  .strict()
  .superRefine((suggestion, context) => {
    const uniqueRangeIds = new Set(suggestion.rangeIds)
    if (uniqueRangeIds.size !== suggestion.rangeIds.length) {
      context.addIssue({ code: 'custom', message: 'Range IDs must be unique.', path: ['rangeIds'] })
    }

    const poolRangeIds = Object.keys(suggestion.pools)
    if (
      poolRangeIds.length !== uniqueRangeIds.size ||
      poolRangeIds.some((rangeId) => !uniqueRangeIds.has(rangeId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Weak-hand pools must be keyed by exactly the named ranges.',
        path: ['pools'],
      })
    }

    const handCount = Object.values(suggestion.pools).reduce((total, hands) => total + hands.length, 0)
    if (suggestion.handCount !== handCount) {
      context.addIssue({
        code: 'custom',
        message: 'handCount must equal the number of distinct range-hand pool entries.',
        path: ['handCount'],
      })
    }
  })

const freePracticeReviewEarlySchema = z
  .object({
    kind: z.literal('reviewEarly'),
    rangeId: idSchema,
    dueAt: timestampSchema,
  })
  .strict()

const freePracticeSchema = z
  .discriminatedUnion('kind', [freePracticeWeakHandsSchema, freePracticeReviewEarlySchema])
  .nullable()

export const todayReadModelSchema = z
  .object({
    generatedAt: timestampSchema,
    streakDays: streakDaysSchema,
    dailyGoal: z
      .object({
        target: dailyHandsGoalSchema.nullable(),
        handsAnswered: boundedCountSchema,
        remainingHands: boundedCountSchema,
      })
      .strict(),
    trailingSevenDays: trailingSevenDaysSchema,
    dueRanges: z.array(dueRangeSchema).max(100),
    caughtUp: z.boolean(),
    freePractice: freePracticeSchema,
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

    if (today.dueRanges.length > 0 && today.freePractice !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Free practice is available only when no ranges are due.',
        path: ['freePractice'],
      })
    }

    if (
      today.freePractice?.kind === 'reviewEarly' &&
      Date.parse(today.freePractice.dueAt) <= Date.parse(today.generatedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'An early review must be due after this Today projection was generated.',
        path: ['freePractice', 'dueAt'],
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
    streakDays: streakDaysSchema,
    allTime: z
      .object({
        rangesPracticed: boundedRangeCountSchema,
        handsAnswered: boundedCountSchema,
        correctAnswers: boundedCountSchema,
        accuracyPercentage: percentageSchema,
      })
      .strict(),
    trailingThirtyDays: answerSummarySchema,
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
