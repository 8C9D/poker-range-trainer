import { isValidHand, type PokerHand } from '../domain/pokerHands'
import { allCombosForHand } from '../domain/comboSelection'
import { normalizeRangeHands } from '../domain/rangeMath'
import { normalizeTags } from '../domain/rangeLibrary'
import { normalizeMixedStrategy, type HandMixedStrategy } from '../domain/mixedStrategy'
import {
  ACTION_TYPES,
  GAME_TYPES,
  POSITIONS,
  RANGE_ACTIONS,
  RANGE_SOURCE_KINDS,
  TABLE_SIZES,
  type RangeAction,
  type RangeMetadata,
  type RangeSource,
  type SavedRange,
} from '../types/range'
import { asMember, readJson, writeJson } from './storageHelpers'

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
 * Each entry must have a canonical hand-class key and an array of canonical
 * `comboKey` strings that actually belong to that hand class. Non-array values,
 * non-string elements, impossible combos, and duplicates are dropped. As with
 * `normalizeHandActions`, a malformed map never rejects the whole range, and an
 * all-empty result collapses to `undefined` so `comboSelections: {}` is never
 * persisted (absence = all combos selected, the default).
 */
function normalizeComboSelections(
  value: unknown,
  rangeHands: ReadonlySet<PokerHand>,
): Record<PokerHand, string[]> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, string[]> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidHand(hand) || !rangeHands.has(hand) || !Array.isArray(raw)) continue
    const allowed = allCombosForHand(hand)
    const keys = [
      ...new Set(
        raw.filter(
          (key): key is string => typeof key === 'string' && allowed.has(key),
        ),
      ),
    ]
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
  rangeHands: ReadonlySet<PokerHand>,
): Record<PokerHand, HandMixedStrategy> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, HandMixedStrategy> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidHand(hand) || !rangeHands.has(hand) || !Array.isArray(raw)) continue
    const normalized = normalizeMixedStrategy(raw as HandMixedStrategy)
    if (normalized.length > 0) result[hand] = normalized
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Validate and sanitize an optional per-hand notes map.
 *
 * Each entry must have a canonical hand-class key and a string value that is
 * non-empty after trimming (the trimmed text is stored). Bad keys, non-string
 * values, and blank/whitespace-only notes are dropped, and an all-empty result
 * collapses to `undefined` so `handNotes: {}` is never persisted (absence = no
 * notes).
 */
function normalizeHandNotes(
  value: unknown,
  rangeHands: ReadonlySet<PokerHand>,
): Record<PokerHand, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const result: Record<PokerHand, string> = {}
  for (const [hand, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidHand(hand) || !rangeHands.has(hand) || typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (trimmed.length > 0) result[hand] = trimmed
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Validate and sanitize an optional range source/reference (provenance).
 *
 * `kind` is required and must be a recognized `RangeSourceKind`; an unknown or
 * missing kind collapses the whole source to `undefined` (a source with no kind
 * is meaningless). `reference` is trimmed, and a whitespace-only or non-string
 * reference is dropped. Like the other normalizers, a malformed source never
 * rejects the whole range, and absence means "no source recorded".
 */
function normalizeSource(value: unknown): RangeSource | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const kind = asMember(RANGE_SOURCE_KINDS, raw.kind)
  if (!kind) return undefined

  const source: RangeSource = { kind }
  if (typeof raw.reference === 'string') {
    const trimmed = raw.reference.trim()
    if (trimmed.length > 0) source.reference = trimmed
  }
  return source
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
    source,
    tags,
    archived,
    favorite,
    handActions,
    comboSelections,
    mixedStrategies,
    handNotes,
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
  const normalizedHands = normalizeRangeHands(validatedHands)
  const rangeHands = new Set(normalizedHands)
  const normalizedMetadata = normalizeMetadata(metadata)
  const normalizedSource = normalizeSource(source)
  const normalizedHandActions = normalizeHandActions(handActions)
  const normalizedComboSelections = normalizeComboSelections(comboSelections, rangeHands)
  const normalizedMixedStrategies = normalizeMixedStrategies(mixedStrategies, rangeHands)
  const normalizedHandNotes = normalizeHandNotes(handNotes, rangeHands)
  const normalizedTags = normalizeTags(tags)
  return {
    id,
    name,
    createdAt,
    updatedAt,
    hands: normalizedHands,
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    ...(normalizedSource ? { source: normalizedSource } : {}),
    ...(normalizedHandActions ? { handActions: normalizedHandActions } : {}),
    ...(normalizedComboSelections ? { comboSelections: normalizedComboSelections } : {}),
    ...(normalizedMixedStrategies ? { mixedStrategies: normalizedMixedStrategies } : {}),
    ...(normalizedHandNotes ? { handNotes: normalizedHandNotes } : {}),
    ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
    // Only a strict `true` persists; absent/false stays unarchived with no key.
    ...(archived === true ? { archived: true } : {}),
    // Same rule as archived: only a strict `true` persists the favorite flag.
    ...(favorite === true ? { favorite: true } : {}),
  }
}

/** Persist the full list, serialized under the single storage key. */
function writeSavedRanges(ranges: SavedRange[]): void {
  writeJson(STORAGE_KEY, ranges)
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
 * Normalize + validate a range for storage: metadata/source/hand-actions/combo/
 * mixed/notes are normalized and the hands are validated, so an invalid hand
 * throws HERE (before any write). Shared by {@link saveSavedRange},
 * {@link saveSavedRanges}, and {@link replaceSavedRanges}.
 */
function normalizeSavedRange(range: SavedRange): SavedRange {
  if (typeof range !== 'object' || range === null) {
    throw new Error('Cannot save a range that is not an object.')
  }
  const {
    id,
    name,
    hands,
    createdAt,
    updatedAt,
    metadata,
    source,
    tags,
    archived,
    favorite,
    handActions,
    comboSelections,
    mixedStrategies,
    handNotes,
    ...rest
  } = range
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Cannot save a range without an id.')
  }
  if (typeof name !== 'string') {
    throw new Error('Cannot save a range without a valid name.')
  }
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('Cannot save a range without valid timestamps.')
  }
  if (!Array.isArray(hands)) {
    throw new Error('Cannot save a range without a hands list.')
  }

  const normalizedHands = normalizeRangeHands(hands)
  const rangeHands = new Set(normalizedHands)
  const normalizedMetadata = normalizeMetadata(metadata)
  const normalizedSource = normalizeSource(source)
  const normalizedHandActions = normalizeHandActions(handActions)
  const normalizedComboSelections = normalizeComboSelections(comboSelections, rangeHands)
  const normalizedMixedStrategies = normalizeMixedStrategies(mixedStrategies, rangeHands)
  const normalizedHandNotes = normalizeHandNotes(handNotes, rangeHands)
  const normalizedTags = normalizeTags(tags)
  return {
    ...rest,
    id,
    name,
    createdAt,
    updatedAt,
    hands: normalizedHands,
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    ...(normalizedSource ? { source: normalizedSource } : {}),
    ...(normalizedHandActions ? { handActions: normalizedHandActions } : {}),
    ...(normalizedComboSelections ? { comboSelections: normalizedComboSelections } : {}),
    ...(normalizedMixedStrategies ? { mixedStrategies: normalizedMixedStrategies } : {}),
    ...(normalizedHandNotes ? { handNotes: normalizedHandNotes } : {}),
    ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
    // Mirror parse: only a strict `true` is stored, so `false`/undefined drops the key.
    ...(archived === true ? { archived: true } : {}),
    // Same rule as archived: only a strict `true` is stored for favorite.
    ...(favorite === true ? { favorite: true } : {}),
  }
}

