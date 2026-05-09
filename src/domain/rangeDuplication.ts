import type { SavedRange } from '../types/range'

/**
 * Build an independent copy of a saved range.
 *
 * Returns a brand-new {@link SavedRange} that shares no mutable state with
 * `source`: `hands` is copied into a fresh array and `metadata`, when present,
 * is shallow-copied into a fresh object (its fields are flat scalars, so a
 * shallow copy fully detaches it). The copy takes the caller-supplied `newId`
 * so the original keeps its own id, and uses `timestamp` for both `createdAt`
 * and `updatedAt`, since the duplicate is newly created now. Its name is the
 * source name with a `" (copy)"` suffix; no attempt is made to keep names
 * unique, so duplicating twice yields two ranges that share a name.
 *
 * `source` is never mutated, and neither its `hands` nor its `metadata`
 * reference is shared with the result. `metadata` is omitted entirely when the
 * source has none, matching how the rest of the app treats metadata-less
 * ranges.
 */
export function duplicateRange(
  source: SavedRange,
  newId: string,
  timestamp: string,
): SavedRange {
  const copy: SavedRange = {
    id: newId,
    name: `${source.name} (copy)`,
    hands: [...source.hands],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  if (source.metadata) copy.metadata = { ...source.metadata }
  return copy
}
