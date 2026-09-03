import {
  progressReadModelSchema,
  rangePracticeReadSchema,
  todayReadModelSchema,
  type PracticeSessionSubmission,
  type PracticeSessionSubmissionResponse,
  type ProgressReadModel,
  type RangePracticeRead,
  type TodayReadModel,
} from '@poker-range-trainer/contracts'
import {
  isoDateOfDayNumber,
  zonedCalendarDays,
  type CalendarDays,
} from '@poker-range-trainer/domain/domain/calendarDay'
import { suggestFreePractice } from '@poker-range-trainer/domain/domain/freePractice'
import { rankHandClassLeaks } from '@poker-range-trainer/domain/domain/leakReport'
import { summarizeLibraryAnalytics } from '@poker-range-trainer/domain/domain/libraryAnalytics'
import {
  mistakeBiasByPosition,
  positionBiasPools,
  summarizeMistakeBias,
} from '@poker-range-trainer/domain/domain/mistakeBias'
import { practiceAccuracyPercentage } from '@poker-range-trainer/domain/domain/practiceStats'
import {
  currentStreak,
  selectDueRanges,
} from '@poker-range-trainer/domain/domain/spacedRepetition'
import { evaluateDailyGoal } from '@poker-range-trainer/domain/domain/trainingGoal'
import { rankWeakHands } from '@poker-range-trainer/domain/domain/weakHands'
import {
  dailyHandCounts,
  summarizeWeek,
  weeklyAccuracyTrend,
} from '@poker-range-trainer/domain/domain/weeklyStats'
import type {
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangePracticeStats,
  RangeReviewState,
} from '@poker-range-trainer/domain/types/practice'
import type { SavedRange } from '@poker-range-trainer/domain/types/range'

import { PracticeRangeNotFoundError, type Clock } from './repository.js'

/**
 * One owner's live library in the shapes the domain reports were written for.
 *
 * Today and Progress are the legacy on-device screens moved to the server, and
 * every number on them already has a tested pure function behind it. Loading the
 * records back in the legacy shapes lets those functions be reused verbatim,
 * rather than re-deriving the same analytics in SQL where they would drift.
 *
 * Scoped to non-deleted ranges — sessions of a deleted range would inflate the
 * volume figures while every per-range cut beside them reported nothing.
 */
export interface LibrarySnapshot {
  ranges: SavedRange[]
  sessions: Record<string, PracticeSessionRecord[]>
  practiceStats: Record<string, RangePracticeStats>
  handAccuracy: Record<string, RangeHandAccuracy>
  reviewStates: Record<string, RangeReviewState>
  /** Daily hands target, or null when the owner has not set one. */
  trainingGoal: number | null
}

export interface PracticeRepository {
  submit(
    userId: string,
    submission: PracticeSessionSubmission,
  ): Promise<PracticeSessionSubmissionResponse>
  /** `undefined` when the range is not one of the owner's live ranges. */
  readRangePractice(userId: string, rangeId: string): Promise<RangePracticeRead | undefined>
  readLibrarySnapshot(userId: string): Promise<LibrarySnapshot>
}

const TODAY_WINDOW_DAYS = 7
const PROGRESS_WINDOW_DAYS = 30
const ACTIVITY_DAYS = 7
const TREND_WEEKS = 8
const MAX_DUE_RANGES = 100
const MAX_WEAK_HANDS = 20

function playedAtOf(sessions: Record<string, PracticeSessionRecord[]>): string[] {
  return Object.values(sessions).flatMap((records) => records.map((record) => record.playedAt))
}

/**
 * The sharpest range's own counters over the same window that ranked it.
 *
 * `summarizeWeek` names the range but reports library totals, and the contract
 * requires the named range's counters to sit inside those totals. Running the
 * same summary over that one range's history is what keeps the two agreeing —
 * counting its hands separately here would be a second implementation of the
 * window, free to disagree with the first.
 */
function sharpestRangeSummary(
  rangeId: string | null,
  ranges: SavedRange[],
  sessions: Record<string, PracticeSessionRecord[]>,
  now: string,
  calendar: CalendarDays,
) {
  if (rangeId === null) return null
  const range = ranges.find((candidate) => candidate.id === rangeId)
  if (!range) return null
  const own = summarizeWeek({ [rangeId]: sessions[rangeId] ?? [] }, now, TODAY_WINDOW_DAYS, calendar)
  return {
    id: range.id,
    name: range.name,
    handsAnswered: own.handsAnswered,
    correctAnswers: own.correctAnswers,
    accuracyPercentage: own.accuracy,
  }
}

/**
 * Application boundary for practice. It owns no persistence and no framework:
 * the repository loads records, the domain does the maths, and every projection
 * leaves through its contract schema so an inconsistent read model fails here
 * rather than reaching a client.
 */
