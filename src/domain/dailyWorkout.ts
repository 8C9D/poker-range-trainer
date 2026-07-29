import { localCalendarDay } from './calendarDay'
import { selectDueRanges } from './spacedRepetition'
import { describeSpot, spotKey } from './spot'
import { inferLibraryContext } from './spotCoverage'
import { coveredSpots } from './spotDrill'
import { rankSpotLeaks, type SpotLeak } from './spotLeaks'
import { DEFAULT_GOAL_HANDS } from './trainingGoal'
import type { RangeReviewState, SpotAccuracyStat } from '../types/practice'
import type { SavedRange, TableSize } from '../types/range'

/**
 * The daily workout (v9.0): one plan composed from what the app already knows.
 *
 * The signals exist separately — what is due (spaced repetition), where the
 * user leaks (per-spot accuracy), what the library covers (spot coverage) — and
 * until now the user assembled a session from them by hand. This folds them
 * into one ordered plan: review what is due, drill the worst spots, finish on
 * free play, sized to the daily goal. Pure; the caller supplies every input.
 */

/** A workout never drills more than this many due ranges in one run. */
export const MAX_REVIEW_RANGES = 3
/** A workout never targets more than this many weak spots in one run. */
export const MAX_WEAK_SPOTS = 3
/** A recorded spot only counts as weak below this accuracy (0–100). */
export const WEAK_SPOT_ACCURACY_BELOW = 80
/** No segment is dealt fewer questions than this — shorter is not a session. */
export const MIN_SEGMENT_QUESTIONS = 5
/** Matches the Today screen's pace estimate (20 questions ≈ 1.5 minutes). */
const QUESTIONS_PER_MINUTE = 13

export interface WorkoutFormat {
  tableSize: TableSize
  stackDepthBb: number
}

export interface ReviewSegment {
  kind: 'review'
  /** The due ranges to drill, in due order, capped at MAX_REVIEW_RANGES. */
  ranges: SavedRange[]
  questionsPerRange: number
  reason: string
}

export interface WeakSpotsSegment {
  kind: 'weakSpots'
  /** Weakest first; all at `format`, all still covered by the library. */
  leaks: SpotLeak[]
  spotKeys: string[]
  format: WorkoutFormat
  questionCount: number
  reason: string
}

export interface FreshSpotsSegment {
  kind: 'freshSpots'
  format: WorkoutFormat
  /** Covered spots not already assigned to the weak-spots segment. */
  spotKeys: string[]
  questionCount: number
  reason: string
}

export type WorkoutSegment = ReviewSegment | WeakSpotsSegment | FreshSpotsSegment

export interface DailyWorkout {
  /** In play order: review, then weak spots, then fresh play (present ones only). */
  segments: WorkoutSegment[]
  totalQuestions: number
  estimatedMinutes: number
}

export interface DailyWorkoutInput {
  ranges: SavedRange[]
  reviewStates: Record<string, RangeReviewState>
  spotAccuracy: Record<string, SpotAccuracyStat>
  /** ISO-8601 "now", supplied so the plan is reproducible. */
  now: string
  /** The daily goal in hands; 0 (goal off) falls back to the default size. */
  goalHands: number
}

/**
 * Compose today's workout, or return `null` when there is nothing to plan
 * (no due ranges, no qualifying weak spots, and no spot coverage).
 *
 * Sizing: the goal's hand count is split evenly across the present segments,
 * with a floor per segment — so the run lands near the goal rather than
 * exactly on it. The weak-spot segment is pinned to one format (a spot drill
 * runs at one table size and depth), chosen by the weakest qualifying leak.
 */
