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
import {
  HAND_ACCURACY_STORAGE_KEY,
  loadHandAccuracy,
  validateHandAccuracy,
} from './handAccuracyStorage'
import {
  ACTION_ACCURACY_STORAGE_KEY,
  loadActionAccuracy,
  validateActionAccuracy,
} from './actionAccuracyStorage'
import {
  SESSION_HISTORY_STORAGE_KEY,
  loadSessionHistory,
  validateSessionHistory,
} from './sessionHistoryStorage'
import {
  REVIEW_STATE_STORAGE_KEY,
  loadReviewStates,
  validateReviewStates,
} from './reviewStateStorage'
import {
  SPOT_ACCURACY_STORAGE_KEY,
  loadSpotAccuracy,
  validateSpotAccuracy,
} from './spotAccuracyStorage'
import {
  TRAINING_GOAL_STORAGE_KEY,
  loadTrainingGoal,
  normalizeTrainingGoal,
} from './trainingGoalStorage'
import { isValidTimestamp } from './storageHelpers'

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

/**
 * Largest backup file an importer will read into memory.
 *
 * A backup arrives as one JSON string that has to be read whole before
 * `validateBackup` can look at it, so size is the one property validation
 * structurally cannot check: by the time it runs, the memory is already spent.
 * Neither file picker helps — `DocumentPicker` and `<input type="file">` both
 * filter by declared type, not size — so whoever opens the file has to bound
 * the read itself.
 *
 * 64MB sits well above any real library and well below what would threaten an
 * iPhone's per-app memory. A pretty-printed backup is dominated by per-hand
 * accuracy (169 entries per practiced range): 100 ranges with a full accuracy
 * map and 100 recorded sessions each serialize to ~4.6MB, and 500 ranges —
 * past anything hand-built — to ~31MB. The bound is deliberately generous
 * rather than tight, because on a product with no server and no account,
 * refusing a legitimate backup is itself a way to lose the data.
 */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024

/**
 * Reject an over-large backup file BEFORE reading it, throwing the same kind of
 * readable error `parseBackup` does. Past the read there is nothing left to
 * protect, so callers must check the size they can see on the file handle.
 */
