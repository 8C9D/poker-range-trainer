import type { SpotAccuracyStat } from '../types/practice'
import { parseSpotKey } from '../domain/spot'
import { isNonNegativeInteger, readJson, writeJson } from './storageHelpers'

/**
 * Local persistence for cumulative per-spot accuracy (v8.6), backed by
 * `localStorage`.
 *
 * Mirrors `handAccuracyStorage.ts`: side-effect-only behind a small API under a
 * single versioned key. Keyed by `spotKey(spot)`, so a spot's record survives
 * renaming or replacing the range that happens to cover it — the seat and the
 * situation are what is being measured, not the chart.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const SPOT_ACCURACY_STORAGE_KEY = 'poker-range-trainer.spot-accuracy.v1'

/** Validate a parsed value as `SpotAccuracyStat`, returning `null` if malformed. */
function parseSpotAccuracyStat(value: unknown): SpotAccuracyStat | null {
  if (typeof value !== 'object' || value === null) return null
  const { spotKey, attempts, correct } = value as Record<string, unknown>

  if (typeof spotKey !== 'string' || parseSpotKey(spotKey) === null) return null
  if (!isNonNegativeInteger(attempts)) return null
  if (!isNonNegativeInteger(correct) || correct > attempts) return null

  return { spotKey, attempts, correct }
}

/** Strictly validate and normalize a complete per-spot accuracy map. */
export function validateSpotAccuracy(value: unknown): Record<string, SpotAccuracyStat> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Spot accuracy is not an object.')
  }
  const stats: Record<string, SpotAccuracyStat> = {}
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const stat = parseSpotAccuracyStat(entry)
    if (stat === null) throw new Error('Spot accuracy contains an invalid record.')
    stats[stat.spotKey] = stat
  }
  return stats
}

/**
 * All persisted per-spot accuracy, keyed by `spotKey`.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the stored
 * value is not a non-null, non-array object. Malformed entries are skipped so one
 * bad record never discards the rest; the map is re-keyed by each stat's own
 * `spotKey`.
 */
export function loadSpotAccuracy(): Record<string, SpotAccuracyStat> {
  const parsed = readJson(SPOT_ACCURACY_STORAGE_KEY)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const stats: Record<string, SpotAccuracyStat> = {}
  for (const entry of Object.values(parsed as Record<string, unknown>)) {
    const stat = parseSpotAccuracyStat(entry)
    if (stat !== null) stats[stat.spotKey] = stat
  }
  return stats
}

/**
 * Fold one finished spot session into the stored cumulative stats.
 *
 * `sessionStats` is one entry per spot answered in the session. An empty array is
 * a no-op (never creates a record); each spot's counts are added onto its prior
 * entry, starting from zeros when it has none.
 */
export function recordSpotAccuracy(sessionStats: SpotAccuracyStat[]): void {
  if (sessionStats.length === 0) return
  if (sessionStats.some((stat) => parseSpotAccuracyStat(stat) === null)) {
    throw new Error('Cannot record invalid spot accuracy.')
  }

  const stats = loadSpotAccuracy()
  for (const stat of sessionStats) {
    const prior = stats[stat.spotKey] ?? { spotKey: stat.spotKey, attempts: 0, correct: 0 }
    stats[stat.spotKey] = {
      spotKey: stat.spotKey,
      attempts: prior.attempts + stat.attempts,
      correct: prior.correct + stat.correct,
    }
  }
  writeJson(SPOT_ACCURACY_STORAGE_KEY, stats)
}
