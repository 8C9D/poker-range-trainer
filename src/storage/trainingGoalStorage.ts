import { readJson, removeJson, writeJson } from './storageHelpers'

/**
 * Local persistence for the daily training goal (v7.3), backed by
 * `localStorage`.
 *
 * A single small setting rather than a keyed map, but it follows the same shape
 * as its sibling modules: one versioned key, side-effect-only, and a load that
 * degrades to "no goal" rather than throwing on corrupt data.
 */

export const TRAINING_GOAL_STORAGE_KEY = 'poker-range-trainer.training-goal.v1'

/** Validate and normalize a stored goal; `null` means the payload is unreadable. */
export function normalizeTrainingGoal(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

/** The stored daily target in hands, or 0 when the user has no goal set. */
export function loadTrainingGoal(): number {
  const parsed = readJson(TRAINING_GOAL_STORAGE_KEY)
  const normalized = normalizeTrainingGoal(parsed)
  return normalized !== null && normalized > 0 ? normalized : 0
}

/** Persist the daily target; a non-positive value clears the goal. */
export function saveTrainingGoal(target: number): void {
  if (!Number.isFinite(target) || target <= 0) {
    removeJson(TRAINING_GOAL_STORAGE_KEY)
    return
  }
  writeJson(TRAINING_GOAL_STORAGE_KEY, Math.floor(target))
}