/**
 * Insert or update a range by id, preserving stable ordering.
 *
 * An existing id is replaced in place (its position is kept); a new id is
 * appended. Hands are normalized and validated first, so an invalid hand throws
 * before any write and leaves existing storage untouched.
 */
export function saveSavedRange(range: SavedRange): void {
  saveSavedRanges([range])
}

/**
 * Insert or update several ranges by id in one atomic storage write.
 *
 * Every input is normalized before storage is touched, so one malformed range
 * rejects the whole batch and leaves the existing library unchanged. Existing
 * ids keep their position; new ids append in input order; repeated ids resolve
 * to the last input at the first position assigned to that id.
 */
export function saveSavedRanges(input: Iterable<SavedRange>): void {
  const normalizedRanges = Array.from(input, normalizeSavedRange)
  if (normalizedRanges.length === 0) return

  const ranges = loadSavedRanges()
  for (const normalized of normalizedRanges) {
    const index = ranges.findIndex((existing) => existing.id === normalized.id)
    if (index === -1) {
      ranges.push(normalized)
    } else {
      ranges[index] = normalized
    }
  }
  writeSavedRanges(ranges)
}

/** Remove the range with the given id. No-op when the id is not present. */
export function deleteSavedRange(id: string): void {
  deleteSavedRanges([id])
}

/** Remove every range whose id is in the supplied collection, in one storage write. */
export function deleteSavedRanges(ids: Iterable<string>): void {
  const idSet = new Set(ids)
  if (idSet.size === 0) return

  const ranges = loadSavedRanges()
  const remaining = ranges.filter((range) => !idSet.has(range.id))
  if (remaining.length !== ranges.length) {
    writeSavedRanges(remaining)
  }
}

/**
 * Replace the entire local library with the given ranges (used by cloud pull).
 * Each range is normalized/validated like {@link saveSavedRange}; order is
 * preserved (duplicate ids collapse to the last value in the first position) and
 * existing local ranges not present in the new list are discarded.
 *
 * The replace is ATOMIC: every range is normalized/validated before any write, so
 * a single malformed record throws and leaves the existing library intact instead
 * of wiping it and writing a partial result.
 */
export function replaceSavedRanges(ranges: SavedRange[]): void {
  const next: SavedRange[] = []
  for (const range of ranges) {
    const normalized = normalizeSavedRange(range)
    const index = next.findIndex((existing) => existing.id === normalized.id)
    if (index === -1) {
      next.push(normalized)
    } else {
      next[index] = normalized
    }
  }
  writeSavedRanges(next)
}
