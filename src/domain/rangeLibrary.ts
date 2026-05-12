/**
 * Pure helpers for managing a library of saved ranges.
 *
 * These operate on minimal structural shapes (a `name`, a `metadata` field, an
 * `archived` flag, …), so they stay decoupled from the full `SavedRange` shape
 * and never touch poker math, storage, or the DOM.
 */

/**
 * Return the ranges to show for the given "show archived" state, preserving the
 * input order.
 *
 * When `showArchived` is true every range is returned (a fresh copy). When it is
 * false only active ranges are kept — those whose `archived` flag is not exactly
 * `true` — so archived ranges drop out. Storage only ever persists `archived:
 * true` (never `false`), so an absent flag reliably means active. The input array
 * is never mutated; a fresh array is always returned.
 */
export function filterArchivedRanges<T extends { archived?: boolean }>(
  ranges: T[],
  showArchived: boolean,
): T[] {
  if (showArchived) return ranges.slice()
  return ranges.filter((range) => range.archived !== true)
}

/**
 * Return the ranges to show for the given "favorites only" state, preserving the
 * input order.
 *
 * The sense is inverted from {@link filterArchivedRanges}: this is an inclusion
 * filter, not an exclusion. When `favoritesOnly` is false every range is returned
 * (a fresh copy); when it is true only favorited ranges are kept — those whose
 * `favorite` flag is exactly `true`. Storage only ever persists `favorite: true`
 * (never `false`), so an absent or `false` flag reliably means not favorited. The
 * input array is never mutated; a fresh array is always returned.
 */
export function filterFavoriteRanges<T extends { favorite?: boolean }>(
  ranges: T[],
  favoritesOnly: boolean,
): T[] {
  if (!favoritesOnly) return ranges.slice()
  return ranges.filter((range) => range.favorite === true)
}

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

/**
 * Return a copy of `ranges` sorted by their most recent practice timestamp,
 * descending — most recently practiced first.
 *
 * Unlike {@link sortRangesByUpdatedAt}, the timestamp to sort by lives in a
 * separate `practiceStats` map keyed by range id rather than on the range itself,
 * so the helper takes that map and looks up
 * `practiceStats[range.id]?.lastPracticedAt`. Those are ISO-8601 strings, which
 * sort chronologically as plain strings, so comparing `b` against `a` yields
 * newest first. A range with **no** stats entry falls back to an empty string,
 * which sorts before any real ISO timestamp, so every never-practiced range ends
 * up after every practiced one. `Array.prototype.sort` is stable, so ranges whose
 * timestamps compare equal (including all never-practiced ranges) keep their input
 * order. The input array is never mutated — a fresh, sorted array is always
 * returned (the input is copied with `.slice()` before sorting).
 */
export function sortRangesByLastPracticed<T extends { id: string }>(
  ranges: T[],
  practiceStats: Record<string, { lastPracticedAt: string }>,
): T[] {
  return ranges.slice().sort((a, b) => {
    const aAt = practiceStats[a.id]?.lastPracticedAt ?? ''
    const bAt = practiceStats[b.id]?.lastPracticedAt ?? ''
    return bAt.localeCompare(aAt)
  })
}

/**
 * Return a copy of `ranges` sorted by cumulative practice accuracy, descending —
 * highest accuracy first.
 *
 * Like {@link sortRangesByLastPracticed}, the value to sort by lives in a
 * separate `practiceStats` map keyed by range id rather than on the range
 * itself, so the helper takes that map and looks up `practiceStats[range.id]`.
 * Accuracy is derived inline as `correctAttempts / totalAttempts * 100` (the
 * same division as `practiceAccuracyPercentage`, kept here so the helper stays
 * decoupled from the fuller `RangePracticeStats` shape). A range with **no**
 * stats entry, or one whose `totalAttempts` is 0, has never really been
 * practiced; both map to a sentinel below every real 0–100 accuracy (-1) so they
 * sort after every practiced range, while a practiced 0%-accuracy range (real 0,
 * with `totalAttempts > 0`) still sorts above them. Subtracting `a`'s accuracy
 * from `b`'s yields highest first. `Array.prototype.sort` is stable, so ranges
 * whose accuracies compare equal (including all never-practiced ranges) keep
 * their input order. The input array is never mutated — a fresh, sorted array is
 * always returned (the input is copied with `.slice()` before sorting).
 */
export function sortRangesByAccuracy<T extends { id: string }>(
  ranges: T[],
  practiceStats: Record<string, { totalAttempts: number; correctAttempts: number }>,
): T[] {
  const accuracyOf = (id: string): number => {
    const stats = practiceStats[id]
    if (!stats || stats.totalAttempts === 0) return -1
    return (stats.correctAttempts / stats.totalAttempts) * 100
  }
  return ranges.slice().sort((a, b) => accuracyOf(b.id) - accuracyOf(a.id))
}
