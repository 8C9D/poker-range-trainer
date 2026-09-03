import { createHash } from 'node:crypto'

import {
  MAX_LEGACY_IMPORT_WARNINGS,
  type LegacyBackupCounts,
  type LegacyBackupV1,
  type LegacyPreservationWarning,
  type LegacyRange,
} from '@poker-range-trainer/contracts'
import { normalizeRangeHands } from '@poker-range-trainer/domain/domain/rangeMath'
import type {
  ActionType,
  GameType,
  Position,
  TableSize,
} from '@poker-range-trainer/domain/types/range'

/** The only backup version this API reads or writes. */
export const LEGACY_BACKUP_VERSION = 1

const DIGEST_PREFIX = 'sha256:'

/** Database bounds the importer normalises towards; see `ranges`/`review_states` checks. */
export const MAX_RANGE_NAME_LENGTH = 120
export const MAX_RANGE_NOTES_LENGTH = 2_000
export const MAX_STACK_DEPTH_BB = 10_000
export const MIN_REVIEW_EASE = 1.3
export const MAX_REVIEW_EASE = 999.99
export const MAX_DAILY_HAND_GOAL = 1_000_000_000
export const FALLBACK_RANGE_NAME = 'Untitled range'

/** Range fields the active product stores in columns; everything else is dormant. */
export const SUPPORTED_RANGE_KEYS = [
  'id',
  'name',
  'hands',
  'createdAt',
  'updatedAt',
  'metadata',
  'archived',
  'favorite',
] as const

/** Scenario metadata fields the active product stores in columns. */
export const SUPPORTED_METADATA_KEYS = [
  'gameType',
  'tableSize',
  'stackDepthBb',
  'position',
  'actionType',
  'versusPosition',
  'notes',
] as const

/** Root fields of the v1 backup file. */
export const SUPPORTED_BACKUP_KEYS = [
  'version',
  'exportedAt',
  'ranges',
  'practiceStats',
  'handAccuracy',
  'actionAccuracy',
  'sessionHistory',
  'reviewStates',
  'spotAccuracy',
  'trainingGoal',
] as const

const supportedRangeKeys = new Set<string>(SUPPORTED_RANGE_KEYS)
const supportedMetadataKeys = new Set<string>(SUPPORTED_METADATA_KEYS)
const supportedBackupKeys = new Set<string>(SUPPORTED_BACKUP_KEYS)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type LegacyRangeMetadata = NonNullable<LegacyRange['metadata']>

/** A range with no metadata reads exactly like a range whose metadata is empty. */
const EMPTY_METADATA: LegacyRangeMetadata = {}

/**
 * JSON with every object's keys in sorted order, so two files that differ only
 * in key order hash identically and a re-uploaded backup is recognised.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    const body = entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')
    return `{${body}}`
  }
  return JSON.stringify(value)
}

/** Content digest of a validated backup, in the contract's `sha256:<hex>` form. */
export function legacyBackupDigest(backup: LegacyBackupV1): string {
  return `${DIGEST_PREFIX}${createHash('sha256').update(stableStringify(backup), 'utf8').digest('hex')}`
}

/** The bare 64-hex half stored in `legacy_imports.backup_sha256`. */
export function digestHex(digest: string): string {
  return digest.startsWith(DIGEST_PREFIX) ? digest.slice(DIGEST_PREFIX.length) : digest
}

/**
 * Identity of one legacy drill, so the same session can never be imported twice
 * even if the same backup is re-uploaded under a different digest.
 */
