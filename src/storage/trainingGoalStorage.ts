import { readJson, writeJson } from './storageHelpers'

/**
 * Local persistence for the daily training goal (v7.3), backed by
 * `localStorage`.
 *
 * A single small setting rather than a keyed map, but it follows the same shape
 * as its sibling modules: one versioned key, side-effect-only, and a load that
 * degrades to "no goal" rather than throwing on corrupt data.
 */

export const TRAINING_GOAL_STORAGE_KEY = 'poker-range-trainer.training-goal.v1'

/** The stored daily target in hands, or 0 when the user has no goal set. */
export function loadTrainingGoal(): number {
  const parsed = readJson(TRAINING_GOAL_STORAGE_KEY)
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

/** Persist the daily target; a non-positive value clears the goal. */
export function saveTrainingGoal(target: number): void {
  if (!Number.isFinite(target) || target <= 0) {
    localStorage.removeItem(TRAINING_GOAL_STORAGE_KEY)
    return
  }
  writeJson(TRAINING_GOAL_STORAGE_KEY, Math.floor(target))
}
