import { isValidHand } from '../domain/pokerHands'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'
import { isNonNegativeInteger, readJson, writeJson } from './storageHelpers'

/**
 * Local persistence for cumulative per-hand accuracy stats, per range, backed by
 * `localStorage`.
 *
 * Mirrors `practiceStatsStorage.ts`: side-effect-only, with all reads/writes
 * funneled through the exported functions under a single versioned key, so it can
 * later be swapped for a backend without touching callers. The outer map is keyed
 * by `rangeId`; each range maps a hand to its cumulative `HandAccuracyStat`, for
 * O(1) lookup when folding a finished session in and when a heatmap/performance
 * view reads a hand.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const HAND_ACCURACY_STORAGE_KEY = 'poker-range-trainer.hand-accuracy.v1'

/** Validate a parsed value as `HandAccuracyStat`, returning `null` if malformed. */
function parseHandAccuracyStat(value: unknown): HandAccuracyStat | null {
  if (typeof value !== 'object' || value === null) return null
  const { hand, attempts, correct, falsePositives, falseNegatives } =
    value as Record<string, unknown>

  if (typeof hand !== 'string' || !isValidHand(hand)) return null
  if (!isNonNegativeInteger(attempts)) return null
  if (!isNonNegativeInteger(correct) || correct > attempts) return null
  if (!isNonNegativeInteger(falsePositives)) return null
  if (!isNonNegativeInteger(falseNegatives)) return null
  if (falsePositives + falseNegatives !== attempts - correct) return null

  return { hand, attempts, correct, falsePositives, falseNegatives }
}

/** Strictly validate and normalize a complete per-range hand-accuracy map. */
export function validateHandAccuracy(value: unknown): Record<string, RangeHandAccuracy> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Hand accuracy is not an object.')
  }
  const stats: Record<string, RangeHandAccuracy> = {}
  for (const [rangeId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (rangeId.length === 0) throw new Error('Hand accuracy has an empty range id.')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('Hand accuracy contains an invalid range record.')
    }
    const rangeStats: RangeHandAccuracy = {}
    for (const entry of Object.values(raw as Record<string, unknown>)) {
      const stat = parseHandAccuracyStat(entry)
      if (stat === null) throw new Error('Hand accuracy contains an invalid hand record.')
      rangeStats[stat.hand] = stat
    }
    if (Object.keys(rangeStats).length > 0) stats[rangeId] = rangeStats
  }
  return stats
}

/**
 * Validate one range's per-hand map. Skips malformed hand entries and re-keys by
 * each stat's own `hand`; returns `null` when no valid hands remain so an empty
 * range is dropped rather than stored as `{}`.
 */
function parseRangeHandAccuracy(value: unknown): RangeHandAccuracy | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const result: RangeHandAccuracy = {}
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const stat = parseHandAccuracyStat(entry)
    if (stat !== null) result[stat.hand] = stat
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Persist the full stats map, serialized under the single storage key. */
function writeHandAccuracy(stats: Record<string, RangeHandAccuracy>): void {
  writeJson(HAND_ACCURACY_STORAGE_KEY, stats)
}

/**
 * All persisted per-hand accuracy, keyed by `rangeId` then by hand.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the stored
 * value is not a non-null, non-array object. Malformed hand entries are skipped
 * and a range left with no valid hands is dropped, so one bad record never
 * discards the rest; each inner map is re-keyed by each stat's own `hand`.
 */
export function loadHandAccuracy(): Record<string, RangeHandAccuracy> {
  const parsed = readJson(HAND_ACCURACY_STORAGE_KEY)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const stats: Record<string, RangeHandAccuracy> = {}
  for (const [rangeId, value] of Object.entries(parsed as Record<string, unknown>)) {
    const rangeStats = parseRangeHandAccuracy(value)
    if (rangeStats !== null) stats[rangeId] = rangeStats
  }
  return stats
}

/**
 * Fold one finished session's per-hand stats into the stored cumulative stats for
 * `rangeId`.
 *
 * `handStats` is the output of `summarizeHandAccuracy`. An empty array is a no-op
 * (never creates a record). Each hand's counts are added onto the prior cumulative
 * entry, starting from zeros when that hand has no prior record.
 */
export function recordHandAccuracy(rangeId: string, handStats: HandAccuracyStat[]): void {
  if (handStats.length === 0) return
  if (rangeId.length === 0 || handStats.some((stat) => parseHandAccuracyStat(stat) === null)) {
    throw new Error('Cannot record invalid hand accuracy.')
  }

  const stats = loadHandAccuracy()
  const rangeStats: RangeHandAccuracy = { ...(stats[rangeId] ?? {}) }
  for (const stat of handStats) {
    const prior = rangeStats[stat.hand] ?? {
      hand: stat.hand,
      attempts: 0,
      correct: 0,
      falsePositives: 0,
      falseNegatives: 0,
    }
    rangeStats[stat.hand] = {
      hand: stat.hand,
      attempts: prior.attempts + stat.attempts,
      correct: prior.correct + stat.correct,
      falsePositives: prior.falsePositives + stat.falsePositives,
      falseNegatives: prior.falseNegatives + stat.falseNegatives,
    }
  }
  stats[rangeId] = rangeStats
  writeHandAccuracy(stats)
}
