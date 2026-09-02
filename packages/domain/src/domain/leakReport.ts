import { accuracyPercentage } from './accuracy.js'
import { HAND_CLASSES, classifyHandClass, type HandClass } from './handClass.js'
import type { PokerHand } from './pokerHands.js'
import type { RangeHandAccuracy } from '../types/practice.js'

/**
 * Library-wide leaks grouped by hand class (v7.0).
 *
 * `rankWeakHands` answers "which exact hands do I miss"; this answers the more
 * actionable "which *kind* of hand do I miss", by folding the same per-hand
 * accuracy data into `handClass` buckets. Pure — the caller passes the loaded
 * per-range accuracy map.
 */

export interface HandClassLeak {
  handClass: HandClass
  attempts: number
  correct: number
  /** Accuracy over the class, 0–100 (0 when there are no attempts). */
  accuracy: number
  /** Distinct hands in this class the user has gotten wrong at least once. */
  missedHands: PokerHand[]
  /** The hands to drill, keyed by range — only hands with a recorded mistake. */
  pools: Record<string, PokerHand[]>
}

/**
 * Rank hand classes weakest-first across the whole library.
 *
 * Only classes with at least `minAttempts` recorded answers are included, so a
 * single unlucky answer cannot present itself as a leak. Classes with no
 * mistakes at all are dropped (there is nothing to fix). Ties break toward more
 * attempts, then canonical class order, for a stable result.
 */
export function rankHandClassLeaks(
  handAccuracy: Record<string, RangeHandAccuracy>,
  minAttempts = 3,
): HandClassLeak[] {
  const byClass = new Map<HandClass, HandClassLeak>()
  for (const handClass of HAND_CLASSES) {
    byClass.set(handClass, {
      handClass,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      missedHands: [],
      pools: {},
    })
  }

  for (const [rangeId, hands] of Object.entries(handAccuracy)) {
    for (const stat of Object.values(hands)) {
      if (stat.attempts <= 0) continue
      const leak = byClass.get(classifyHandClass(stat.hand))
      if (!leak) continue
      leak.attempts += stat.attempts
      leak.correct += stat.correct
      if (stat.correct < stat.attempts) {
        if (!leak.missedHands.includes(stat.hand)) leak.missedHands.push(stat.hand)
        const pool = (leak.pools[rangeId] ??= [])
        if (!pool.includes(stat.hand)) pool.push(stat.hand)
      }
    }
  }

  const leaks: HandClassLeak[] = []
  for (const handClass of HAND_CLASSES) {
    const leak = byClass.get(handClass)
    if (!leak || leak.attempts < minAttempts || leak.missedHands.length === 0) continue
    leak.accuracy = accuracyPercentage(leak.correct, leak.attempts)
    leaks.push(leak)
  }
  return leaks.sort(
    (a, b) =>
      a.accuracy - b.accuracy ||
      b.attempts - a.attempts ||
      HAND_CLASSES.indexOf(a.handClass) - HAND_CLASSES.indexOf(b.handClass),
  )
}
