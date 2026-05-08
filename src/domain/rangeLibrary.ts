/**
 * Pure helpers for managing a library of saved ranges.
 *
 * These operate on anything with a `name`, so they stay decoupled from the full
 * `SavedRange` shape and never touch poker math, storage, or the DOM.
 */

/**
 * Return the ranges whose name contains `query` as a case-insensitive
 * substring, preserving the input order.
 *
 * The query is trimmed first, so surrounding whitespace is ignored and a blank
 * query (empty or whitespace-only) matches every range. A query that matches
 * nothing returns an empty array. The input array is never mutated; a fresh
 * array is always returned.
 */
export function filterRangesByName<T extends { name: string }>(
  ranges: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return ranges.slice()
  return ranges.filter((range) => range.name.toLowerCase().includes(needle))
}

/**
 * Return the ranges whose `metadata.position` equals `position`, preserving the
 * input order.
 *
 * A `null` or empty `position` means "all positions" and matches every range. A
 * specific position matches only ranges that carry that exact
 * `metadata.position`; ranges with no metadata, or with metadata but no
 * position, are excluded. The input array is never mutated; a fresh array is
 * always returned.
 */
export function filterRangesByPosition<T extends { metadata?: { position?: string } }>(
  ranges: T[],
  position: string | null,
): T[] {
  if (!position) return ranges.slice()
  return ranges.filter((range) => range.metadata?.position === position)
}

/**
 * Return the ranges whose `metadata.actionType` equals `actionType`, preserving
 * the input order.
 *
 * A `null` or empty `actionType` means "all actions" and matches every range. A
 * specific action matches only ranges that carry that exact
 * `metadata.actionType`; ranges with no metadata, or with metadata but no action
 * type, are excluded. The input array is never mutated; a fresh array is always
 * returned.
 */
export function filterRangesByActionType<T extends { metadata?: { actionType?: string } }>(
  ranges: T[],
  actionType: string | null,
): T[] {
  if (!actionType) return ranges.slice()
  return ranges.filter((range) => range.metadata?.actionType === actionType)
}
