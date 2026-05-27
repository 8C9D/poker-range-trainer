import type { ActionAccuracyStat, RangeActionAccuracy } from '../domain/actionRange'
import { RANGE_ACTIONS, type RangeAction } from '../types/range'
import { isNonNegativeFinite } from './storageHelpers'

/**
 * Local persistence for cumulative per-action accuracy stats, per range, backed
 * by `localStorage`.
 *
 * Mirrors `handAccuracyStorage.ts`: side-effect-only, with all reads/writes
 * funneled through the exported functions under a single versioned key, so it can
 * later be swapped for a backend without touching callers. The outer map is keyed
 * by `rangeId`; each range maps a `RangeAction` to its cumulative
 * `ActionAccuracyStat`, for O(1) folding of a finished action-quiz session.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const ACTION_ACCURACY_STORAGE_KEY = 'poker-range-trainer.action-accuracy.v1'

/** True when `value` is one of the known range actions. */
function isRangeAction(value: unknown): value is RangeAction {
  return typeof value === 'string' && (RANGE_ACTIONS as readonly string[]).includes(value)
}

/** Validate a parsed value as `ActionAccuracyStat`, returning `null` if malformed. */
function parseActionAccuracyStat(value: unknown): ActionAccuracyStat | null {
  if (typeof value !== 'object' || value === null) return null
  const { action, attempts, correct } = value as Record<string, unknown>

  if (!isRangeAction(action)) return null
  if (!isNonNegativeFinite(attempts)) return null
  if (!isNonNegativeFinite(correct)) return null

  return { action, attempts, correct }
}

/**
 * Validate one range's per-action map. Skips malformed entries and re-keys by
 * each stat's own `action`; returns `null` when no valid actions remain so an
 * empty range is dropped rather than stored as `{}`.
 */
function parseRangeActionAccuracy(value: unknown): RangeActionAccuracy | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const result: RangeActionAccuracy = {}
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const stat = parseActionAccuracyStat(entry)
    if (stat !== null) result[stat.action] = stat
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Persist the full stats map, serialized under the single storage key. */
function writeActionAccuracy(stats: Record<string, RangeActionAccuracy>): void {
  localStorage.setItem(ACTION_ACCURACY_STORAGE_KEY, JSON.stringify(stats))
}

/**
 * All persisted per-action accuracy, keyed by `rangeId` then by action.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the stored
 * value is not a non-null, non-array object. Malformed entries are skipped and a
 * range left with no valid actions is dropped, so one bad record never discards
 * the rest; each inner map is re-keyed by each stat's own `action`.
 */
export function loadActionAccuracy(): Record<string, RangeActionAccuracy> {
  const raw = localStorage.getItem(ACTION_ACCURACY_STORAGE_KEY)
  if (raw === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const stats: Record<string, RangeActionAccuracy> = {}
  for (const [rangeId, value] of Object.entries(parsed as Record<string, unknown>)) {
    const rangeStats = parseRangeActionAccuracy(value)
    if (rangeStats !== null) stats[rangeId] = rangeStats
  }
  return stats
}

/**
 * Fold one finished action-quiz session's per-action stats into the stored
 * cumulative stats for `rangeId`.
 *
 * `actionStats` is the output of `summarizeActionAccuracy`. An empty array is a
 * no-op (never creates a record). Each action's counts are added onto the prior
 * cumulative entry, starting from zeros when that action has no prior record.
 */
export function recordActionAccuracy(rangeId: string, actionStats: ActionAccuracyStat[]): void {
  if (actionStats.length === 0) return

  const stats = loadActionAccuracy()
  const rangeStats: RangeActionAccuracy = { ...(stats[rangeId] ?? {}) }
  for (const stat of actionStats) {
    const prior = rangeStats[stat.action] ?? { action: stat.action, attempts: 0, correct: 0 }
    rangeStats[stat.action] = {
      action: stat.action,
      attempts: prior.attempts + stat.attempts,
      correct: prior.correct + stat.correct,
    }
  }
  stats[rangeId] = rangeStats
  writeActionAccuracy(stats)
}
