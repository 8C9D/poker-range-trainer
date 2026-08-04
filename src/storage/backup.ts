import type {
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangePracticeStats,
  RangeReviewState,
  SpotAccuracyStat,
} from '../types/practice'
import type { SavedRange } from '../types/range'
import type { RangeActionAccuracy } from '../domain/actionRange'
import { STORAGE_KEY, loadSavedRanges, normalizeSavedRanges } from './rangeStorage'
import {
  PRACTICE_STATS_STORAGE_KEY,
  loadPracticeStats,
  validatePracticeStats,
} from './practiceStatsStorage'
import { HAND_ACCURACY_STORAGE_KEY, loadHandAccuracy } from './handAccuracyStorage'
import { ACTION_ACCURACY_STORAGE_KEY, loadActionAccuracy } from './actionAccuracyStorage'
import { SESSION_HISTORY_STORAGE_KEY, loadSessionHistory } from './sessionHistoryStorage'
import { REVIEW_STATE_STORAGE_KEY, loadReviewStates } from './reviewStateStorage'
import { SPOT_ACCURACY_STORAGE_KEY, loadSpotAccuracy } from './spotAccuracyStorage'
import { TRAINING_GOAL_STORAGE_KEY, loadTrainingGoal } from './trainingGoalStorage'

/** Current backup-file schema version. Bump when the shape changes incompatibly. */
export const BACKUP_VERSION = 1

/**
 * A single self-contained snapshot of every persisted slice of the local
 * library. Local-only: no accounts, no network — just the data needed to
 * restore the app's state on import.
 */
export interface Backup {
  version: number
  exportedAt: string
  ranges: SavedRange[]
  practiceStats: Record<string, RangePracticeStats>
  handAccuracy: Record<string, RangeHandAccuracy>
  actionAccuracy: Record<string, RangeActionAccuracy>
  sessionHistory: Record<string, PracticeSessionRecord[]>
  reviewStates: Record<string, RangeReviewState>
  /**
   * Cumulative per-spot accuracy, keyed by `spotKey`. OPTIONAL because backup
   * files written before per-spot accuracy existed have no such field, and they
   * still have to import; absence restores as "no spot record", exactly like the
   * empty map a fresh install has.
   */
  spotAccuracy?: Record<string, SpotAccuracyStat>
  /**
   * The daily hands target, or 0 for "no goal". OPTIONAL for the same reason as
   * `spotAccuracy`: files written before the field existed still have to import.
   * It is a setting rather than earned data, but the Account screen promises a
   * backup carries everything, and re-picking it on a restored device is exactly
   * the small loss a backup exists to prevent.
   */
  trainingGoal?: number
}

/**
 * Gather every persisted slice into one versioned backup object. `exportedAt`
 * defaults to now but can be injected for deterministic tests.
 */
export function buildBackup(exportedAt: string = new Date().toISOString()): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt,
    ranges: loadSavedRanges(),
    practiceStats: loadPracticeStats(),
    handAccuracy: loadHandAccuracy(),
    actionAccuracy: loadActionAccuracy(),
    sessionHistory: loadSessionHistory(),
    reviewStates: loadReviewStates(),
    spotAccuracy: loadSpotAccuracy(),
    trainingGoal: loadTrainingGoal(),
  }
}

/** Serialize a backup to a pretty-printed JSON string suitable for download. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse and validate a backup JSON string. Throws an `Error` with a clear
 * message when the input is not valid JSON, not a backup object, or carries an
 * unsupported version. On success the returned value is structurally a `Backup`
 * (the per-slice loaders still defensively validate individual entries on read).
 */
export function parseBackup(json: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }
  return validateBackup(parsed)
}

/**
 * Validate an already-parsed value as a `Backup`, throwing the same readable
 * errors `parseBackup` does.
 *
 * Split out because a backup does not only arrive as a file: the cloud pull
 * fetches one as an object. Restoring REPLACES the whole local library, so the
 * payload has to clear the same bar however it got here — a row written by a
 * newer app version, or one left partial, would otherwise be written straight
 * over a working library and read back as nothing.
 */
export function validateBackup(parsed: unknown): Backup {
  if (!isPlainObject(parsed)) {
    throw new Error('Backup file is not a backup object.')
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(parsed.version)}.`)
  }
  if (!Array.isArray(parsed.ranges)) {
    throw new Error('Backup file is missing its ranges list.')
  }
  let ranges: SavedRange[]
  try {
    ranges = normalizeSavedRanges(parsed.ranges as SavedRange[])
  } catch (error) {
    throw new Error('Backup file contains an invalid range.', { cause: error })
  }
  for (const field of [
    'handAccuracy',
    'actionAccuracy',
    'sessionHistory',
    'reviewStates',
  ] as const) {
    if (!isPlainObject(parsed[field])) {
      throw new Error(`Backup file is missing its ${field} data.`)
    }
  }
  let practiceStats: Record<string, RangePracticeStats>
  try {
    practiceStats = validatePracticeStats(parsed.practiceStats)
  } catch (error) {
    throw new Error('Backup file contains invalid practiceStats data.', { cause: error })
  }
  // Optional, so only their shape is checked when the file carries them at all.
  if (parsed.spotAccuracy !== undefined && !isPlainObject(parsed.spotAccuracy)) {
    throw new Error('Backup file is missing its spotAccuracy data.')
  }
  if (parsed.trainingGoal !== undefined && typeof parsed.trainingGoal !== 'number') {
    throw new Error('Backup file has an unreadable trainingGoal.')
  }
  return { ...parsed, ranges, practiceStats } as unknown as Backup
}

/**
 * Restore a backup into localStorage, REPLACING all existing local data. Each
 * slice is written under its existing storage key; the per-slice loaders apply
 * their usual defensive validation when the app next reads them.
 *
 * The write is atomic: every slice is serialized up front, the current values
 * are snapshotted, and if any `setItem` throws mid-way (e.g. a
 * `QuotaExceededError`) the snapshot is restored so the library is never left
 * half-replaced. Restoring the snapshot always fits, since those values were
 * already present. The original error is rethrown for the caller to surface.
 */
export function restoreBackup(backup: Backup): void {
  const validated = validateBackup(backup)
  const entries: [string, string][] = [
    [STORAGE_KEY, JSON.stringify(validated.ranges)],
    [PRACTICE_STATS_STORAGE_KEY, JSON.stringify(validated.practiceStats)],
    [HAND_ACCURACY_STORAGE_KEY, JSON.stringify(validated.handAccuracy)],
    [ACTION_ACCURACY_STORAGE_KEY, JSON.stringify(validated.actionAccuracy)],
    [SESSION_HISTORY_STORAGE_KEY, JSON.stringify(validated.sessionHistory)],
    [REVIEW_STATE_STORAGE_KEY, JSON.stringify(validated.reviewStates)],
    // A file without the field replaces the local record with nothing, the same
    // as every other slice: a restore is the whole library, not a merge.
    [SPOT_ACCURACY_STORAGE_KEY, JSON.stringify(validated.spotAccuracy ?? {})],
    // 0 reads back as "no goal", so a file without the field clears the target
    // like every other slice a restore replaces.
    [TRAINING_GOAL_STORAGE_KEY, JSON.stringify(validated.trainingGoal ?? 0)],
  ]
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const)
  try {
    for (const [key, value] of entries) {
      localStorage.setItem(key, value)
    }
  } catch (error) {
    for (const [key, value] of previous) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
    throw error
  }
}
