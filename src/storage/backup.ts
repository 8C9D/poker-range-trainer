import type {
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangePracticeStats,
  RangeReviewState,
} from '../types/practice'
import type { SavedRange } from '../types/range'
import type { RangeActionAccuracy } from '../domain/actionRange'
import { STORAGE_KEY, loadSavedRanges } from './rangeStorage'
import { PRACTICE_STATS_STORAGE_KEY, loadPracticeStats } from './practiceStatsStorage'
import { HAND_ACCURACY_STORAGE_KEY, loadHandAccuracy } from './handAccuracyStorage'
import { ACTION_ACCURACY_STORAGE_KEY, loadActionAccuracy } from './actionAccuracyStorage'
import { SESSION_HISTORY_STORAGE_KEY, loadSessionHistory } from './sessionHistoryStorage'
import { REVIEW_STATE_STORAGE_KEY, loadReviewStates } from './reviewStateStorage'

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
  if (!isPlainObject(parsed)) {
    throw new Error('Backup file is not a backup object.')
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(parsed.version)}.`)
  }
  if (!Array.isArray(parsed.ranges)) {
    throw new Error('Backup file is missing its ranges list.')
  }
  for (const field of [
    'practiceStats',
    'handAccuracy',
    'actionAccuracy',
    'sessionHistory',
    'reviewStates',
  ] as const) {
    if (!isPlainObject(parsed[field])) {
      throw new Error(`Backup file is missing its ${field} data.`)
    }
  }
  return parsed as unknown as Backup
}

/**
 * Restore a backup into localStorage, REPLACING all existing local data. Each
 * slice is written under its existing storage key; the per-slice loaders apply
 * their usual defensive validation when the app next reads them.
 */
export function restoreBackup(backup: Backup): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.ranges))
  localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(backup.practiceStats))
  localStorage.setItem(HAND_ACCURACY_STORAGE_KEY, JSON.stringify(backup.handAccuracy))
  localStorage.setItem(ACTION_ACCURACY_STORAGE_KEY, JSON.stringify(backup.actionAccuracy))
  localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(backup.sessionHistory))
  localStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify(backup.reviewStates))
}