export function sessionFingerprint(session: {
  rangeId: string
  playedAt: string
  totalQuestions: number
  correctAnswers: number
}): string {
  const canonical = [
    session.rangeId,
    session.playedAt,
    session.totalQuestions,
    session.correctAnswers,
  ].join('|')
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function countNested(record: Record<string, Record<string, unknown>>): number {
  return Object.values(record).reduce((total, entries) => total + Object.keys(entries).length, 0)
}

/**
 * What a backup contains. `handAccuracy` and `actionAccuracy` count the leaf
 * records rather than the ranges holding them, so a preview count and the
 * committed row count describe the same quantity.
 */
export function countLegacyBackup(backup: LegacyBackupV1): LegacyBackupCounts {
  return {
    ranges: backup.ranges.length,
    practiceStats: Object.keys(backup.practiceStats).length,
    handAccuracy: countNested(backup.handAccuracy),
    actionAccuracy: countNested(backup.actionAccuracy),
    sessions: Object.values(backup.sessionHistory).reduce(
      (total, sessions) => total + sessions.length,
      0,
    ),
    reviewStates: Object.keys(backup.reviewStates).length,
    spotAccuracy: Object.keys(backup.spotAccuracy ?? {}).length,
  }
}

/** Scenario metadata as the `ranges` columns hold it. */
export interface NormalizedRangeMetadata {
  gameType: GameType | null
  tableSize: TableSize | null
  /** NUMERIC(8, 2) is exchanged as a string, exactly like the range repository does. */
  stackDepthBb: string | null
  position: Position | null
  actionType: ActionType | null
  versusPosition: Position | null
  notes: string | null
}

/** One legacy range reduced to what the database can store, plus what it cannot. */
export interface NormalizedLegacyRange {
  index: number
  legacyRangeId: string
  name: string
  hands: string[]
  createdAt: Date
  updatedAt: Date
  archived: boolean
  favorite: boolean
  metadata: NormalizedRangeMetadata
  /** Dormant fields and pre-normalisation originals, or null when nothing is dormant. */
  legacyPayload: Record<string, unknown> | null
}

export interface NormalizedLegacyRangeResult {
  /** null when the range cannot be stored at all; `warnings` says why. */
  range: NormalizedLegacyRange | null
  warnings: LegacyPreservationWarning[]
}

function dormantWarning(
  path: (string | number)[],
  message: string,
): LegacyPreservationWarning {
  return { kind: 'dormant_range_fields', path, message }
}

function normalizeName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return FALLBACK_RANGE_NAME
  if (trimmed.length <= MAX_RANGE_NAME_LENGTH) return trimmed
  const truncated = trimmed.slice(0, MAX_RANGE_NAME_LENGTH).trim()
  return truncated.length === 0 ? FALLBACK_RANGE_NAME : truncated
}

function normalizeNotes(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.length <= MAX_RANGE_NOTES_LENGTH
    ? trimmed
    : trimmed.slice(0, MAX_RANGE_NOTES_LENGTH).trim()
}

/** Rounded to the stored scale; out-of-range depths become null and stay in the payload. */
function normalizeStackDepth(raw: number): string | null {
  const rounded = Math.round(raw * 100) / 100
  if (rounded <= 0 || rounded > MAX_STACK_DEPTH_BB) return null
  return rounded.toFixed(2)
}

/** Ease clamped into the stored NUMERIC(5, 2) domain the review check requires. */
export function normalizeReviewEase(raw: number): string {
  return Math.min(Math.max(raw, MIN_REVIEW_EASE), MAX_REVIEW_EASE).toFixed(2)
}

/** A goal beyond the stored bound still has to import; the target is capped, not dropped. */
export function normalizeTrainingGoal(raw: number): number | null {
  if (raw <= 0) return null
  return Math.min(raw, MAX_DAILY_HAND_GOAL)
}

/**
 * Reduce one legacy range to the columns that hold it, preserving every field
 * the active product has no home for in `legacy_payload`.
 *
 * A range with no hands is not storable: the library only lists ranges with
 * membership, so it is reported and skipped rather than half-imported.
 */
