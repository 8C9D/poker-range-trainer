import { createHash, randomUUID } from 'node:crypto'

import { and, asc, eq, sql } from 'drizzle-orm'

import {
  practiceSessionSubmissionResponseSchema,
  type PracticeSessionSubmission,
  type PracticeSessionSubmissionResponse,
} from '@poker-range-trainer/contracts'
import type { Database } from '@poker-range-trainer/database'
import {
  practiceAttempts,
  practiceSessions,
  practiceSubmissionReplays,
  rangeHandAccuracy,
  rangeHands,
  rangePracticeStats,
  ranges,
  reviewStates,
} from '@poker-range-trainer/database'
import { practiceAccuracyPercentage } from '@poker-range-trainer/domain/domain/practiceStats'
import { rangeHandConfidence } from '@poker-range-trainer/domain/domain/practice'
import { normalizeRangeHands } from '@poker-range-trainer/domain/domain/rangeMath'
import {
  scheduleNextReview,
  seedReviewState,
} from '@poker-range-trainer/domain/domain/spacedRepetition'
import type { PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'
import type { RangeHandAccuracy } from '@poker-range-trainer/domain/types/practice'

import { scorePracticeSubmission } from './scoring.js'
import type { PracticeRepository } from './service.js'

export interface Clock {
  now(): Date
}

export class PracticeRangeNotFoundError extends Error {
  readonly code = 'PRACTICE_RANGE_NOT_FOUND'
  constructor() {
    super('Range not found.')
    this.name = 'PracticeRangeNotFoundError'
  }
}

export class PracticeIdempotencyConflictError extends Error {
  readonly code = 'PRACTICE_IDEMPOTENCY_CONFLICT'
  constructor() {
    super('This idempotency key was already used for a different submission.')
    this.name = 'PracticeIdempotencyConflictError'
  }
}

export class PracticeUnscorableError extends Error {
  readonly code = 'PRACTICE_UNSCORABLE'
  constructor() {
    super('The submission contains no scorable decisions.')
    this.name = 'PracticeUnscorableError'
  }
}

/** A committed replay must always be parseable through the public response contract. */
export class PracticeReplayCorruptedError extends Error {
  readonly code = 'PRACTICE_REPLAY_CORRUPTED'
  constructor() {
    super('The stored practice replay is invalid.')
    this.name = 'PracticeReplayCorruptedError'
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type Queryable = Database | Transaction

function requestFingerprint(submission: PracticeSessionSubmission): string {
  const canonical =
    submission.mode === 'build'
      ? {
          mode: submission.mode,
          rangeId: submission.rangeId,
          idempotencyKey: submission.idempotencyKey,
          selectedHands: normalizeRangeHands(submission.selectedHands),
        }
      : {
          mode: submission.mode,
          rangeId: submission.rangeId,
          idempotencyKey: submission.idempotencyKey,
          answers: submission.answers
            .map((answer) => ({
              questionId: answer.questionId,
              hand: answer.hand,
              answer: answer.answer,
              answeredAt: answer.answeredAt,
            }))
            .sort((left, right) => left.questionId.localeCompare(right.questionId)),
        }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function asRangeHandAccuracy(
  rows: {
    handCode: string
    attempts: number
    correct: number
    falsePositives: number
    falseNegatives: number
  }[],
): RangeHandAccuracy {
  return Object.fromEntries(
    rows.map((row) => [
      row.handCode as PokerHand,
      {
        hand: row.handCode as PokerHand,
        attempts: row.attempts,
        correct: row.correct,
        falsePositives: row.falsePositives,
        falseNegatives: row.falseNegatives,
      },
    ]),
  ) as RangeHandAccuracy
}

/** PostgreSQL practice persistence: a completed submission and its replay are one transaction. */
export class PostgresPracticeRepository implements PracticeRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  async submit(
    userId: string,
    submission: PracticeSessionSubmission,
  ): Promise<PracticeSessionSubmissionResponse> {
    const fingerprint = requestFingerprint(submission)
    return this.database.transaction(async (transaction) => {
      // Same-owner same-key submissions queue here; distinct ranges remain concurrent.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${submission.idempotencyKey}`}))`,
      )
      const replay = await this.findReplay(transaction, userId, submission.idempotencyKey)
      if (replay) {
        if (replay.requestFingerprint !== fingerprint) throw new PracticeIdempotencyConflictError()
        const parsed = practiceSessionSubmissionResponseSchema.safeParse(replay.responseSnapshot)
        if (!parsed.success) throw new PracticeReplayCorruptedError()
        return parsed.data
      }

      await this.lockActiveRange(transaction, userId, submission.rangeId)
      const hands = await this.lockedRangeHands(transaction, userId, submission.rangeId)
      const scored = scorePracticeSubmission(submission, hands)
      if (scored.totalQuestions === 0) throw new PracticeUnscorableError()
      const completedAt = this.clock.now()
      const sessionId = randomUUID()

      await transaction.insert(practiceSessions).values({
        id: sessionId,
        userId,
        rangeId: submission.rangeId,
        mode: submission.mode,
        idempotencyKey: submission.idempotencyKey,
        totalQuestions: scored.totalQuestions,
        correctAnswers: scored.correctAnswers,
        completedAt,
        createdAt: completedAt,
      })
      if (scored.attempts.length > 0) {
        await transaction.insert(practiceAttempts).values(
          scored.attempts.map((attempt) => ({
            sessionId,
            userId,
            rangeId: submission.rangeId,
            questionId: attempt.questionId,
            handCode: attempt.hand,
            expectedInRange: attempt.expectedInRange,
            userAnsweredInRange: attempt.userAnsweredInRange,
            correct: attempt.correct,
            answeredAt: new Date(attempt.answeredAt),
          })),
        )
      }

      const stats = await this.upsertStats(
        transaction,
        userId,
        submission.rangeId,
        scored.totalQuestions,
        scored.correctAnswers,
        completedAt,
      )
      await this.upsertHandAccuracy(transaction, userId, submission.rangeId, scored.handAccuracy)
      const cumulativeHands = await this.readHandAccuracy(transaction, userId, submission.rangeId)
      const review = await this.advanceReview(
        transaction,
        userId,
        submission.rangeId,
        scored.accuracyPercentage,
        completedAt,
        rangeHandConfidence(cumulativeHands),
      )
      const lastPracticedAt = stats.lastPracticedAt
      if (!lastPracticedAt) throw new Error('Practice stats are missing lastPracticedAt.')
      const response = practiceSessionSubmissionResponseSchema.parse({
        data: {
          session: {
            id: sessionId,
            rangeId: submission.rangeId,
            mode: submission.mode,
            totalQuestions: scored.totalQuestions,
            correctAnswers: scored.correctAnswers,
            accuracyPercentage: scored.accuracyPercentage,
            completedAt: completedAt.toISOString(),
          },
          stats: {
            rangeId: submission.rangeId,
            totalAttempts: stats.totalAttempts,
            correctAttempts: stats.correctAttempts,
            accuracyPercentage: practiceAccuracyPercentage({
              rangeId: submission.rangeId,
              totalAttempts: stats.totalAttempts,
              correctAttempts: stats.correctAttempts,
              lastPracticedAt: lastPracticedAt.toISOString(),
            }),
            lastPracticedAt: lastPracticedAt.toISOString(),
          },
          review,
        },
      })
      await transaction.insert(practiceSubmissionReplays).values({
        userId,
        rangeId: submission.rangeId,
        idempotencyKey: submission.idempotencyKey,
        requestFingerprint: fingerprint,
        sessionId,
        responseSnapshot: response,
        createdAt: completedAt,
      })
      return response
    })
  }

  private async findReplay(transaction: Queryable, userId: string, idempotencyKey: string) {
    const [row] = await transaction
      .select({
        requestFingerprint: practiceSubmissionReplays.requestFingerprint,
        responseSnapshot: practiceSubmissionReplays.responseSnapshot,
      })
      .from(practiceSubmissionReplays)
      .where(
        and(
          eq(practiceSubmissionReplays.userId, userId),
          eq(practiceSubmissionReplays.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1)
    return row
  }

  private async lockActiveRange(
    transaction: Queryable,
    userId: string,
    rangeId: string,
  ): Promise<void> {
    const result = await transaction.execute(sql`
      select ${ranges.id} from ${ranges}
      where ${ranges.id} = ${rangeId} and ${ranges.userId} = ${userId} and ${ranges.deletedAt} is null
      for update
    `)
    if (result.rows.length !== 1) throw new PracticeRangeNotFoundError()
  }

  private async lockedRangeHands(
    transaction: Queryable,
    userId: string,
    rangeId: string,
  ): Promise<PokerHand[]> {
    const rows = await transaction
      .select({ handCode: rangeHands.handCode })
      .from(rangeHands)
      .where(and(eq(rangeHands.userId, userId), eq(rangeHands.rangeId, rangeId)))
      .orderBy(asc(rangeHands.handCode))
    return rows.map((row) => row.handCode as PokerHand)
  }

  private async upsertStats(
    transaction: Queryable,
    userId: string,
    rangeId: string,
    total: number,
    correct: number,
    completedAt: Date,
  ) {
    await transaction
      .insert(rangePracticeStats)
      .values({
        rangeId,
        userId,
        totalAttempts: total,
        correctAttempts: correct,
        lastPracticedAt: completedAt,
      })
      .onConflictDoUpdate({
        target: [rangePracticeStats.rangeId, rangePracticeStats.userId],
        set: {
          totalAttempts: sql`${rangePracticeStats.totalAttempts} + ${total}`,
          correctAttempts: sql`${rangePracticeStats.correctAttempts} + ${correct}`,
          lastPracticedAt: sql`greatest(${rangePracticeStats.lastPracticedAt}, excluded.last_practiced_at)`,
        },
      })
    const [stats] = await transaction
      .select()
      .from(rangePracticeStats)
      .where(and(eq(rangePracticeStats.userId, userId), eq(rangePracticeStats.rangeId, rangeId)))
      .limit(1)
    if (!stats?.lastPracticedAt) throw new Error('Practice stats did not return a persisted row.')
    return stats
  }

  private async upsertHandAccuracy(
    transaction: Queryable,
    userId: string,
    rangeId: string,
    entries: ReturnType<typeof scorePracticeSubmission>['handAccuracy'],
  ): Promise<void> {
    for (const entry of entries) {
      await transaction
        .insert(rangeHandAccuracy)
        .values({
          rangeId,
          userId,
          handCode: entry.hand,
          attempts: entry.attempts,
          correct: entry.correct,
          falsePositives: entry.falsePositives,
          falseNegatives: entry.falseNegatives,
        })
        .onConflictDoUpdate({
          target: [rangeHandAccuracy.rangeId, rangeHandAccuracy.handCode],
          set: {
            attempts: sql`${rangeHandAccuracy.attempts} + ${entry.attempts}`,
            correct: sql`${rangeHandAccuracy.correct} + ${entry.correct}`,
            falsePositives: sql`${rangeHandAccuracy.falsePositives} + ${entry.falsePositives}`,
            falseNegatives: sql`${rangeHandAccuracy.falseNegatives} + ${entry.falseNegatives}`,
          },
        })
    }
  }

  private async readHandAccuracy(
    transaction: Queryable,
    userId: string,
    rangeId: string,
  ): Promise<RangeHandAccuracy> {
    const rows = await transaction
      .select({
        handCode: rangeHandAccuracy.handCode,
        attempts: rangeHandAccuracy.attempts,
        correct: rangeHandAccuracy.correct,
        falsePositives: rangeHandAccuracy.falsePositives,
        falseNegatives: rangeHandAccuracy.falseNegatives,
      })
      .from(rangeHandAccuracy)
      .where(and(eq(rangeHandAccuracy.userId, userId), eq(rangeHandAccuracy.rangeId, rangeId)))
      .orderBy(asc(rangeHandAccuracy.handCode))
    return asRangeHandAccuracy(rows)
  }

  private async advanceReview(
    transaction: Queryable,
    userId: string,
    rangeId: string,
    accuracy: number,
    completedAt: Date,
    confidence: number,
  ) {
    const locked = await transaction.execute(sql`
      select ${reviewStates.ease} as "ease", ${reviewStates.intervalDays} as "intervalDays",
        ${reviewStates.dueAt} as "dueAt", ${reviewStates.lastReviewedAt} as "lastReviewedAt"
      from ${reviewStates}
      where ${reviewStates.userId} = ${userId} and ${reviewStates.rangeId} = ${rangeId}
      for update
    `)
    const previous = locked.rows[0] as
      | {
          ease: string | number
          intervalDays: number
          dueAt: Date | string | null
          lastReviewedAt: Date | string | null
        }
      | undefined
    const prev = previous
      ? {
          rangeId,
          ease: Number(previous.ease),
          intervalDays: previous.intervalDays,
          dueAt: previous.dueAt ? new Date(previous.dueAt).toISOString() : '',
          lastReviewedAt: previous.lastReviewedAt
            ? new Date(previous.lastReviewedAt).toISOString()
            : '',
        }
      : seedReviewState(rangeId)
    const next = scheduleNextReview(prev, accuracy, completedAt.toISOString(), confidence)
    await transaction
      .insert(reviewStates)
      .values({
        rangeId,
        userId,
        ease: String(next.ease),
        intervalDays: next.intervalDays,
        dueAt: new Date(next.dueAt),
        lastReviewedAt: new Date(next.lastReviewedAt),
      })
      .onConflictDoUpdate({
        target: [reviewStates.rangeId, reviewStates.userId],
        set: {
          ease: String(next.ease),
          intervalDays: next.intervalDays,
          dueAt: new Date(next.dueAt),
          lastReviewedAt: new Date(next.lastReviewedAt),
        },
      })
    return {
      rangeId,
      ease: next.ease,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      lastReviewedAt: next.lastReviewedAt,
    }
  }
}
