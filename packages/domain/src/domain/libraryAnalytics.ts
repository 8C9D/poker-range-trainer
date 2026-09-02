import type { RangePracticeStats } from '../types/practice.js'
import { accuracyPercentage } from './accuracy.js'

/**
 * Aggregate practice performance across the whole library (v6 analytics).
 *
 * - `rangesPracticed`: how many ranges have at least one recorded attempt.
 * - `totalAttempts` / `totalCorrect`: summed across every range's stats.
 * - `overallAccuracy`: `totalCorrect / totalAttempts * 100`, zero-guarded.
 */
export interface LibraryAnalytics {
  rangesPracticed: number
  totalAttempts: number
  totalCorrect: number
  overallAccuracy: number
}

/**
 * Fold a list of per-range practice stats into one library-wide summary. Pure:
 * no React, no storage. An empty list (or all-zero attempts) yields zeros and a
 * 0% overall accuracy rather than `NaN`, mirroring `practiceAccuracyPercentage`.
 */
export function summarizeLibraryAnalytics(stats: RangePracticeStats[]): LibraryAnalytics {
  let totalAttempts = 0
  let totalCorrect = 0
  let rangesPracticed = 0
  for (const stat of stats) {
    if (stat.totalAttempts > 0) rangesPracticed += 1
    totalAttempts += stat.totalAttempts
    totalCorrect += stat.correctAttempts
  }
  return {
    rangesPracticed,
    totalAttempts,
    totalCorrect,
    overallAccuracy: accuracyPercentage(totalCorrect, totalAttempts),
  }
}