export class PracticeService {
  constructor(
    private readonly repository: PracticeRepository,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  submit(
    userId: string,
    submission: PracticeSessionSubmission,
  ): Promise<PracticeSessionSubmissionResponse> {
    return this.repository.submit(userId, submission)
  }

  async readRange(userId: string, rangeId: string): Promise<RangePracticeRead> {
    const read = await this.repository.readRangePractice(userId, rangeId)
    if (!read) throw new PracticeRangeNotFoundError()
    return rangePracticeReadSchema.parse(read)
  }

  /** `timeZone` must be an installed IANA zone; the router validates it first. */
  async today(userId: string, timeZone: string): Promise<TodayReadModel> {
    const calendar = zonedCalendarDays(timeZone)
    const generatedAt = this.clock.now().toISOString()
    const snapshot = await this.repository.readLibrarySnapshot(userId)
    const { handAccuracy, practiceStats, ranges, reviewStates, sessions } = snapshot

    const goal = evaluateDailyGoal(sessions, generatedAt, snapshot.trainingGoal ?? 0, calendar)
    const week = summarizeWeek(sessions, generatedAt, TODAY_WINDOW_DAYS, calendar)
    const dueRanges = selectDueRanges(
      ranges.filter((range) => !range.archived),
      reviewStates,
      generatedAt,
      calendar,
    )
      .slice(0, MAX_DUE_RANGES)
      .map((range) => {
        const stats = practiceStats[range.id]
        return {
          id: range.id,
          name: range.name,
          dueAt: reviewStates[range.id]?.dueAt || null,
          accuracyPercentage: stats ? practiceAccuracyPercentage(stats) : null,
          lastPracticedAt: stats?.lastPracticedAt ?? null,
        }
      })
    const caughtUp = dueRanges.length === 0
    // Only offered with nothing due: a suggestion beside a review queue would be
    // advice to skip the queue.
    const suggestion = caughtUp
      ? suggestFreePractice({ ranges, handAccuracy, reviewStates, now: generatedAt })
      : null

    return todayReadModelSchema.parse({
      generatedAt,
      streakDays: currentStreak(playedAtOf(sessions), generatedAt, calendar),
      dailyGoal: {
        target: snapshot.trainingGoal,
        handsAnswered: goal.answered,
        remainingHands: goal.remaining,
      },
      trailingSevenDays: {
        handsAnswered: week.handsAnswered,
        correctAnswers: week.correctAnswers,
        accuracyPercentage: week.accuracy,
        sharpestRange: sharpestRangeSummary(
          week.sharpestRangeId,
          ranges,
          sessions,
          generatedAt,
          calendar,
        ),
      },
      dueRanges,
      caughtUp,
      freePractice:
        suggestion === null
          ? null
          : suggestion.kind === 'weakHands'
            ? {
                kind: 'weakHands' as const,
                rangeIds: suggestion.ranges.map((range) => range.id),
                pools: suggestion.pools,
                handCount: suggestion.handCount,
              }
            : { kind: 'reviewEarly' as const, rangeId: suggestion.range.id, dueAt: suggestion.dueAt },
    })
  }

  /** `timeZone` must be an installed IANA zone; the router validates it first. */
  async progress(userId: string, timeZone: string): Promise<ProgressReadModel> {
    const calendar = zonedCalendarDays(timeZone)
    const generatedAt = this.clock.now().toISOString()
    const snapshot = await this.repository.readLibrarySnapshot(userId)
    const { handAccuracy, practiceStats, ranges, sessions } = snapshot

    const allTime = summarizeLibraryAnalytics(Object.values(practiceStats))
    const thirtyDays = summarizeWeek(sessions, generatedAt, PROGRESS_WINDOW_DAYS, calendar)

    return progressReadModelSchema.parse({
      generatedAt,
      streakDays: currentStreak(playedAtOf(sessions), generatedAt, calendar),
      allTime: {
        rangesPracticed: allTime.rangesPracticed,
        handsAnswered: allTime.totalAttempts,
        correctAnswers: allTime.totalCorrect,
        accuracyPercentage: allTime.overallAccuracy,
      },
      trailingThirtyDays: {
        handsAnswered: thirtyDays.handsAnswered,
        correctAnswers: thirtyDays.correctAnswers,
        accuracyPercentage: thirtyDays.accuracy,
      },
      dailyActivity: dailyHandCounts(sessions, generatedAt, ACTIVITY_DAYS, calendar).map((day) => ({
        day: isoDateOfDayNumber(day.dayNumber),
        handsAnswered: day.handsAnswered,
      })),
      weeklyAccuracyTrend: weeklyAccuracyTrend(sessions, generatedAt, TREND_WEEKS, calendar).map(
        (point) => ({
          weekStart: isoDateOfDayNumber(point.weekStartDayNumber),
          handsAnswered: point.handsAnswered,
          correctAnswers: point.correctAnswers,
          accuracyPercentage: point.accuracy,
        }),
      ),
      handClassLeaks: rankHandClassLeaks(handAccuracy).map((leak) => ({
        handClass: leak.handClass,
        attempts: leak.attempts,
        correct: leak.correct,
        accuracyPercentage: leak.accuracy,
        missedHands: leak.missedHands,
        pools: leak.pools,
      })),
      mistakeBias: summarizeMistakeBias(handAccuracy),
      positionLeans: mistakeBiasByPosition(ranges, handAccuracy).map((lean) => ({
        position: lean.position,
        summary: lean.summary,
        pools: positionBiasPools(ranges, handAccuracy, lean),
      })),
      weakestHands: rankWeakHands(handAccuracy, MAX_WEAK_HANDS).map((entry) => ({
        rangeId: entry.rangeId,
        hand: entry.hand,
        attempts: entry.attempts,
        correct: entry.correct,
        accuracyPercentage: entry.accuracy,
      })),
    })
  }
}
