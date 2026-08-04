import { ACTION_ACCURACY_STORAGE_KEY } from './actionAccuracyStorage'
import { HAND_ACCURACY_STORAGE_KEY } from './handAccuracyStorage'
import { PRACTICE_STATS_STORAGE_KEY } from './practiceStatsStorage'
import { REVIEW_STATE_STORAGE_KEY } from './reviewStateStorage'
import { SESSION_HISTORY_STORAGE_KEY } from './sessionHistoryStorage'
import { SPOT_ACCURACY_STORAGE_KEY } from './spotAccuracyStorage'
import { removeJson } from './storageHelpers'
import { WORKOUT_STORAGE_KEY } from './workoutStorage'

/**
 * Starting the training record over without losing the charts.
 *
 * Every other way to clear these stores takes the ranges with them — deleting a
 * range purges its records, and clearing site data destroys the library. So
 * someone who wants a clean slate (a device handed on, a rebuilt library, an
 * imported pack whose numbers are not theirs) had no move that kept the work
 * they actually built.
 *
 * What goes is what was RECORDED about practice. What stays is what the user
 * authored or chose: the ranges themselves, and the daily goal — a setting, not
 * a record, and resetting it would quietly switch the goal off.
 */
const RECORDED_PRACTICE_STORES = [
  PRACTICE_STATS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
  HAND_ACCURACY_STORAGE_KEY,
  ACTION_ACCURACY_STORAGE_KEY,
  REVIEW_STATE_STORAGE_KEY,
  SPOT_ACCURACY_STORAGE_KEY,
  WORKOUT_STORAGE_KEY,
] as const

/**
 * Clear every recorded practice statistic, leaving the library and the daily
 * goal untouched.
 *
 * Unlike `deleteRangesWithRecords`, per-SPOT accuracy DOES go: it survives a
 * range deletion because another chart may still answer that spot, but a reset
 * is about the record itself, and leaving it would have the Progress screen
 * still naming weakest spots after the user asked for a clean slate. The
 * workout's "done today" flag goes for the same reason.
 */
export function resetPracticeRecords(): void {
  for (const key of RECORDED_PRACTICE_STORES) {
    removeJson(key)
  }
}
