import { isValidHand, type PokerHand } from '../domain/pokerHands'
import { normalizeRangeHands } from '../domain/rangeMath'
import { normalizeMixedStrategy, type HandMixedStrategy } from '../domain/mixedStrategy'
import {
  ACTION_TYPES,
  GAME_TYPES,
  POSITIONS,
  RANGE_ACTIONS,
  TABLE_SIZES,
  type RangeAction,
  type RangeMetadata,
  type SavedRange,
} from '../types/range'
import { asMember, readJson } from './storageHelpers'

/**
 * Local persistence for saved preflop ranges, backed by `localStorage`.
 *
 * Deliberately small and side-effect-only so it can later be swapped for a
 * backend without touching callers: all reads/writes go through the four
 * exported functions and a single storage key.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const STORAGE_KEY = 'poker-range-trainer.saved-ranges.v1'

/**
 * Validate and normalize optional scenario metadata.
 *
 * Returns `undefined` when the input is missing, not an object, or has no
 * recognized fields. Unlike hand validation, malformed metadata never rejects
 * the whole range: each field is validated independently and unknown or invalid
 * fields are simply dropped. This preserves a range's hands through bad
 * metadata and lets unknown future fields degrade gracefully. An all-empty
 * result collapses to `undefined` so `metadata: {}` is never persisted.
 */
function normalizeMetadata(value: unknown): RangeMetadata | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const metadata: RangeMetadata = {}

  const gameType = asMember(GAME_TYPES, raw.gameType)
  if (gameType) metadata.gameType = gameType

  const tableSize = asMember(TABLE_SIZES, raw.tableSize)
  if (tableSize) metadata.tableSize = tableSize

  const position = asMember(POSITIONS, raw.position)
  if (position) metadata.position = position

  const actionType = asMember(ACTION_TYPES, raw.actionType)
  if (actionType) metadata.actionType = actionType

  const versusPosition = asMember(POSITIONS, raw.versusPosition)
  if (versusPosition) metadata.versusPosition = versusPosition

  // Stack depth must be a positive, finite number; anything else is dropped.
  const { stackDepthBb } = raw
  if (typeof stackDepthBb === 'number' && Number.isFinite(stackDepthBb) && stackDepthBb > 0) {
    metadata.stackDepthBb = stackDepthBb
  }

  // Notes are trimmed; whitespace-only or non-string notes are dropped.
  if (typeof raw.notes === 'string') {
    const trimmed = raw.notes.trim()
    if (trimmed.length > 0) metadata.notes = trimmed
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

/**
 * Validate and sanitize an optional per-hand action map.
 *
 * Like `normalizeMetadata`, a malformed map never rejects the whole range: only
 * entries with a canonical hand key and a recognized `RangeAction` value survive,
 * and an all-empty result collapses to `undefined` so `handActions: {}` is never
 * persisted (a hands-only range stays without the field).
 */
function normalizeHandActions(value: unknown): Record<PokerHand, RangeAction> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, RangeAction> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    const action = asMember(RANGE_ACTIONS, raw)
    if (action && isValidHand(hand)) result[hand] = action
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Validate and sanitize an optional per-hand-class combo-selection map.
 *
 * Each entry must have a canonical hand-class key and an array of `comboKey`
 * strings; non-array values and non-string keys/elements are dropped. As with
 * `normalizeHandActions`, a malformed map never rejects the whole range, and an
 * all-empty result collapses to `undefined` so `comboSelections: {}` is never
 * persisted (absence = all combos selected, the default).
 */
function normalizeComboSelections(value: unknown): Record<PokerHand, string[]> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, string[]> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidHand(hand) || !Array.isArray(raw)) continue
    const keys = raw.filter((key): key is string => typeof key === 'string')
    result[hand] = keys
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Validate and sanitize an optional per-hand mixed-frequency strategy map.
 *
 * Each entry must have a canonical hand-class key and an array value; the value
 * is run through `normalizeMixedStrategy` (dropping bad frequencies / unknown
 * actions, merging duplicates, canonical order). Entries that normalize to empty
 * are dropped, and an all-empty result collapses to `undefined` so
 * `mixedStrategies: {}` is never persisted (absence = no overlay).
 */
function normalizeMixedStrategies(
  value: unknown,
): Record<PokerHand, HandMixedStrategy> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, HandMixedStrategy> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidHand(hand) || !Array.isArray(raw)) continue
    const normalized = normalizeMixedStrategy(raw as HandMixedStrategy)
    if (normalized.length > 0) result[hand] = normalized
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/** Validate a parsed value as a `SavedRange`, returning `null` if it is malformed. */
function parseSavedRange(value: unknown): SavedRange | null {
  if (typeof value !== 'object' || value === null) return null
  const {
    id,
    name,
    hands,
    createdAt,
    updatedAt,
    metadata,
    archived,
    favorite,
    handActions,
    comboSelections,
    mixedStrategies,
  } = value as Record<string, unknown>

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
  const normalizedMetadata = normalizeMetadata(metadata)
  const normalizedHandActions = normalizeHandActions(handActions)
  const normalizedComboSelections = normalizeComboSelections(comboSelections)
  const normalizedMixedStrategies = normalizeMixedStrategies(mixedStrategies)
  return {
    id,
    name,
    createdAt,
    updatedAt,
    hands: normalizeRangeHands(validatedHands),
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    ...(normalizedHandActions ? { handActions: normalizedHandActions } : {}),
    ...(normalizedComboSelections ? { comboSelections: normalizedComboSelections } : {}),
    ...(normalizedMixedStrategies ? { mixedStrategies: normalizedMixedStrategies } : {}),
    // Only a strict `true` persists; absent/false stays unarchived with no key.
    ...(archived === true ? { archived: true } : {}),
    // Same rule as archived: only a strict `true` persists the favorite flag.
    ...(favorite === true ? { favorite: true } : {}),
  }
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
  const parsed = readJson(STORAGE_KEY)
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
  const { metadata, archived, favorite, handActions, comboSelections, mixedStrategies, ...rest } =
    range
  const normalizedMetadata = normalizeMetadata(metadata)
  const normalizedHandActions = normalizeHandActions(handActions)
  const normalizedComboSelections = normalizeComboSelections(comboSelections)
  const normalizedMixedStrategies = normalizeMixedStrategies(mixedStrategies)
  const normalized: SavedRange = {
    ...rest,
    hands: normalizeRangeHands(range.hands),
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    ...(normalizedHandActions ? { handActions: normalizedHandActions } : {}),
    ...(normalizedComboSelections ? { comboSelections: normalizedComboSelections } : {}),
    ...(normalizedMixedStrategies ? { mixedStrategies: normalizedMixedStrategies } : {}),
    // Mirror parse: only a strict `true` is stored, so `false`/undefined drops the key.
    ...(archived === true ? { archived: true } : {}),
    // Same rule as archived: only a strict `true` is stored for favorite.
    ...(favorite === true ? { favorite: true } : {}),
  }

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

/**
 * Replace the entire local library with the given ranges (used by cloud pull).
 * Each range is normalized/validated like {@link saveSavedRange}; order is
 * preserved. Existing local ranges not present in the new list are discarded.
 */
export function replaceSavedRanges(ranges: SavedRange[]): void {
  writeSavedRanges([])
  for (const range of ranges) {
    saveSavedRange(range)
  }
}
