import { z } from 'zod'

import { accuracyPercentage } from '@poker-range-trainer/domain/domain/accuracy'

import { handCodeSchema, idSchema, successResponseSchema, timestampSchema } from './common.js'
import { rangeHandsSchema } from './ranges.js'

export const practiceModeValues = ['recognition', 'timed', 'weakness', 'edges', 'mistakes', 'build'] as const
export const practiceModeSchema = z.enum(practiceModeValues)
export type PracticeMode = z.infer<typeof practiceModeSchema>

export const idempotencyKeySchema = idSchema

const questionAnswerSchema = z
  .object({
    questionId: idSchema,
    hand: handCodeSchema,
    answer: z.boolean(),
    answeredAt: timestampSchema,
  })
  .strict()

const questionAnswersSchema = z
  .array(questionAnswerSchema)
  .min(1)
  .max(500)
  .superRefine((answers, context) => {
    const seen = new Set<string>()
    answers.forEach((answer, index) => {
      if (seen.has(answer.questionId)) {
        context.addIssue({
          code: 'custom',
          message: 'A question can only be answered once per submission.',
          path: [index, 'questionId'],
        })
      }
      seen.add(answer.questionId)
    })
  })

/** A blank build is a legacy no-record reveal, not a submit-able practice attempt. */
export const selectedHandsSchema = rangeHandsSchema

const answeredPracticeSubmissionSchema = z
  .object({
    rangeId: idSchema,
    idempotencyKey: idempotencyKeySchema,
    answers: questionAnswersSchema,
  })
  .strict()

export const practiceSessionSubmissionSchema = z.discriminatedUnion('mode', [
  answeredPracticeSubmissionSchema.extend({ mode: z.literal('recognition') }).strict(),
  answeredPracticeSubmissionSchema.extend({ mode: z.literal('timed') }).strict(),
  answeredPracticeSubmissionSchema.extend({ mode: z.literal('weakness') }).strict(),
  answeredPracticeSubmissionSchema.extend({ mode: z.literal('edges') }).strict(),
  answeredPracticeSubmissionSchema.extend({ mode: z.literal('mistakes') }).strict(),
  z
    .object({
      mode: z.literal('build'),
      rangeId: idSchema,
      idempotencyKey: idempotencyKeySchema,
      selectedHands: selectedHandsSchema,
    })
    .strict(),
])
export type PracticeSessionSubmission = z.infer<typeof practiceSessionSubmissionSchema>

const attemptCountSchema = z.number().int().min(0).max(1_000_000_000)
const accuracyPercentageSchema = z.number().min(0).max(100)

function requireComputedAccuracy(
  summary: { totalQuestions?: number; correctAnswers?: number; totalAttempts?: number; correctAttempts?: number; accuracyPercentage: number },
  context: z.RefinementCtx,
): void {
  const total = summary.totalQuestions ?? summary.totalAttempts!
  const correct = summary.correctAnswers ?? summary.correctAttempts!
  if (summary.accuracyPercentage !== accuracyPercentage(correct, total)) {
    context.addIssue({
      code: 'custom',
      message: 'accuracyPercentage must be computed from the response counters.',
      path: ['accuracyPercentage'],
    })
  }
}

const practiceCountersSchema = z
  .object({
    totalQuestions: attemptCountSchema.min(1).max(500),
    correctAnswers: attemptCountSchema.max(500),
    accuracyPercentage: accuracyPercentageSchema,
  })
  .strict()
  .superRefine((summary, context) => {
    if (summary.correctAnswers > summary.totalQuestions) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed total questions.',
        path: ['correctAnswers'],
      })
    }
    requireComputedAccuracy(summary, context)
  })

export const apiPracticeSessionSchema = practiceCountersSchema
  .extend({
    id: idSchema,
    rangeId: idSchema,
    mode: practiceModeSchema,
    completedAt: timestampSchema,
  })
  .strict()
export type ApiPracticeSession = z.infer<typeof apiPracticeSessionSchema>

