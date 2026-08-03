import { ACTION_ACCURACY_STORAGE_KEY } from './actionAccuracyStorage'
import { HAND_ACCURACY_STORAGE_KEY } from './handAccuracyStorage'
import { PRACTICE_STATS_STORAGE_KEY } from './practiceStatsStorage'
import { deleteSavedRanges } from './rangeStorage'
import { REVIEW_STATE_STORAGE_KEY } from './reviewStateStorage'
import { SESSION_HISTORY_STORAGE_KEY } from './sessionHistoryStorage'
import { readJson, writeJson } from './storageHelpers'

/**
 * Deleting a range and everything recorded about it.
 *
 * Five stores are keyed by range id — practice stats, session history, per-hand
 * accuracy, per-action accuracy, and the review schedule — and between them they
 * hold far more than the range record itself. Removing only the range left all
 * of that behind for good, which made the app's own advice when the store fills
 * up ("delete some ranges to free space") not actually free the space.
 *
 * Per-SPOT accuracy is deliberately kept: it is keyed by spot, not by range, and
 * another range in the library may well answer the same spot.
 */
const RANGE_KEYED_STORES = [
  PRACTICE_STATS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
  HAND_ACCURACY_STORAGE_KEY,
  ACTION_ACCURACY_STORAGE_KEY,
  REVIEW_STATE_STORAGE_KEY,
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Remove every range whose id is in `ids`, along with its recorded stats,
 * history and schedule. No-op for an empty collection.
 *
 * The range itself goes FIRST: it is what the user asked to delete, so it is the
 * write that must not be lost to a store that refuses a later one. A purge that
 * stops part-way leaves an orphaned record, and every reader already ignores
 * records whose range is gone.
 */
export function deleteRangesWithRecords(ids: Iterable<string>): void {
  const idSet = new Set(ids)
  if (idSet.size === 0) return

  deleteSavedRanges(idSet)

  for (const key of RANGE_KEYED_STORES) {
    const stored = readJson(key)
    if (!isRecord(stored)) continue
    const kept = Object.entries(stored).filter(([rangeId]) => !idSet.has(rangeId))
    if (kept.length !== Object.keys(stored).length) {
      writeJson(key, Object.fromEntries(kept))
    }
  }
}
