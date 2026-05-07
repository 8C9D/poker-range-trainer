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
