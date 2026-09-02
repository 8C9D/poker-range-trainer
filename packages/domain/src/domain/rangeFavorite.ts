import type { SavedRange } from '../types/range.js'

/**
 * Return a copy of `range` with its library favorite state set.
 *
 * Favoriting is library management, not an edit, so only the favorite flag
 * changes: when `favorite` is true the result carries `favorite: true`; when
 * false the `favorite` key is omitted entirely, matching how the rest of the
 * app treats non-favorited ranges (absent/false = not favorited). `id`, `name`,
 * `hands`, `createdAt`, `updatedAt`, and `metadata` are carried through
 * untouched.
 *
 * Only the top level is copied — the `hands` and `metadata` references are
 * shared with `range` — and `range` itself is never mutated.
 */
export function setRangeFavorite(range: SavedRange, favorite: boolean): SavedRange {
  if (favorite) return { ...range, favorite: true }
  const copy = { ...range }
  delete copy.favorite
  return copy
}
