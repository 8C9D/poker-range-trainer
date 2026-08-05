import { ACTION_ACCURACY_STORAGE_KEY } from './actionAccuracyStorage'
import { HAND_ACCURACY_STORAGE_KEY } from './handAccuracyStorage'
import { PRACTICE_STATS_STORAGE_KEY } from './practiceStatsStorage'
import { deleteSavedRanges, loadSavedRanges, replaceSavedRanges } from './rangeStorage'
import { REVIEW_STATE_STORAGE_KEY } from './reviewStateStorage'
import { SESSION_HISTORY_STORAGE_KEY } from './sessionHistoryStorage'
import { readJson, writeJson } from './storageHelpers'
import type { SavedRange } from '../types/range'

/**
 * Deleting a range and everything recorded about it — and taking it back.
 *
 * Five stores are keyed by range id — practice stats, session history, per-hand
 * accuracy, per-action accuracy, and the review schedule — and between them they
 * hold far more than the range record itself. Removing only the range left all
 * of that behind for good, which made the app's own advice when the store fills
 * up ("delete some ranges to free space") not actually free the space.
 *
 * Per-SPOT accuracy is deliberately kept: it is keyed by spot, not by range, and
 * another range in the library may well answer the same spot.
 *
 * Because a delete takes weeks of practice history with it, every delete first
 * copies out what it is about to remove ({@link DeletedRanges}) so the caller can
 * put it all back with {@link restoreDeletedRanges}.
 */
const RANGE_KEYED_STORES = [
  PRACTICE_STATS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
  HAND_ACCURACY_STORAGE_KEY,
  ACTION_ACCURACY_STORAGE_KEY,
  REVIEW_STATE_STORAGE_KEY,
] as const

/** A deleted range plus the library position it was deleted from. */
interface DeletedRange {
  range: SavedRange
  index: number
}

/** Everything one delete removed: enough to undo it exactly. */
export interface DeletedRanges {
  ranges: DeletedRange[]
  /** Per store key, the entries that were purged, keyed by range id. */
  records: Record<string, Record<string, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Remove every range whose id is in `ids`, along with its recorded stats,
 * history and schedule, and return what was removed. No-op for an empty
 * collection (which returns an empty snapshot).
 *
 * The range itself goes FIRST: it is what the user asked to delete, so it is the
 * write that must not be lost to a store that refuses a later one. A purge that
 * stops part-way leaves an orphaned record, and every reader already ignores
 * records whose range is gone.
 */
export function deleteRangesWithRecords(ids: Iterable<string>): DeletedRanges {
  const idSet = new Set(ids)
  const deleted: DeletedRanges = { ranges: [], records: {} }
  if (idSet.size === 0) return deleted

  deleted.ranges = loadSavedRanges()
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => idSet.has(range.id))

  deleteSavedRanges(idSet)

  for (const key of RANGE_KEYED_STORES) {
    const stored = readJson(key)
    if (!isRecord(stored)) continue
    const kept: [string, unknown][] = []
    const removed: Record<string, unknown> = {}
    for (const [rangeId, value] of Object.entries(stored)) {
      if (idSet.has(rangeId)) removed[rangeId] = value
      else kept.push([rangeId, value])
    }
    if (kept.length !== Object.keys(stored).length) {
      deleted.records[key] = removed
      writeJson(key, Object.fromEntries(kept))
    }
  }

  return deleted
}

/**
 * Put back everything a {@link deleteRangesWithRecords} call removed: the range
 * records at the positions they held, and their entries in every range-keyed
 * store. No-op for a snapshot that deleted nothing.
 *
 * Restored entries win over anything now stored under the same id — nothing else
 * can have written one, since ids are minted per range and the range was gone.
 * The rest of each store is left exactly as it is, so practice recorded since the
 * delete survives the undo.
 */
export function restoreDeletedRanges(deleted: DeletedRanges): void {
  if (deleted.ranges.length === 0) return

  const ranges = loadSavedRanges().filter(
    (range) => !deleted.ranges.some((entry) => entry.range.id === range.id),
  )
  // Ascending, so each splice lands before the later ones shift anything.
  for (const { range, index } of [...deleted.ranges].sort((a, b) => a.index - b.index)) {
    ranges.splice(Math.min(index, ranges.length), 0, range)
  }
  replaceSavedRanges(ranges)

  for (const [key, entries] of Object.entries(deleted.records)) {
    const stored = readJson(key)
    writeJson(key, { ...(isRecord(stored) ? stored : {}), ...entries })
  }
}

/**
 * The one delete waiting to be undone, handed from the screen that deleted to
 * the Library that offers the undo.
 *
 * Deleting a range from its own page navigates straight back to the Library, so
 * the offer has to outlive the screen that made it. It is deliberately in memory
 * only: a deleted range that reappeared in storage would be a second copy of
 * everything the user just cleared out, and a reload is a clear enough "no".
 */
let pendingUndo: DeletedRanges | null = null

/** Hold `deleted` for the next screen that asks. Replaces any earlier offer. */
export function rememberDeletedRanges(deleted: DeletedRanges): void {
  pendingUndo = deleted.ranges.length > 0 ? deleted : null
}

/**
 * The pending delete, or null. A pure read, so a screen can pick it up while it
 * renders; {@link clearDeletedRanges} is what actually consumes it.
 */
export function peekDeletedRanges(): DeletedRanges | null {
  return pendingUndo
}

/** Drop the pending delete, so the handoff is only ever picked up once. */
export function clearDeletedRanges(): void {
  pendingUndo = null
}

/** Describe a delete for the undo offer, e.g. `"UTG open"` or `3 ranges`. */
export function describeDeletedRanges(deleted: DeletedRanges): string {
  if (deleted.ranges.length === 1) {
    const { name } = deleted.ranges[0].range
    return `“${name || 'Untitled'}”`
  }
  return `${deleted.ranges.length} ranges`
}
