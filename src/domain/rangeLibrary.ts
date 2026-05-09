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

/**
 * Return the ranges whose `metadata.gameType` equals `gameType`, preserving the
 * input order.
 *
 * A `null` or empty `gameType` means "all game types" and matches every range. A
 * specific game type matches only ranges that carry that exact
 * `metadata.gameType`; ranges with no metadata, or with metadata but no game
 * type, are excluded. The input array is never mutated; a fresh array is always
 * returned.
 */
export function filterRangesByGameType<T extends { metadata?: { gameType?: string } }>(
  ranges: T[],
  gameType: string | null,
): T[] {
  if (!gameType) return ranges.slice()
  return ranges.filter((range) => range.metadata?.gameType === gameType)
}

/**
 * Return the ranges whose `metadata.stackDepthBb` strictly equals
 * `stackDepthBb`, preserving the input order.
 *
 * A `null` `stackDepthBb` means "all depths" and matches every range. A specific
 * depth matches only ranges that carry that exact `metadata.stackDepthBb`; ranges
 * with no metadata, or with metadata but no stack depth, are excluded. Unlike the
 * enum-backed filters, stack depth is a free-form number, so `null` (not an empty
 * string) is the "all" sentinel and the comparison is `=== stackDepthBb`. The
 * input array is never mutated; a fresh array is always returned.
 */
export function filterRangesByStackDepth<T extends { metadata?: { stackDepthBb?: number } }>(
  ranges: T[],
  stackDepthBb: number | null,
): T[] {
  if (stackDepthBb === null) return ranges.slice()
  return ranges.filter((range) => range.metadata?.stackDepthBb === stackDepthBb)
}

/**
 * Return the distinct `metadata.stackDepthBb` values present across `ranges`,
 * sorted numerically ascending.
 *
 * Duplicate depths collapse to a single entry, and ranges with no metadata or no
 * stack depth contribute nothing; an empty array is returned when no range
 * carries a depth. Deriving the selectable depths from the saved ranges keeps the
 * stack-depth filter in step with the user's actual data instead of a hardcoded
 * vocabulary. The input array is never mutated.
 */
export function distinctStackDepths<T extends { metadata?: { stackDepthBb?: number } }>(
  ranges: T[],
): number[] {
  const depths = new Set<number>()
  for (const range of ranges) {
    const depth = range.metadata?.stackDepthBb
    if (depth !== undefined) depths.add(depth)
  }
  return [...depths].sort((a, b) => a - b)
}

/**
 * Return a copy of `ranges` sorted by `name` ascending, case-insensitively.
 *
 * Ordering uses `localeCompare` with `sensitivity: 'base'`, so case and accents
 * are ignored and "apple" sorts before "Banana". `Array.prototype.sort` is
 * stable, so ranges whose names compare equal keep their input order. The input
 * array is never mutated — a fresh, sorted array is always returned (the input is
 * copied with `.slice()` before sorting).
 */
export function sortRangesByName<T extends { name: string }>(ranges: T[]): T[] {
  return ranges
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/**
 * Return a copy of `ranges` sorted by `updatedAt` descending — most recently
 * edited first.
 *
 * `updatedAt` holds ISO-8601 timestamps, which sort chronologically as plain
 * strings, so comparing `b` against `a` (`b.updatedAt.localeCompare(a.updatedAt)`)
 * yields newest first. `Array.prototype.sort` is stable, so ranges whose
 * timestamps compare equal keep their input order. The input array is never
 * mutated — a fresh, sorted array is always returned (the input is copied with
 * `.slice()` before sorting).
 */
export function sortRangesByUpdatedAt<T extends { updatedAt: string }>(ranges: T[]): T[] {
  return ranges.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
