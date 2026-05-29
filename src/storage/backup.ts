import type {
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangePracticeStats,
  RangeReviewState,
} from '../types/practice'
import type { SavedRange } from '../types/range'
import type { RangeActionAccuracy } from '../domain/actionRange'
import { loadSavedRanges } from './rangeStorage'
import { loadPracticeStats } from './practiceStatsStorage'
import { loadHandAccuracy } from './handAccuracyStorage'
import { loadActionAccuracy } from './actionAccuracyStorage'
import { loadSessionHistory } from './sessionHistoryStorage'
import { loadReviewStates } from './reviewStateStorage'

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
