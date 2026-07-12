import { accuracyPercentage } from './accuracy'
import type { PokerHand } from './pokerHands'
import type { RangeHandAccuracy } from '../types/practice'

/** One (range, hand) pair with recorded mistakes, ranked by accuracy. */
export interface WeakHandEntry {
  rangeId: string
  hand: PokerHand
  attempts: number
  correct: number
  accuracy: number
}

/**
 * The weakest practiced hands across the whole library: every (range, hand)
 * with at least one recorded mistake, sorted by accuracy ascending (ties break
 * toward more attempts, then hand name for stability), truncated to `limit`.
 * Pure - callers pass the loaded per-range hand accuracy map.
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
      a.accuracy - b.accuracy || b.attempts - a.attempts || a.hand.localeCompare(b.hand),
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
