import { readJson } from './storageHelpers'

/**
 * Local persistence for the daily workout's completion (v9.2), backed by
 * `localStorage`.
 *
 * Only the most recent completion timestamp is kept — enough to answer "is
 * today's workout done", which is all the Today card needs. One versioned key,
 * side-effect-only, and a load that degrades to "never completed" rather than
 * throwing on corrupt data.
 */

export const WORKOUT_STORAGE_KEY = 'poker-range-trainer.workout.v1'

/** ISO-8601 timestamp of the last completed workout, or null when none is recorded. */
export function loadWorkoutCompletion(): string | null {
  const parsed = readJson(WORKOUT_STORAGE_KEY)
  if (parsed === null || typeof parsed !== 'object') return null
  const { lastCompletedAt } = parsed as { lastCompletedAt?: unknown }
  if (typeof lastCompletedAt !== 'string') return null
  return Number.isFinite(new Date(lastCompletedAt).getTime()) ? lastCompletedAt : null
}

/** Persist the completion of a workout finished at `completedAt`. */
export function recordWorkoutCompletion(completedAt: string): void {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify({ lastCompletedAt: completedAt }))
}