export const rangePracticeStatsSchema = z
  .object({
    rangeId: idSchema,
    totalAttempts: attemptCountSchema,
    correctAttempts: attemptCountSchema,
    accuracyPercentage: accuracyPercentageSchema,
    lastPracticedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((stats, context) => {
    if (stats.correctAttempts > stats.totalAttempts) {
      context.addIssue({
        code: 'custom',
        message: 'Correct attempts cannot exceed total attempts.',
        path: ['correctAttempts'],
      })
    }
    requireComputedAccuracy(stats, context)
  })
export type RangePracticeStats = z.infer<typeof rangePracticeStatsSchema>

export const reviewStateSchema = z
  .object({
    rangeId: idSchema,
    ease: z.number().min(1.3).max(999.99).multipleOf(0.01),
    intervalDays: z.number().int().nonnegative().max(36_500),
    dueAt: timestampSchema.nullable(),
    lastReviewedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((review, context) => {
    const neverScheduled = review.intervalDays === 0
    if (neverScheduled && (review.dueAt !== null || review.lastReviewedAt !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'An unscheduled review must not have review timestamps.',
        path: ['dueAt'],
      })
    }
    if (!neverScheduled && (review.dueAt === null || review.lastReviewedAt === null)) {
      context.addIssue({
        code: 'custom',
        message: 'A scheduled review requires dueAt and lastReviewedAt.',
        path: ['dueAt'],
      })
    }
    if (
      review.dueAt !== null &&
      review.lastReviewedAt !== null &&
      Date.parse(review.dueAt) < Date.parse(review.lastReviewedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A review cannot be due before it was last reviewed.',
        path: ['dueAt'],
      })
    }
  })
export type ReviewState = z.infer<typeof reviewStateSchema>

export const practiceSessionSubmissionResponseSchema = successResponseSchema(
  z
    .object({
      session: apiPracticeSessionSchema,
      stats: rangePracticeStatsSchema,
      review: reviewStateSchema,
    })
    .strict(),
)
export type PracticeSessionSubmissionResponse = z.infer<typeof practiceSessionSubmissionResponseSchema>

export const handAccuracyStatSchema = z
  .object({
    hand: handCodeSchema,
    attempts: attemptCountSchema,
    correct: attemptCountSchema,
    falsePositives: attemptCountSchema,
    falseNegatives: attemptCountSchema,
  })
  .strict()
  .superRefine((stat, context) => {
    if (stat.correct > stat.attempts) {
      context.addIssue({
        code: 'custom',
        message: 'Correct answers cannot exceed attempts.',
        path: ['correct'],
      })
      return
    }
    // Every miss is exactly one of the two directions, so the split has to
    // account for all of them: a report that loses one has lost which way the
    // user was wrong, which is the only thing the split is for.
    if (stat.falsePositives + stat.falseNegatives !== stat.attempts - stat.correct) {
      context.addIssue({
        code: 'custom',
        message: 'Missed attempts must split exactly into false positives and false negatives.',
        path: ['falsePositives'],
      })
    }
  })
export type HandAccuracyStat = z.infer<typeof handAccuracyStatSchema>

/** The 169 cells are the ceiling, and a hand reports its record once. */
const rangeHandAccuracySchema = z
  .array(handAccuracyStatSchema)
  .max(169)
  .superRefine((hands, context) => {
    const seen = new Set<string>()
    hands.forEach((stat, index) => {
      if (seen.has(stat.hand)) {
        context.addIssue({
          code: 'custom',
          message: 'A hand can appear only once in the accuracy report.',
          path: [index, 'hand'],
        })
      }
      seen.add(stat.hand)
    })
  })

/** Everything practice knows about one range: nulls mean "never practiced", not zero. */
export const rangePracticeReadSchema = z
  .object({
    rangeId: idSchema,
    stats: rangePracticeStatsSchema.nullable(),
    review: reviewStateSchema.nullable(),
    handAccuracy: rangeHandAccuracySchema,
    recentSessions: z.array(apiPracticeSessionSchema).max(20),
  })
  .strict()
export type RangePracticeRead = z.infer<typeof rangePracticeReadSchema>

export const rangePracticeReadResponseSchema = successResponseSchema(rangePracticeReadSchema)
export type RangePracticeReadResponse = z.infer<typeof rangePracticeReadResponseSchema>