export function normalizeLegacyRange(range: LegacyRange, index: number): NormalizedLegacyRangeResult {
  const warnings: LegacyPreservationWarning[] = []
  const source = range as unknown as Record<string, unknown>
  const payload: Record<string, unknown> = {}

  for (const key of Object.keys(source)) {
    if (supportedRangeKeys.has(key)) continue
    payload[key] = source[key]
    warnings.push(
      dormantWarning(
        ['ranges', index, key],
        `Range "${range.id}" carries the dormant field "${key}"; it is preserved but not used.`,
      ),
    )
  }

  const metadata: LegacyRangeMetadata = range.metadata ?? EMPTY_METADATA
  const metadataRecord = metadata as Record<string, unknown>
  const metadataPayload: Record<string, unknown> = {}
  for (const key of Object.keys(metadata)) {
    if (supportedMetadataKeys.has(key)) continue
    metadataPayload[key] = metadataRecord[key]
    warnings.push(
      dormantWarning(
        ['ranges', index, 'metadata', key],
        `Range "${range.id}" carries the dormant metadata field "${key}"; it is preserved but not used.`,
      ),
    )
  }

  const name = normalizeName(range.name)
  if (name !== range.name) {
    payload.name = range.name
    warnings.push(
      dormantWarning(
        ['ranges', index, 'name'],
        `Range "${range.id}" was renamed to fit the stored limit; the original name is preserved.`,
      ),
    )
  }

  const rawNotes = metadata.notes ?? null
  let notes: string | null = null
  if (rawNotes !== null) {
    notes = normalizeNotes(rawNotes)
    if (notes !== rawNotes) {
      metadataPayload.notes = rawNotes
      warnings.push(
        dormantWarning(
          ['ranges', index, 'metadata', 'notes'],
          `Range "${range.id}" had its notes trimmed to fit the stored limit; the original notes are preserved.`,
        ),
      )
    }
  }

  const rawStackDepth = metadata.stackDepthBb ?? null
  let stackDepthBb: string | null = null
  if (rawStackDepth !== null) {
    stackDepthBb = normalizeStackDepth(rawStackDepth)
    if (stackDepthBb === null || Number(stackDepthBb) !== rawStackDepth) {
      metadataPayload.stackDepthBb = rawStackDepth
      warnings.push(
        dormantWarning(
          ['ranges', index, 'metadata', 'stackDepthBb'],
          `Range "${range.id}" has a stack depth the database cannot store exactly; the original value is preserved.`,
        ),
      )
    }
  }

  if (Object.keys(metadataPayload).length > 0) payload.metadata = metadataPayload
  const legacyPayload = Object.keys(payload).length > 0 ? payload : null

  if (range.hands.length === 0) {
    warnings.push(
      dormantWarning(
        ['ranges', index, 'hands'],
        `Range "${range.id}" selects no hands and cannot be listed, so it is not imported.`,
      ),
    )
    return { range: null, warnings }
  }

  return {
    range: {
      index,
      legacyRangeId: range.id,
      name,
      hands: normalizeRangeHands(range.hands),
      createdAt: new Date(range.createdAt),
      updatedAt: new Date(range.updatedAt),
      archived: range.archived ?? false,
      favorite: range.favorite ?? false,
      metadata: {
        gameType: metadata.gameType ?? null,
        tableSize: metadata.tableSize ?? null,
        stackDepthBb,
        position: metadata.position ?? null,
        actionType: metadata.actionType ?? null,
        versusPosition: metadata.versusPosition ?? null,
        notes,
      },
      legacyPayload,
    },
    warnings,
  }
}

/**
 * Everything the import will keep but not act on: dormant range fields, unknown
 * root fields, values normalised to fit the database, and the retired
 * action/spot accuracy records that survive only inside the import snapshot.
 */
export function derivePreservationWarnings(backup: LegacyBackupV1): LegacyPreservationWarning[] {
  const warnings: LegacyPreservationWarning[] = []

  for (const key of Object.keys(backup)) {
    if (supportedBackupKeys.has(key)) continue
    warnings.push({
      kind: 'unknown_backup_fields',
      path: [key],
      message: `The backup carries the unknown field "${key}"; it is preserved in the import record.`,
    })
  }

  for (const [index, range] of backup.ranges.entries()) {
    warnings.push(...normalizeLegacyRange(range, index).warnings)
  }

  if (countNested(backup.actionAccuracy) > 0) {
    warnings.push({
      kind: 'retired_accuracy_records',
      path: ['actionAccuracy'],
      message:
        'Per-action accuracy is a retired feature; the records are preserved in the import record only.',
    })
  }
  if (Object.keys(backup.spotAccuracy ?? {}).length > 0) {
    warnings.push({
      kind: 'retired_accuracy_records',
      path: ['spotAccuracy'],
      message:
        'Per-spot accuracy is a retired feature; the records are preserved in the import record only.',
    })
  }

  // The contract bounds the reported list; the import record keeps the file whole.
  return warnings.slice(0, MAX_LEGACY_IMPORT_WARNINGS)
}

/** One stored range, as the export reads it back out of the database. */
export interface ExportRangeRow {
  id: string
  legacyRangeId: string | null
  name: string
  hands: string[]
  createdAt: string
  updatedAt: string
  archived: boolean
  favorite: boolean
  gameType: GameType | null
  tableSize: TableSize | null
  stackDepthBb: number | null
  position: Position | null
  actionType: ActionType | null
  versusPosition: Position | null
  notes: string | null
  legacyPayload: Record<string, unknown> | null
}

export interface ExportHandAccuracyRow {
  hand: string
  attempts: number
  correct: number
  falsePositives: number
  falseNegatives: number
}