export function assertBackupFileSize(bytes: number): void {
  if (bytes > MAX_BACKUP_BYTES) {
    const size = (bytes / 1024 / 1024).toFixed(1)
    const limit = MAX_BACKUP_BYTES / 1024 / 1024
    throw new Error(`Backup file is too large to import: ${size}MB, and the limit is ${limit}MB.`)
  }
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
  if (!isValidTimestamp(parsed.exportedAt)) {
    throw new Error('Backup file has an invalid exportedAt timestamp.')
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
  let practiceStats: Record<string, RangePracticeStats>
  try {
    practiceStats = validatePracticeStats(parsed.practiceStats)
  } catch (error) {
    throw new Error('Backup file contains invalid practiceStats data.', { cause: error })
  }
  let handAccuracy: Record<string, RangeHandAccuracy>
  try {
    handAccuracy = validateHandAccuracy(parsed.handAccuracy)
  } catch (error) {
    throw new Error('Backup file contains invalid handAccuracy data.', { cause: error })
  }
  let actionAccuracy: Record<string, RangeActionAccuracy>
  try {
    actionAccuracy = validateActionAccuracy(parsed.actionAccuracy)
  } catch (error) {
    throw new Error('Backup file contains invalid actionAccuracy data.', { cause: error })
  }
  let sessionHistory: Record<string, PracticeSessionRecord[]>
  try {
    sessionHistory = validateSessionHistory(parsed.sessionHistory)
  } catch (error) {
    throw new Error('Backup file contains invalid sessionHistory data.', { cause: error })
  }
  let reviewStates: Record<string, RangeReviewState>
  try {
    reviewStates = validateReviewStates(parsed.reviewStates)
  } catch (error) {
    throw new Error('Backup file contains invalid reviewStates data.', { cause: error })
  }
  let spotAccuracy: Record<string, SpotAccuracyStat> | undefined
  if (parsed.spotAccuracy !== undefined) {
    try {
      spotAccuracy = validateSpotAccuracy(parsed.spotAccuracy)
    } catch (error) {
      throw new Error('Backup file contains invalid spotAccuracy data.', { cause: error })
    }
  }
  let trainingGoal: number | undefined
  if (parsed.trainingGoal !== undefined) {
    const normalized = normalizeTrainingGoal(parsed.trainingGoal)
    if (normalized === null) throw new Error('Backup file has an unreadable trainingGoal.')
    trainingGoal = normalized
  }
  return {
    ...parsed,
    ranges,
    practiceStats,
    handAccuracy,
    actionAccuracy,
    sessionHistory,
    reviewStates,
    ...(spotAccuracy !== undefined ? { spotAccuracy } : {}),
    ...(trainingGoal !== undefined ? { trainingGoal } : {}),
  } as unknown as Backup
}

/** Where a restore that could not be fully rewound is reported to, if anywhere. */
type RestoreDamageReporter = (keys: string[]) => void

let reportDamage: RestoreDamageReporter | null = null

/**
 * Hand this module somewhere to report to - in practice `reportRestoreDamage`,
 * wired up once Sentry has been initialised.
 *
 * Injected rather than imported, and not for testability. This is shared `@core`
 * code compiled into both apps and the only crash seam lives in
 * `mobile/platform/`, so importing it from here would put a React Native module
 * on the web app's import graph. That is the same reason `setStorageLossReporter`
 * takes an injection (`mobile/platform/storeIntegrity.ts:34-44`), arrived at from
 * a different direction: there the importer would have been too early, here it
 * would be the wrong platform.
 *
 * Unlike the storage-loss reporter this one does NOT hold undelivered reports. A
 * restore is user-initiated from a mounted screen, so `initCrashReporting` has
 * always run long before one can fail; there is no wiring order to defend
 * against, and holding a report that can never be early would be dead code.
 */
export function setRestoreDamageReporter(report: RestoreDamageReporter): void {
  reportDamage = report
}

/**
 * Announce the slices a failed restore left holding new data, to whoever is
 * listening. Never throws: the caller is about to raise the error that stopped
 * the restore, which is the actionable first cause, and replacing it with a
 * reporting failure is the defect P2-4 removed.
 */
function reportRestoreDamage(keys: string[]): void {
  if (keys.length === 0 || reportDamage === null) return
  try {
    reportDamage(keys)
  } catch {
    // See above: reporting must never become the error the caller sees.
  }
}

/**
 * Restore a backup into localStorage, REPLACING all existing local data. Each
 * slice is written under its existing storage key; the per-slice loaders apply
 * their usual defensive validation when the app next reads them.
 *
 * Every slice is serialized up front and the current values are snapshotted, so
 * a `setItem` that throws mid-way (e.g. a `QuotaExceededError`) is followed by a
 * rewind writing that snapshot back over every slice, not only the ones the
 * failed write had already reached.
 *
 * The rewind is best-effort, NOT an atomic write, and the difference is the
 * whole reason this loop looks the way it does. Putting a value back can itself
 * be refused, and a slice whose rewind is refused keeps the new value. Only a
 * slice the forward write had already replaced can end up that way: the slices
 * past the failure were never written, so a refused rewind hands them back the
 * value they still hold and leaves them correct either way. The error the caller
 * sees is always the one that stopped the restore, never one raised while
 * putting the old values back.
 *
 * The slices left holding new data are handed to whatever
 * {@link setRestoreDamageReporter} was given, because nothing else can ever
 * notice them: the caller's error is about the restore, and a mixed library
 * reads back perfectly well on every later launch. That set is derived from
 * `replaced` below, which under-reports by at most one slice rather than risk
 * naming a slice that is in fact intact - see the comment there.
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
  // A LOWER BOUND on how many slices the forward loop replaced, which is what
  // decides whether a refused rewind did any damage: a slice the forward write
  // never reached is handed back the value it still holds, so a refusal there
  // leaves it correct.
  //
  // A lower bound rather than the count, and the difference is deliberate.
  // Incrementing after the write never credits a `setItem` that threw, and on iOS
  // that can be one short: the shim's `setItem` is `mmkv.set` followed by
  // `getAllKeys` bookkeeping (`mobile/platform/localStorageShim.ts:75-79`), and
  // only the first is known to leave the store untouched when it throws. So the
  // one slice the forward write failed on may have been replaced without being
  // counted, and a refused rewind there would go unreported.
  //
  // That is the right direction to be wrong in. Counting optimistically would
  // instead report slices the forward write never reached - on a full device,
  // most of them - and a report that fires when the library is intact is worth
  // less than no report at all, because announcing a mixed library is the only
  // thing this reporter does.
  let replaced = 0
  try {
    for (const [key, value] of entries) {
      localStorage.setItem(key, value)
      replaced += 1
    }
  } catch (error) {
    // Rewinding is best-effort per slice, and every slice is attempted even if an
    // earlier one refuses. Putting a value back is not guaranteed to succeed just
    // because it was there a moment ago: on iOS `setItem` is MMKV's `set`, which
    // throws when the device is full, and a restore that ran out of room is
    // exactly what reaches this handler. A throw escaping this loop would abandon
    // the rewind partway, leaving the slices it had reached holding old data and
    // the rest holding new — one library assembled from two points in time, with
    // ranges and their practice records no longer describing each other. A slice
    // that cannot be rewound is still wrong, but finishing the loop can only
    // shrink that set, never grow it.
    const damaged: string[] = []
    for (const [index, [key, value]] of previous.entries()) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch {
        // Deliberately not propagated. The caller is about to be told why the
        // RESTORE failed, which is the actionable error and the first cause; a
        // rollback failure is a second symptom of that same cause, and raising it
        // instead would report the wrong reason.
        //
        // It is not left silent either. The user's error says the restore failed
        // and cannot say that one slice now holds data from a different point in
        // time, and nothing later can notice: a mixed library reads back perfectly
        // well on every launch.
        if (index < replaced) damaged.push(key)
      }
    }
    reportRestoreDamage(damaged)
    throw error
  }
}
