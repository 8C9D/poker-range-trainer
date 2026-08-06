import type { RangePack } from '../domain/rangeTransfer'
import { saveSavedRange, saveSavedRanges } from '../storage/rangeStorage'
import type { SavedRange } from '../types/range'
import { createRangeId } from './ids'

/**
 * Adding someone else's shared range or pack to your own library.
 *
 * A shared payload carries its author's ids, so every fork mints fresh ones —
 * otherwise opening a link could overwrite a range of the same id you already
 * had. Both helpers throw when the store refuses the write, so the viewing page
 * can report it rather than confirm a save that did not happen.
 */

/** Save a shared range as a NEW local range, returning the id it was given. */
export function forkSharedRange(range: SavedRange, now = new Date().toISOString()): string {
  const id = createRangeId()
  saveSavedRange({ ...range, id, createdAt: now, updatedAt: now })
  return id
}

/**
 * Save every range in a shared pack as a NEW local range.
 *
 * Written in ONE store write rather than one per range: saved range by range, a
 * store that filled up midway left the viewer holding part of a pack while the
 * page reported that saving it had failed.
 */
export function forkSharedPack(pack: RangePack, now = new Date().toISOString()): void {
  saveSavedRanges(
    pack.ranges.map((range) => ({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })),
  )
}
