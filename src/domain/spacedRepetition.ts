import type { RangeReviewState } from '../types/practice'
import type { SavedRange } from '../types/range'

/**
 * Pure spaced-repetition scheduling for range review (v2.2).
 *
 * A range's `RangeReviewState` advances based on a finished session's accuracy:
 * weak sessions reset the interval to review again tomorrow and shrink `ease`,
 * medium sessions hold the interval, and strong sessions grow it by `ease`.
 * Accuracy buckets match the rest of the app (low `< 50`, medium `50–79`, high
 * `>= 80`). All timestamps are passed in (`reviewedAt`, `now`) so scheduling is
 * deterministic and unit-testable — nothing reads the clock here.
 */

/** Starting ease for a brand-new range. */
export const DEFAULT_EASE = 2.5
/** Floor for `ease` so spacing never collapses to nothing. */
export const MIN_EASE = 1.3
/** Interval (days) granted by the first strong review of a range. */
export const FIRST_INTERVAL_DAYS = 1
/** Milliseconds in a day. */
export const DAY_MS = 86_400_000

/** A brand-new review state for `rangeId` (never scheduled or reviewed yet). */
export function seedReviewState(rangeId: string): RangeReviewState {
  return { rangeId, ease: DEFAULT_EASE, intervalDays: 0, dueAt: '', lastReviewedAt: '' }
}

/**
 * Advance `prev` to the next review state given a session's `accuracyPercentage`
 * (0–100) and the `reviewedAt` timestamp. `prev` carries the `rangeId` and prior
 * `ease`/`intervalDays` — use `seedReviewState` for a range's first review.
 *
 * - low (`< 50`): shrink ease (floored at `MIN_EASE`), reset interval to 1 day.
 * - medium (`50–79`): keep ease, keep interval (at least 1 day).
 * - high (`>= 80`): grow ease, multiply interval by the prior ease (or
 *   `FIRST_INTERVAL_DAYS` on the first review), rounded.
 */
export function scheduleNextReview(
  prev: RangeReviewState,
  accuracyPercentage: number,
  reviewedAt: string,
): RangeReviewState {
  let ease = prev.ease
  let intervalDays: number
  if (accuracyPercentage < 50) {
    ease = Math.max(MIN_EASE, prev.ease - 0.2)
    intervalDays = 1
  } else if (accuracyPercentage < 80) {
    intervalDays = Math.max(1, prev.intervalDays)
  } else {
    ease = prev.ease + 0.1
    intervalDays =
      prev.intervalDays <= 0 ? FIRST_INTERVAL_DAYS : Math.round(prev.intervalDays * prev.ease)
  }
  const dueAt = new Date(new Date(reviewedAt).getTime() + intervalDays * DAY_MS).toISOString()
  return { rangeId: prev.rangeId, ease, intervalDays, dueAt, lastReviewedAt: reviewedAt }
}

/**
 * Whether `state` is due for review at `now`. A never-scheduled state (empty
 * `dueAt`) is never due.
 */
export function isReviewDue(state: RangeReviewState, now: string): boolean {
  if (state.dueAt === '') return false
  return new Date(now).getTime() >= new Date(state.dueAt).getTime()
}

/**
 * The subset of `ranges` due for review at `now`, in input order. A range counts
 * as due when it has no review state yet (never reviewed → due to start its
 * schedule) or its state `isReviewDue`. Pure — inputs are not mutated, and the
 * caller is responsible for any pre-filtering (e.g. excluding archived ranges).
 */
export function selectDueRanges(
  ranges: SavedRange[],
  reviewStates: Record<string, RangeReviewState>,
  now: string,
): SavedRange[] {
  return ranges.filter((range) => {
    const state = reviewStates[range.id]
    return state === undefined || isReviewDue(state, now)
  })
}
