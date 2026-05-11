import type { RangePracticeStats } from '../types/practice'

/**
 * Derive cumulative practice accuracy for one range as a percentage.
 *
 * Returns `correctAttempts / totalAttempts * 100`, guarding the zero-attempt
 * case so a record with no attempts yields 0 rather than `NaN` (mirroring
 * `summarizePracticeAttempts`'s zero guard). Pure: no React, no storage. A range
 * that has actually been recorded always has `totalAttempts > 0`, but the guard
 * keeps the helper total for any `RangePracticeStats`.
 */
export function practiceAccuracyPercentage(stats: RangePracticeStats): number {
  return stats.totalAttempts === 0
    ? 0
    : (stats.correctAttempts / stats.totalAttempts) * 100
}
