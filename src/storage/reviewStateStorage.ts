import type { RangeReviewState } from '../types/practice'
import { isNonNegativeFinite, readJson, writeJson } from './storageHelpers'

/**
 * Local persistence for per-range spaced-repetition review state, backed by
 * `localStorage`.
 *
 * Mirrors `practiceStatsStorage.ts`: side-effect-only, with all reads/writes
 * funneled through the exported functions under a single versioned key, keyed by
 * `rangeId` for O(1) upsert when a finished session advances a range's schedule.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const REVIEW_STATE_STORAGE_KEY = 'poker-range-trainer.review-state.v1'

/** Validate a parsed value as `RangeReviewState`, returning `null` if malformed. */
function parseRangeReviewState(value: unknown): RangeReviewState | null {
  if (typeof value !== 'object' || value === null) return null
  const { rangeId, ease, intervalDays, dueAt, lastReviewedAt } = value as Record<string, unknown>

  if (typeof rangeId !== 'string' || rangeId.length === 0) return null
  if (!isNonNegativeFinite(ease)) return null
  if (!isNonNegativeFinite(intervalDays)) return null
  if (typeof dueAt !== 'string') return null
  if (typeof lastReviewedAt !== 'string') return null

  return { rangeId, ease, intervalDays, dueAt, lastReviewedAt }
}

/** Persist the full review-state map, serialized under the single storage key. */
function writeReviewStates(states: Record<string, RangeReviewState>): void {
  writeJson(REVIEW_STATE_STORAGE_KEY, states)
}

/**
 * All persisted review states, keyed by `rangeId`.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the stored
 * value is not a non-null, non-array object. Malformed entries are skipped so one
 * bad record never discards the rest, and entries are re-keyed by their own
 * `rangeId` so the map is always self-consistent.
 */
export function loadReviewStates(): Record<string, RangeReviewState> {
  const parsed = readJson(REVIEW_STATE_STORAGE_KEY)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const states: Record<string, RangeReviewState> = {}
  for (const entry of Object.values(parsed as Record<string, unknown>)) {
    const validated = parseRangeReviewState(entry)
    if (validated !== null) states[validated.rangeId] = validated
  }
  return states
}

/** Upsert one range's review state (replacing any prior state for its `rangeId`). */
export function saveReviewState(state: RangeReviewState): void {
  const states = loadReviewStates()
  states[state.rangeId] = state
  writeReviewStates(states)
}
