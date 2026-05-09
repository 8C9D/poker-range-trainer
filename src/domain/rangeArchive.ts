import type { SavedRange } from '../types/range'

/**
 * Return a copy of `range` with its library archive state set.
 *
 * Archiving is library management, not an edit, so only the archive flag
 * changes: when `archived` is true the result carries `archived: true`; when
 * false the `archived` key is omitted entirely, matching how the rest of the
 * app treats active ranges (absent/false = active). `id`, `name`, `hands`,
 * `createdAt`, `updatedAt`, and `metadata` are carried through untouched.
 *
 * Only the top level is copied — the `hands` and `metadata` references are
 * shared with `range` — and `range` itself is never mutated.
 */
export function setRangeArchived(range: SavedRange, archived: boolean): SavedRange {
  if (archived) return { ...range, archived: true }
  const copy = { ...range }
  delete copy.archived
  return copy
}
