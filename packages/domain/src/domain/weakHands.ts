import { accuracyPercentage } from './accuracy.js'
import type { PokerHand } from './pokerHands.js'
import type { RangeHandAccuracy } from '../types/practice.js'

/** One (range, hand) pair with recorded mistakes, ranked by accuracy. */
export interface WeakHandEntry {
  rangeId: string
  hand: PokerHand
  attempts: number
  correct: number
  accuracy: number
}

/**
 * How weak a record looks once thin evidence is discounted: Laplace-smoothed
 * accuracy, `(correct + 1) / (attempts + 2)`.
 *
 * `rankSpotLeaks` can afford a flat 5-attempt floor because one spot pools every
 * hand dealt in it. A (range, hand) pair is the app's finest cut, so the same
 * floor would empty this report for anyone short of thousands of answers — most
 * hands sit at one or two attempts. Smoothing keeps every missed hand eligible
 * while ranking on how much the record actually shows: a hand missed 8 of 10
 * times (25% smoothed) outranks one missed on its only look (33%), where raw
 * accuracy put the one-off fluke first and let it crowd the real leak off the
 * list entirely. The reported `accuracy` stays the true, unsmoothed number.
 */
function weakness(correct: number, attempts: number): number {
  return (correct + 1) / (attempts + 2)
}

/**
 * The weakest practiced hands across the whole library: every (range, hand)
 * with at least one recorded mistake, weakest first by {@link weakness} (ties
 * break toward more attempts, then hand name for stability), truncated to
 * `limit`. Pure - callers pass the loaded per-range hand accuracy map.
 */
export function rankWeakHands(
  handAccuracy: Record<string, RangeHandAccuracy>,
  limit = 10,
): WeakHandEntry[] {
  const entries: WeakHandEntry[] = []
  for (const [rangeId, hands] of Object.entries(handAccuracy)) {
    for (const stat of Object.values(hands)) {
      if (stat.attempts > 0 && stat.correct < stat.attempts) {
        entries.push({
          rangeId,
          hand: stat.hand,
          attempts: stat.attempts,
          correct: stat.correct,
          accuracy: accuracyPercentage(stat.correct, stat.attempts),
        })
      }
    }
  }
  entries.sort(
    (a, b) =>
      weakness(a.correct, a.attempts) - weakness(b.correct, b.attempts) ||
      b.attempts - a.attempts ||
      a.hand.localeCompare(b.hand),
  )
  return entries.slice(0, limit)
}

/** Group weak-hand entries into per-range drill pools (deduped hands). */
export function weakHandPools(entries: WeakHandEntry[]): Record<string, PokerHand[]> {
  const pools: Record<string, PokerHand[]> = {}
  for (const entry of entries) {
    const pool = (pools[entry.rangeId] ??= [])
    if (!pool.includes(entry.hand)) pool.push(entry.hand)
  }
  return pools
}