export function buildDailyWorkout(input: DailyWorkoutInput): DailyWorkout | null {
  const { ranges, reviewStates, spotAccuracy, now, goalHands } = input
  const active = ranges.filter((range) => !range.archived)

  const due = selectDueRanges(active, reviewStates, now)
  const reviewRanges = due.slice(0, MAX_REVIEW_RANGES)
  const weak = selectWeakSpots(ranges, spotAccuracy)
  const libraryFormat = inferLibraryContext(ranges)
  const covered = coveredSpots(ranges, libraryFormat.tableSize, libraryFormat.stackDepthBb)
  // Fresh play is the remainder of the covered library at its default format.
  // When the weak-spots segment uses that same format, remove those prompts so
  // the two back-to-back segments cannot drill the same spots.
  const weakKeysAtLibraryFormat =
    weak !== null && sameFormat(weak.format, libraryFormat) ? new Set(weak.keys) : null
  const freshSpotKeys = covered
    .map((entry) => spotKey(entry.spot))
    .filter((key) => !weakKeysAtLibraryFormat?.has(key))
  const hasFreshSpots = freshSpotKeys.length > 0

  // Each due range is its own recognition drill, so it is one sizing unit even
  // though the runner groups all review drills under one hand-off. Counting the
  // review group as a single unit makes a capped three-range review consume up
  // to three times its intended share of the daily goal.
  const workoutUnits =
    reviewRanges.length + (weak ? 1 : 0) + (hasFreshSpots ? 1 : 0)
  if (workoutUnits === 0) return null

  const budget = goalHands > 0 ? goalHands : DEFAULT_GOAL_HANDS
  const share = Math.max(MIN_SEGMENT_QUESTIONS, Math.round(budget / workoutUnits))

  const segments: WorkoutSegment[] = []

  if (reviewRanges.length > 0) {
    segments.push({
      kind: 'review',
      ranges: reviewRanges,
      questionsPerRange: share,
      reason:
        due.length > reviewRanges.length
          ? `${reviewRanges.length} of your ${due.length} due ranges.`
          : `${due.length} range${due.length === 1 ? '' : 's'} due for review.`,
    })
  }

  if (weak) {
    const worst = weak.leaks[0]
    segments.push({
      kind: 'weakSpots',
      leaks: weak.leaks,
      spotKeys: weak.keys,
      format: weak.format,
      questionCount: share,
      reason:
        weak.leaks.length === 1
          ? `${worst.accuracy.toFixed(0)}% so far — ${describeSpot(worst.spot)}`
          : `Your ${weak.leaks.length} weakest spots, starting at ${worst.accuracy.toFixed(0)}%.`,
    })
  }

  if (hasFreshSpots) {
    segments.push({
      kind: 'freshSpots',
      format: libraryFormat,
      spotKeys: freshSpotKeys,
      questionCount: share,
      reason: `Free play across ${freshSpotKeys.length} other covered spot${freshSpotKeys.length === 1 ? '' : 's'}.`,
    })
  }

  const totalQuestions = segments.reduce(
    (sum, segment) =>
      sum +
      (segment.kind === 'review'
        ? segment.ranges.length * segment.questionsPerRange
        : segment.questionCount),
    0,
  )
  return {
    segments,
    totalQuestions,
    estimatedMinutes: Math.max(1, Math.round(totalQuestions / QUESTIONS_PER_MINUTE)),
  }
}

/**
 * The weakest recorded spots worth a segment: below the accuracy bar, still
 * covered by the current library, and all at one format so a single spot-drill
 * run can deal them. The weakest qualifying leak picks the format.
 */
function selectWeakSpots(
  ranges: SavedRange[],
  spotAccuracy: Record<string, SpotAccuracyStat>,
): { leaks: SpotLeak[]; keys: string[]; format: WorkoutFormat } | null {
  const candidates = rankSpotLeaks(spotAccuracy).filter(
    (leak) => leak.accuracy < WEAK_SPOT_ACCURACY_BELOW,
  )
  if (candidates.length === 0) return null

  const coveredByFormat = new Map<string, Set<string>>()
  const coveredKeys = (format: WorkoutFormat): Set<string> => {
    const cacheKey = `${format.tableSize}:${format.stackDepthBb}`
    let keys = coveredByFormat.get(cacheKey)
    if (!keys) {
      keys = new Set(
        coveredSpots(ranges, format.tableSize, format.stackDepthBb).map((entry) =>
          spotKey(entry.spot),
        ),
      )
      coveredByFormat.set(cacheKey, keys)
    }
    return keys
  }

  let format: WorkoutFormat | null = null
  const leaks: SpotLeak[] = []
  for (const leak of candidates) {
    if (leaks.length >= MAX_WEAK_SPOTS) break
    const leakFormat = {
      tableSize: leak.spot.tableSize,
      stackDepthBb: leak.spot.stackDepthBb,
    }
    if (format && !sameFormat(format, leakFormat)) continue
    if (!coveredKeys(leakFormat).has(spotKey(leak.spot))) continue
    format ??= leakFormat
    leaks.push(leak)
  }
  if (!format) return null
  return { leaks, keys: leaks.map((leak) => spotKey(leak.spot)), format }
}

function sameFormat(a: WorkoutFormat, b: WorkoutFormat): boolean {
  return a.tableSize === b.tableSize && a.stackDepthBb === b.stackDepthBb
}

/**
 * Whether a recorded completion falls on the same local calendar day as `now`
 * (v9.2) — the same day bucketing the streak and the daily goal use. A missing or
 * unparseable record counts as not completed.
 */
export function workoutCompletedToday(lastCompletedAt: string | null, now: string): boolean {
  if (!lastCompletedAt) return false
  const completedDay = localCalendarDay(lastCompletedAt)
  const currentDay = localCalendarDay(now)
  return completedDay !== null && currentDay !== null && completedDay === currentDay
}

/** The heading a segment goes by in hand-offs and summaries. */
export function segmentTitle(kind: WorkoutSegment['kind']): string {
  switch (kind) {
    case 'review':
      return 'Review'
    case 'weakSpots':
      return 'Weakest spots'
    case 'freshSpots':
      return 'Free play'
  }
}

/** One line describing the plan, for the workout card. */
export function summarizeWorkout(workout: DailyWorkout): string {
  const parts = workout.segments.map((segment) =>
    segment.kind === 'review'
      ? `${segment.ranges.length} review${segment.ranges.length === 1 ? '' : 's'}`
      : segment.kind === 'weakSpots'
        ? `${segment.leaks.length} weak spot${segment.leaks.length === 1 ? '' : 's'}`
        : 'free play',
  )
  return `${workout.totalQuestions} hands · ${parts.join(' · ')} · ~${workout.estimatedMinutes} min`
}
