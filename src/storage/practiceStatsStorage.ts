import type { PracticeSessionSummary, RangePracticeStats } from '../types/practice'
import { isNonNegativeFinite, readJson } from './storageHelpers'

/**
 * Local persistence for cumulative per-range practice stats, backed by
 * `localStorage`.
 *
 * Mirrors `rangeStorage.ts`: side-effect-only, with all reads/writes funneled
 * through the exported functions and a single versioned key, so it can later be
 * swapped for a backend without touching callers. Stats are stored as a map
 * keyed by `rangeId` for O(1) lookup when a finished session is recorded.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const PRACTICE_STATS_STORAGE_KEY = 'poker-range-trainer.practice-stats.v1'

/** Validate a parsed value as `RangePracticeStats`, returning `null` if malformed. */
function parseRangePracticeStats(value: unknown): RangePracticeStats | null {
  if (typeof value !== 'object' || value === null) return null
  const { rangeId, totalAttempts, correctAttempts, lastPracticedAt } =
    value as Record<string, unknown>

  if (typeof rangeId !== 'string' || rangeId.length === 0) return null
  if (!isNonNegativeFinite(totalAttempts)) return null
  if (!isNonNegativeFinite(correctAttempts)) return null
  if (typeof lastPracticedAt !== 'string') return null

  return { rangeId, totalAttempts, correctAttempts, lastPracticedAt }
}

/** Persist the full stats map, serialized under the single storage key. */
function writePracticeStats(stats: Record<string, RangePracticeStats>): void {
  localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(stats))
}

/**
 * All persisted practice stats, keyed by `rangeId`.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the
 * stored value is not a non-null, non-array object. Individual malformed entries
 * are skipped so one bad record never discards the rest, and the returned map is
 * re-keyed by each entry's own `rangeId` so it is always self-consistent.
 */
export function loadPracticeStats(): Record<string, RangePracticeStats> {
  const parsed = readJson(PRACTICE_STATS_STORAGE_KEY)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const stats: Record<string, RangePracticeStats> = {}
  for (const entry of Object.values(parsed as Record<string, unknown>)) {
    const validated = parseRangePracticeStats(entry)
    if (validated !== null) stats[validated.rangeId] = validated
  }
  return stats
}

/**
 * Fold one finished practice session into the stored stats for `rangeId`.
 *
 * A session with no answered questions (`summary.totalQuestions <= 0`) is a
 * no-op: it never creates or touches a record. Otherwise the range's cumulative
 * counts are incremented (starting from zero when there is no prior record) and
 * `lastPracticedAt` advances to `timestamp`.
 */
export function recordPracticeSession(
  rangeId: string,
  summary: Pick<PracticeSessionSummary, 'totalQuestions' | 'correctAnswers'>,
  timestamp: string = new Date().toISOString(),
): void {
  if (summary.totalQuestions <= 0) return

  const stats = loadPracticeStats()
  const prior = stats[rangeId] ?? { totalAttempts: 0, correctAttempts: 0 }
  stats[rangeId] = {
    rangeId,
    totalAttempts: prior.totalAttempts + summary.totalQuestions,
    correctAttempts: prior.correctAttempts + summary.correctAnswers,
    lastPracticedAt: timestamp,
  }
  writePracticeStats(stats)
}