export interface ExportSessionRow {
  playedAt: string
  totalQuestions: number
  correctAnswers: number
}

export interface ExportPracticeStatRow {
  totalAttempts: number
  correctAttempts: number
  lastPracticedAt: string
}

export interface ExportReviewRow {
  ease: number
  intervalDays: number
  dueAt: string | null
  lastReviewedAt: string | null
}

/** Owner-scoped rows behind one export, keyed by the stored range identifier. */
export interface ExportSnapshot {
  ranges: ExportRangeRow[]
  practiceStats: Record<string, ExportPracticeStatRow>
  handAccuracy: Record<string, ExportHandAccuracyRow[]>
  sessionHistory: Record<string, ExportSessionRow[]>
  reviewStates: Record<string, ExportReviewRow>
  trainingGoal: number | null
}

function exportMetadata(row: ExportRangeRow): Record<string, unknown> | undefined {
  const payloadMetadata = row.legacyPayload?.metadata
  const preserved = isPlainObject(payloadMetadata) ? payloadMetadata : {}
  // Stored columns win over a stale payload copy of the same field.
  const metadata: Record<string, unknown> = { ...preserved }
  if (row.gameType !== null) metadata.gameType = row.gameType
  if (row.tableSize !== null) metadata.tableSize = row.tableSize
  if (row.stackDepthBb !== null) metadata.stackDepthBb = row.stackDepthBb
  if (row.position !== null) metadata.position = row.position
  if (row.actionType !== null) metadata.actionType = row.actionType
  if (row.versusPosition !== null) metadata.versusPosition = row.versusPosition
  if (row.notes !== null) metadata.notes = row.notes
  return Object.keys(metadata).length === 0 ? undefined : metadata
}

function exportRange(row: ExportRangeRow): Record<string, unknown> {
  const dormant: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row.legacyPayload ?? {})) {
    // `metadata` is merged into the scenario fields rather than replacing them.
    if (supportedRangeKeys.has(key)) continue
    dormant[key] = value
  }
  const metadata = exportMetadata(row)
  return {
    ...dormant,
    id: row.legacyRangeId ?? row.id,
    name: row.name,
    hands: row.hands,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(metadata === undefined ? {} : { metadata }),
    ...(row.archived ? { archived: true } : {}),
    ...(row.favorite ? { favorite: true } : {}),
  }
}

/**
 * Shape one owner's live library back into a v1 backup file. Every range is
 * keyed by the identifier it was imported under, so a backup exported here
 * re-imports onto the same records rather than duplicating them.
 */
export function buildLegacyBackupExport(
  snapshot: ExportSnapshot,
  exportedAt: string,
): Record<string, unknown> {
  const practiceStats: Record<string, unknown> = {}
  const handAccuracy: Record<string, unknown> = {}
  const sessionHistory: Record<string, unknown> = {}
  const reviewStates: Record<string, unknown> = {}

  for (const row of snapshot.ranges) {
    const key = row.legacyRangeId ?? row.id
    const stat = snapshot.practiceStats[row.id]
    if (stat) {
      practiceStats[key] = {
        rangeId: key,
        totalAttempts: stat.totalAttempts,
        correctAttempts: stat.correctAttempts,
        lastPracticedAt: stat.lastPracticedAt,
      }
    }
    const hands = snapshot.handAccuracy[row.id]
    if (hands && hands.length > 0) {
      handAccuracy[key] = Object.fromEntries(hands.map((entry) => [entry.hand, { ...entry }]))
    }
    const sessions = snapshot.sessionHistory[row.id]
    if (sessions && sessions.length > 0) {
      sessionHistory[key] = sessions.map((session) => ({ rangeId: key, ...session }))
    }
    const review = snapshot.reviewStates[row.id]
    if (review) {
      reviewStates[key] = {
        rangeId: key,
        ease: review.ease,
        intervalDays: review.intervalDays,
        // The legacy file spells "never scheduled" as an empty string.
        dueAt: review.dueAt ?? '',
        lastReviewedAt: review.lastReviewedAt ?? '',
      }
    }
  }

  return {
    version: LEGACY_BACKUP_VERSION,
    exportedAt,
    ranges: snapshot.ranges.map(exportRange),
    practiceStats,
    handAccuracy,
    // Per-action accuracy is retired; the file keeps the field so v1 stays readable.
    actionAccuracy: {},
    sessionHistory,
    reviewStates,
    trainingGoal: snapshot.trainingGoal ?? 0,
  }
}
