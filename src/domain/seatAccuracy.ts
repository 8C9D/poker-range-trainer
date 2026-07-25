import { accuracyPercentage } from './accuracy'
import {
  ACTION_TYPES,
  POSITIONS,
  type ActionType,
  type Position,
  type SavedRange,
} from '../types/range'
import type { RangePracticeStats } from '../types/practice'

/**
 * Practice accuracy grouped by seat and by action (v8.4).
 *
 * Per-range numbers answer "how well do I know this chart"; they never answer
 * "where at the table do I leak". Because every range already declares the seat
 * and the action it represents, the stored per-range stats can be re-cut along
 * those two axes without recording anything new. Pure.
 *
 * The cut covers every session on a range with the relevant field declared, not
 * only spot-drill sessions — the question is about the seat, not the drill.
 */

/** One group of the breakdown: a seat or an action, and how it has gone. */
export interface AccuracyGroup<T extends string> {
  key: T
  attempts: number
  correct: number
  /** Accuracy over the group, 0–100. */
  accuracy: number
  /** How many saved ranges fed this group. */
  rangeCount: number
}

/** Ranges with recorded practice, folded into buckets by one metadata field. */
function groupBy<T extends string>(
  order: readonly T[],
  ranges: SavedRange[],
  stats: Record<string, RangePracticeStats>,
  keyOf: (range: SavedRange) => T | undefined,
  minAttempts: number,
): AccuracyGroup<T>[] {
  const buckets = new Map<T, AccuracyGroup<T>>()
  for (const key of order) {
    buckets.set(key, { key, attempts: 0, correct: 0, accuracy: 0, rangeCount: 0 })
  }

  for (const range of ranges) {
    if (range.archived) continue
    const key = keyOf(range)
    const stat = stats[range.id]
    if (!key || !stat || stat.totalAttempts <= 0) continue
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.attempts += stat.totalAttempts
    bucket.correct += stat.correctAttempts
    bucket.rangeCount += 1
  }

  const groups: AccuracyGroup<T>[] = []
  for (const key of order) {
    const bucket = buckets.get(key)
    if (!bucket || bucket.attempts < minAttempts) continue
    bucket.accuracy = accuracyPercentage(bucket.correct, bucket.attempts)
    groups.push(bucket)
  }
  // Weakest first; ties break toward more attempts, then canonical order.
  return groups.sort(
    (a, b) =>
      a.accuracy - b.accuracy ||
      b.attempts - a.attempts ||
      order.indexOf(a.key) - order.indexOf(b.key),
  )
}

/**
 * Accuracy per seat, weakest first.
 *
 * Only seats with at least `minAttempts` answered questions appear, so one
 * unlucky session cannot present itself as a positional leak.
 */
export function accuracyByPosition(
  ranges: SavedRange[],
  stats: Record<string, RangePracticeStats>,
  minAttempts = 5,
): AccuracyGroup<Position>[] {
  return groupBy(POSITIONS, ranges, stats, (range) => range.metadata?.position, minAttempts)
}

/**
 * Accuracy per action type (opens, 3-bets, defends…), weakest first.
 *
 * Cut by the range's declared action rather than by the spot situation: a range
 * saved as a "call" can answer several situations, so attributing it to one
 * would be a guess and attributing it to all would double-count.
 */
export function accuracyByActionType(
  ranges: SavedRange[],
  stats: Record<string, RangePracticeStats>,
  minAttempts = 5,
): AccuracyGroup<ActionType>[] {
  return groupBy(ACTION_TYPES, ranges, stats, (range) => range.metadata?.actionType, minAttempts)
}
