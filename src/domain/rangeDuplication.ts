import type { SavedRange } from '../types/range'

/**
 * Build an independent copy of a saved range.
 *
 * Returns a brand-new {@link SavedRange} that shares no mutable state with
 * `source`: every content-bearing field is copied by value into fresh
 * structures. `hands` is a fresh array; `metadata` and `source` are
 * shallow-copied (flat scalars, so a shallow copy fully detaches them);
 * `handActions` and `handNotes` are shallow-copied records; `comboSelections`
 * and `mixedStrategies` are deep-copied (their values are arrays). The copy
 * takes the caller-supplied `newId` so the original keeps its own id, and uses
 * `timestamp` for both `createdAt` and `updatedAt`, since the duplicate is
 * newly created now. Its name is the source name with a `" (copy)"` suffix; no
 * attempt is made to keep names unique, so duplicating twice yields two ranges
 * that share a name.
 *
 * Each optional field is omitted entirely when the source lacks it, matching
 * how the rest of the app treats absent overlays. The library-state flags
 * (`archived`, `favorite`) are intentionally NOT carried: a fresh copy starts
 * active and unfavorited. `source` is never mutated and shares no reference
 * with the result.
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
  if (source.source) copy.source = { ...source.source }
  if (source.handActions) copy.handActions = { ...source.handActions }
  if (source.handNotes) copy.handNotes = { ...source.handNotes }
  if (source.comboSelections) {
    copy.comboSelections = Object.fromEntries(
      Object.entries(source.comboSelections).map(([hand, combos]) => [hand, [...combos]]),
    )
  }
  if (source.mixedStrategies) {
    copy.mixedStrategies = Object.fromEntries(
      Object.entries(source.mixedStrategies).map(([hand, actions]) => [
        hand,
        actions.map((action) => ({ ...action })),
      ]),
    )
  }
  return copy
}
