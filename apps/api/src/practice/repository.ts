import { createHash, randomUUID } from 'node:crypto'

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import {
  practiceSessionSubmissionResponseSchema,
  type PracticeSessionSubmission,
  type PracticeSessionSubmissionResponse,
  type RangePracticeRead,
} from '@poker-range-trainer/contracts'
import type { Database } from '@poker-range-trainer/database'
import {
  handClasses,
  practiceAttempts,
  practiceSessions,
  practiceSubmissionReplays,
  rangeHandAccuracy,
  rangeHands,
  rangePracticeStats,
  ranges,
  reviewStates,
  userTrainingGoals,
} from '@poker-range-trainer/database'
import { accuracyPercentage } from '@poker-range-trainer/domain/domain/accuracy'
import { practiceAccuracyPercentage } from '@poker-range-trainer/domain/domain/practiceStats'
import { rangeHandConfidence } from '@poker-range-trainer/domain/domain/practice'
import { normalizeRangeHands } from '@poker-range-trainer/domain/domain/rangeMath'
import {
  scheduleNextReview,
  seedReviewState,
} from '@poker-range-trainer/domain/domain/spacedRepetition'
import type { PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'
import type {
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangePracticeStats as RangePracticeStatsRecord,
  RangeReviewState,
} from '@poker-range-trainer/domain/types/practice'
import type { RangeMetadata, SavedRange } from '@poker-range-trainer/domain/types/range'

import { scorePracticeSubmission } from './scoring.js'
import type { LibrarySnapshot, PracticeRepository } from './service.js'

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
type RangeRow = typeof ranges.$inferSelect

/** How much session history one range read carries; the contract caps it there too. */
const RECENT_SESSION_LIMIT = 20

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

/** Scenario metadata is stored column-per-field; the domain shape omits what is absent. */
function snapshotMetadata(row: RangeRow): RangeMetadata | undefined {
  const metadata: RangeMetadata = {}
  if (row.gameType !== null) metadata.gameType = row.gameType
  if (row.tableSize !== null) metadata.tableSize = row.tableSize
  if (row.stackDepthBb !== null) metadata.stackDepthBb = Number(row.stackDepthBb)
  if (row.position !== null) metadata.position = row.position
  if (row.actionType !== null) metadata.actionType = row.actionType
  if (row.versusPosition !== null) metadata.versusPosition = row.versusPosition
  if (row.notes !== null) metadata.notes = row.notes
  return Object.keys(metadata).length === 0 ? undefined : metadata
}

function snapshotRange(row: RangeRow, hands: PokerHand[]): SavedRange {
  const metadata = snapshotMetadata(row)
  return {
    id: row.id,
    name: row.name,
    hands,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archived: row.archived,
    favorite: row.favorite,
    ...(metadata === undefined ? {} : { metadata }),
  }
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

  /**
   * Everything practice knows about one of the owner's live ranges.
   *
   * A deleted or someone else's range is indistinguishable here — both return
   * `undefined`, which the caller turns into the same 404, so this never
   * confirms that another owner's identifier exists.
   */
  async readRangePractice(userId: string, rangeId: string): Promise<RangePracticeRead | undefined> {
    const [range] = await this.database
      .select({ id: ranges.id })
      .from(ranges)
      .where(and(eq(ranges.id, rangeId), eq(ranges.userId, userId), isNull(ranges.deletedAt)))
      .limit(1)
    if (!range) return undefined

    const [stats] = await this.database
      .select()
      .from(rangePracticeStats)
      .where(and(eq(rangePracticeStats.userId, userId), eq(rangePracticeStats.rangeId, rangeId)))
      .limit(1)
    const [review] = await this.database
      .select()
      .from(reviewStates)
      .where(and(eq(reviewStates.userId, userId), eq(reviewStates.rangeId, rangeId)))
      .limit(1)
    // Canonical matrix order, so a client paints the 13x13 grid straight from
    // the response instead of re-sorting it into agreement with the app.
    const handRows = await this.database
      .select({
        handCode: rangeHandAccuracy.handCode,
        attempts: rangeHandAccuracy.attempts,
        correct: rangeHandAccuracy.correct,
        falsePositives: rangeHandAccuracy.falsePositives,
        falseNegatives: rangeHandAccuracy.falseNegatives,
      })
      .from(rangeHandAccuracy)
      .innerJoin(handClasses, eq(handClasses.code, rangeHandAccuracy.handCode))
      .where(and(eq(rangeHandAccuracy.userId, userId), eq(rangeHandAccuracy.rangeId, rangeId)))
      .orderBy(asc(handClasses.matrixOrder))
    const sessionRows = await this.database
      .select({
        id: practiceSessions.id,
        mode: practiceSessions.mode,
        totalQuestions: practiceSessions.totalQuestions,
        correctAnswers: practiceSessions.correctAnswers,
        completedAt: practiceSessions.completedAt,
      })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.rangeId, rangeId)))
      .orderBy(desc(practiceSessions.completedAt), desc(practiceSessions.id))
      .limit(RECENT_SESSION_LIMIT)

    return {
      rangeId,
      stats: stats
        ? {
            rangeId,
            totalAttempts: stats.totalAttempts,
            correctAttempts: stats.correctAttempts,
            accuracyPercentage: accuracyPercentage(stats.correctAttempts, stats.totalAttempts),
            lastPracticedAt: stats.lastPracticedAt?.toISOString() ?? null,
          }
        : null,
      review: review
        ? {
            rangeId,
            ease: Number(review.ease),
            intervalDays: review.intervalDays,
            dueAt: review.dueAt?.toISOString() ?? null,
            lastReviewedAt: review.lastReviewedAt?.toISOString() ?? null,
          }
        : null,
      handAccuracy: handRows.map((row) => ({
        hand: row.handCode as PokerHand,
        attempts: row.attempts,
        correct: row.correct,
        falsePositives: row.falsePositives,
        falseNegatives: row.falseNegatives,
      })),
      recentSessions: sessionRows.map((row) => ({
        id: row.id,
        rangeId,
        mode: row.mode,
        totalQuestions: row.totalQuestions,
        correctAnswers: row.correctAnswers,
        accuracyPercentage: accuracyPercentage(row.correctAnswers, row.totalQuestions),
        completedAt: row.completedAt.toISOString(),
      })),
    }
  }

  /**
   * The owner's live library and its practice records, in the legacy domain
   * shapes the Today and Progress reports are written against.
   *
   * Every table is read owner-scoped and restricted to non-deleted ranges, so
   * the projections stay scoped to the live library exactly like the on-device
   * `sessionsForLibrary` does — a soft-deleted range's sessions would otherwise
   * keep inflating volumes that every per-range cut beside them reports as gone.
   */
  async readLibrarySnapshot(userId: string): Promise<LibrarySnapshot> {
    const [goal] = await this.database
      .select({ dailyHandGoal: userTrainingGoals.dailyHandGoal })
      .from(userTrainingGoals)
      .where(eq(userTrainingGoals.userId, userId))
      .limit(1)
    const trainingGoal = goal?.dailyHandGoal ?? null

    const rangeRows = await this.database
      .select()
      .from(ranges)
      .where(and(eq(ranges.userId, userId), isNull(ranges.deletedAt)))
      .orderBy(asc(ranges.displayOrder), asc(ranges.id))
    if (rangeRows.length === 0) {
      return {
        ranges: [],
        sessions: {},
        practiceStats: {},
        handAccuracy: {},
        reviewStates: {},
        trainingGoal,
      }
    }
    const liveIds = rangeRows.map((row) => row.id)

    const handRows = await this.database
      .select({ rangeId: rangeHands.rangeId, handCode: rangeHands.handCode })
      .from(rangeHands)
      .where(and(eq(rangeHands.userId, userId), inArray(rangeHands.rangeId, liveIds)))
      .orderBy(asc(rangeHands.handCode))
    const handsByRange = new Map<string, PokerHand[]>()
    for (const row of handRows) {
      const hands = handsByRange.get(row.rangeId) ?? []
      hands.push(row.handCode as PokerHand)
      handsByRange.set(row.rangeId, hands)
    }

    const sessionRows = await this.database
      .select({
        rangeId: practiceSessions.rangeId,
        completedAt: practiceSessions.completedAt,
        totalQuestions: practiceSessions.totalQuestions,
        correctAnswers: practiceSessions.correctAnswers,
      })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), inArray(practiceSessions.rangeId, liveIds)))
      .orderBy(asc(practiceSessions.completedAt))
    const sessions: Record<string, PracticeSessionRecord[]> = {}
    for (const row of sessionRows) {
      const records = sessions[row.rangeId] ?? []
      records.push({
        rangeId: row.rangeId,
        playedAt: row.completedAt.toISOString(),
        totalQuestions: row.totalQuestions,
        correctAnswers: row.correctAnswers,
      })
      sessions[row.rangeId] = records
    }

    // A zero-attempt row carries no history; the legacy shape has no way to say
    // "practiced at nothing", and every report treats it as absent anyway.
    const statsRows = await this.database
      .select()
      .from(rangePracticeStats)
      .where(
        and(
          eq(rangePracticeStats.userId, userId),
          inArray(rangePracticeStats.rangeId, liveIds),
          isNotNull(rangePracticeStats.lastPracticedAt),
        ),
      )
    const practiceStats: Record<string, RangePracticeStatsRecord> = {}
    for (const row of statsRows) {
      if (!row.lastPracticedAt) continue
      practiceStats[row.rangeId] = {
        rangeId: row.rangeId,
        totalAttempts: row.totalAttempts,
        correctAttempts: row.correctAttempts,
        lastPracticedAt: row.lastPracticedAt.toISOString(),
      }
    }

    const accuracyRows = await this.database
      .select({
        rangeId: rangeHandAccuracy.rangeId,
        handCode: rangeHandAccuracy.handCode,
        attempts: rangeHandAccuracy.attempts,
        correct: rangeHandAccuracy.correct,
        falsePositives: rangeHandAccuracy.falsePositives,
        falseNegatives: rangeHandAccuracy.falseNegatives,
      })
      .from(rangeHandAccuracy)
      .where(and(eq(rangeHandAccuracy.userId, userId), inArray(rangeHandAccuracy.rangeId, liveIds)))
      .orderBy(asc(rangeHandAccuracy.handCode))
    const handAccuracy: Record<string, RangeHandAccuracy> = {}
    for (const row of accuracyRows) {
      const perRange = handAccuracy[row.rangeId] ?? ({} as RangeHandAccuracy)
      perRange[row.handCode as PokerHand] = {
        hand: row.handCode as PokerHand,
        attempts: row.attempts,
        correct: row.correct,
        falsePositives: row.falsePositives,
        falseNegatives: row.falseNegatives,
      }
      handAccuracy[row.rangeId] = perRange
    }

    const reviewRows = await this.database
      .select()
      .from(reviewStates)
      .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.rangeId, liveIds)))
    const reviews: Record<string, RangeReviewState> = {}
    for (const row of reviewRows) {
      reviews[row.rangeId] = {
        rangeId: row.rangeId,
        ease: Number(row.ease),
        intervalDays: row.intervalDays,
        // The legacy shape spells "never scheduled" as an empty string.
        dueAt: row.dueAt?.toISOString() ?? '',
        lastReviewedAt: row.lastReviewedAt?.toISOString() ?? '',
      }
    }

    return {
      ranges: rangeRows.map((row) => snapshotRange(row, handsByRange.get(row.id) ?? [])),
      sessions,
      practiceStats,
      handAccuracy,
      reviewStates: reviews,
      trainingGoal,
    }
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
