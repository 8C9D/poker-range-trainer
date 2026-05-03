import { isValidHand, type PokerHand } from '../domain/pokerHands'
import { normalizeRangeHands } from '../domain/rangeMath'
import type { SavedRange } from '../types/range'

/**
 * Local persistence for saved preflop ranges, backed by `localStorage`.
 *
 * Deliberately small and side-effect-only so it can later be swapped for a
 * backend without touching callers: all reads/writes go through the four
 * exported functions and a single storage key.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const STORAGE_KEY = 'poker-range-trainer.saved-ranges.v1'

/** Validate a parsed value as a `SavedRange`, returning `null` if it is malformed. */
function parseSavedRange(value: unknown): SavedRange | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, name, hands, createdAt, updatedAt } = value as Record<string, unknown>

  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof name !== 'string') return null
  if (typeof createdAt !== 'string') return null
  if (typeof updatedAt !== 'string') return null
  if (!Array.isArray(hands)) return null

  // Reject the whole entry on any invalid hand rather than silently dropping it.
  const validatedHands: PokerHand[] = []
  for (const hand of hands) {
    if (typeof hand !== 'string' || !isValidHand(hand)) return null
    validatedHands.push(hand)
  }

  // Hands are valid, so normalize (de-dupe + canonical order) without throwing.
  return { id, name, createdAt, updatedAt, hands: normalizeRangeHands(validatedHands) }
}

/** Persist the full list, serialized under the single storage key. */
function writeSavedRanges(ranges: SavedRange[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges))
}

/**
 * All saved ranges in stored order.
 *
 * Returns an empty array when nothing is stored, the JSON is corrupt, or the
 * stored value is not an array. Individual malformed entries are skipped so one
 * bad record never discards the rest.
 */
export function loadSavedRanges(): SavedRange[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const ranges: SavedRange[] = []
  for (const entry of parsed) {
    const range = parseSavedRange(entry)
    if (range !== null) ranges.push(range)
  }
  return ranges
}

/** The saved range with the given id, or `undefined` if none matches. */
export function findSavedRangeById(id: string): SavedRange | undefined {
  return loadSavedRanges().find((range) => range.id === id)
}

/**
 * Insert or update a range by id, preserving stable ordering.
 *
 * An existing id is replaced in place (its position is kept); a new id is
 * appended. Hands are normalized and validated first, so an invalid hand throws
 * before any write and leaves existing storage untouched.
 */
export function saveSavedRange(range: SavedRange): void {
  const normalized: SavedRange = { ...range, hands: normalizeRangeHands(range.hands) }

  const ranges = loadSavedRanges()
  const index = ranges.findIndex((existing) => existing.id === normalized.id)
  if (index === -1) {
    ranges.push(normalized)
  } else {
    ranges[index] = normalized
  }
  writeSavedRanges(ranges)
}

/** Remove the range with the given id. No-op when the id is not present. */
export function deleteSavedRange(id: string): void {
  const ranges = loadSavedRanges()
  const remaining = ranges.filter((range) => range.id !== id)
  if (remaining.length !== ranges.length) {
    writeSavedRanges(remaining)
  }
}
