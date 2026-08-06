import { accuracyPercentage } from './accuracy'
import { parseSpotKey, spotKey, type Spot } from './spot'
import type { SpotAccuracyStat } from '../types/practice'

/**
 * The spots you play worst (v8.6).
 *
 * `accuracyByPosition` answers "which seat" and `rankHandClassLeaks` answers
 * "which kind of hand"; this answers the most specific question the app can ask —
 * "which exact situation" — from the per-spot record the spot drill writes. Pure.
 */

export interface SpotLeak {
  spot: Spot
  attempts: number
  correct: number
  /** Accuracy in this spot, 0–100. */
  accuracy: number
}

/**
 * Rank recorded spots weakest-first.
 *
 * Only spots with at least `minAttempts` answers are included, so a single
 * unlucky hand cannot present itself as a leak. Records whose key no longer
 * parses (a vocabulary change, or hand-edited storage) are skipped. Ties break
 * toward more attempts, then by key, for a stable order.
 */
export function rankSpotLeaks(
  spotAccuracy: Record<string, SpotAccuracyStat>,
  minAttempts = 5,
): SpotLeak[] {
  const leaks: SpotLeak[] = []
  for (const stat of Object.values(spotAccuracy)) {
    if (stat.attempts < minAttempts) continue
    const spot = parseSpotKey(stat.spotKey)
    if (!spot) continue
    leaks.push({
      spot,
      attempts: stat.attempts,
      correct: stat.correct,
      accuracy: accuracyPercentage(stat.correct, stat.attempts),
    })
  }
  return leaks.sort(
    (a, b) =>
      a.accuracy - b.accuracy ||
      b.attempts - a.attempts ||
      spotKey(a.spot).localeCompare(spotKey(b.spot)),
  )
}
