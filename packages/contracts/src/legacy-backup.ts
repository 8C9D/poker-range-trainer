import { z } from 'zod'

import { parseSpotKey } from '@poker-range-trainer/domain/domain/spot'
import {
  ACTION_TYPES,
  GAME_TYPES,
  POSITIONS,
  RANGE_ACTIONS,
  TABLE_SIZES,
} from '@poker-range-trainer/domain/types/range'

import { handCodeSchema, successResponseSchema, timestampSchema } from './common.js'

/** The maximum file size an import endpoint may accept before parsing JSON. */
export const MAX_LEGACY_BACKUP_BYTES = 64 * 1024 * 1024

/** Structural bounds stop a syntactically valid backup from exhausting the API. */
export const MAX_LEGACY_RANGES = 10_000
export const MAX_LEGACY_SESSIONS_PER_RANGE = 50_000
export const MAX_LEGACY_RANGE_ID_LENGTH = 512
export const MAX_LEGACY_TEXT_LENGTH = 10_000
export const MAX_LEGACY_IMPORT_WARNINGS = 1_000

const legacyRangeIdSchema = z.string().min(1).max(MAX_LEGACY_RANGE_ID_LENGTH)
const nonNegativeIntegerSchema = z.number().int().nonnegative()
const positiveFiniteSchema = z.number().finite().positive()
const legacyRangeActionSchema = z.enum(RANGE_ACTIONS)
// `z.record(z.enum(...), value)` is exhaustive in Zod 4. Legacy action maps
// are intentionally sparse, so refine a string key instead.
const legacyRangeActionKeySchema = z.string().refine(
  (value) => legacyRangeActionSchema.safeParse(value).success,
  { message: 'Expected a known range action.' },
)

function isLegacySpotKey(value: string): boolean {
  return parseSpotKey(value) !== null
}

const legacySpotKeySchema = z.string().min(1).max(MAX_LEGACY_TEXT_LENGTH).refine(isLegacySpotKey, {
  message: 'spotKey is not a known preflop spot.',
})

const legacyMetadataSchema = z
  .object({
    gameType: z.enum(GAME_TYPES).optional(),
    tableSize: z.enum(TABLE_SIZES).optional(),
    stackDepthBb: positiveFiniteSchema.optional(),
    position: z.enum(POSITIONS).optional(),
    actionType: z.enum(ACTION_TYPES).optional(),
    versusPosition: z.enum(POSITIONS).optional(),
    notes: z.string().max(MAX_LEGACY_TEXT_LENGTH).optional(),
  })
  // An old client may have written future metadata. Preserve it without making
  // it part of the active web application's data model.
  .passthrough()

/**
 * One v1 saved range. The known learning-loop fields are validated strictly;
 * dormant per-range fields and unknown future fields pass through unchanged so
 * import is lossless without restoring archived product features.
 */
export const legacyRangeSchema = z
  .object({
    id: legacyRangeIdSchema,
    name: z.string().max(MAX_LEGACY_TEXT_LENGTH),
    hands: z.array(handCodeSchema).max(169),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    metadata: legacyMetadataSchema.optional(),
    archived: z.boolean().optional(),
    favorite: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((range, context) => {
    if (new Set(range.hands).size !== range.hands.length) {
      context.addIssue({ code: 'custom', path: ['hands'], message: 'Range hands must be unique.' })
    }
    if (Date.parse(range.createdAt) > Date.parse(range.updatedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt must not be earlier than createdAt.',
      })
    }
  })
export type LegacyRange = z.infer<typeof legacyRangeSchema>

const legacyPracticeStatSchema = z
  .object({
    rangeId: legacyRangeIdSchema,
    totalAttempts: nonNegativeIntegerSchema,
    correctAttempts: nonNegativeIntegerSchema,
    lastPracticedAt: timestampSchema,
  })
  .strict()
  .superRefine((stat, context) => {
    if (stat.correctAttempts > stat.totalAttempts) {
      context.addIssue({
        code: 'custom',
        path: ['correctAttempts'],
        message: 'correctAttempts must not exceed totalAttempts.',
      })
    }
  })

const legacyHandAccuracyStatSchema = z
  .object({
    hand: handCodeSchema,
    attempts: nonNegativeIntegerSchema,
    correct: nonNegativeIntegerSchema,
    falsePositives: nonNegativeIntegerSchema,
    falseNegatives: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((stat, context) => {
    if (stat.correct > stat.attempts) {
      context.addIssue({ code: 'custom', path: ['correct'], message: 'correct must not exceed attempts.' })
    }
    if (stat.falsePositives + stat.falseNegatives !== stat.attempts - stat.correct) {
      context.addIssue({
        code: 'custom',
        path: ['falsePositives'],
        message: 'False-positive and false-negative counts must equal all misses.',
      })
    }
  })

const legacyActionAccuracyStatSchema = z
  .object({
    action: legacyRangeActionSchema,
    attempts: nonNegativeIntegerSchema,
    correct: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((stat, context) => {
    if (stat.correct > stat.attempts) {
      context.addIssue({ code: 'custom', path: ['correct'], message: 'correct must not exceed attempts.' })
    }
  })

const legacySessionSchema = z
  .object({
    rangeId: legacyRangeIdSchema,
    playedAt: timestampSchema,
    totalQuestions: nonNegativeIntegerSchema.refine((value) => value > 0, {
      message: 'totalQuestions must be greater than zero.',
    }),
    correctAnswers: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((session, context) => {
    if (session.correctAnswers > session.totalQuestions) {
      context.addIssue({
        code: 'custom',
        path: ['correctAnswers'],
        message: 'correctAnswers must not exceed totalQuestions.',
      })
    }
  })

const legacyReviewStateSchema = z
  .object({
    rangeId: legacyRangeIdSchema,
    ease: positiveFiniteSchema,
    intervalDays: nonNegativeIntegerSchema,
    dueAt: z.union([timestampSchema, z.literal('')]),
    lastReviewedAt: z.union([timestampSchema, z.literal('')]),
  })
  .strict()
  .superRefine((state, context) => {
    const neverScheduled = state.intervalDays === 0 && state.dueAt === '' && state.lastReviewedAt === ''
    if (neverScheduled) return
    if (state.intervalDays === 0 || state.dueAt === '' || state.lastReviewedAt === '') {
      context.addIssue({
        code: 'custom',
        path: ['intervalDays'],
        message: 'A scheduled review needs a positive interval and both timestamps.',
      })
      return
    }
    if (Date.parse(state.dueAt) < Date.parse(state.lastReviewedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'dueAt must not be earlier than lastReviewedAt.',
      })
    }
  })

const legacySpotAccuracyStatSchema = z
  .object({
    spotKey: legacySpotKeySchema,
    attempts: nonNegativeIntegerSchema,
    correct: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((stat, context) => {
    if (stat.correct > stat.attempts) {
      context.addIssue({ code: 'custom', path: ['correct'], message: 'correct must not exceed attempts.' })
    }
  })

function boundedRecord<Value extends z.ZodType>(valueSchema: Value, maximum: number) {
  return z
    .record(legacyRangeIdSchema, valueSchema)
    .superRefine((record, context) => {
      if (Object.keys(record).length > maximum) {
        context.addIssue({ code: 'custom', message: `Record may contain at most ${maximum} entries.` })
      }
    })
}

const legacyPracticeStatsSchema = boundedRecord(legacyPracticeStatSchema, MAX_LEGACY_RANGES)

const legacyHandAccuracySchema = boundedRecord(
  z
    .record(handCodeSchema, legacyHandAccuracyStatSchema)
    .superRefine((record, context) => {
      if (Object.keys(record).length > 169) {
        context.addIssue({ code: 'custom', message: 'A range may contain at most 169 hand records.' })
      }
      for (const [hand, stat] of Object.entries(record)) {
        if (stat.hand !== hand) {
          context.addIssue({
            code: 'custom',
            path: [hand, 'hand'],
            message: 'Hand-accuracy map key must match stat.hand.',
          })
        }
      }
    }),
  MAX_LEGACY_RANGES,
)

const legacyActionAccuracySchema = boundedRecord(
  z
    .record(legacyRangeActionKeySchema, legacyActionAccuracyStatSchema)
    .superRefine((record, context) => {
      for (const [action, stat] of Object.entries(record)) {
        if (stat.action !== action) {
          context.addIssue({
            code: 'custom',
            path: [action, 'action'],
            message: 'Action-accuracy map key must match stat.action.',
          })
        }
      }
    }),
  MAX_LEGACY_RANGES,
)

const legacySessionHistorySchema = boundedRecord(
  z.array(legacySessionSchema).max(MAX_LEGACY_SESSIONS_PER_RANGE),
  MAX_LEGACY_RANGES,
)
const legacyReviewStatesSchema = boundedRecord(legacyReviewStateSchema, MAX_LEGACY_RANGES)
const legacySpotAccuracySchema = z
  .record(legacySpotKeySchema, legacySpotAccuracyStatSchema)
  .superRefine((record, context) => {
    if (Object.keys(record).length > MAX_LEGACY_RANGES) {
      context.addIssue({ code: 'custom', message: `Record may contain at most ${MAX_LEGACY_RANGES} entries.` })
    }
    for (const [spotKey, stat] of Object.entries(record)) {
      if (spotKey !== stat.spotKey) {
        context.addIssue({
          code: 'custom',
          path: [spotKey, 'spotKey'],
          message: 'Spot-accuracy map key must match stat.spotKey.',
        })
      }
    }
  })

/**
 * A structurally strict, lossless representation of the legacy local backup
 * file. Unknown root and range fields are retained for migration auditing; all
 * current persisted slices are checked instead of silently dropping records.
 */
export const legacyBackupV1Schema = z
  .object({
    version: z.literal(1),
    exportedAt: timestampSchema,
    ranges: z.array(legacyRangeSchema).max(MAX_LEGACY_RANGES),
    practiceStats: legacyPracticeStatsSchema,
    handAccuracy: legacyHandAccuracySchema,
    actionAccuracy: legacyActionAccuracySchema,
    sessionHistory: legacySessionHistorySchema,
    reviewStates: legacyReviewStatesSchema,
    spotAccuracy: legacySpotAccuracySchema.optional(),
    trainingGoal: nonNegativeIntegerSchema.optional(),
  })
  .passthrough()
  .superRefine((backup, context) => {
    const rangeIds = new Set<string>()
    for (const [index, range] of backup.ranges.entries()) {
      if (rangeIds.has(range.id)) {
        context.addIssue({ code: 'custom', path: ['ranges', index, 'id'], message: 'Range IDs must be unique.' })
      }
      rangeIds.add(range.id)
    }

    const ensureRangeMap = <T extends { rangeId: string }>(
      map: Record<string, T>,
      field: 'practiceStats' | 'reviewStates',
    ) => {
      for (const [key, record] of Object.entries(map)) {
        if (key !== record.rangeId) {
          context.addIssue({
            code: 'custom',
            path: [field, key, 'rangeId'],
            message: `${field} map key must match record.rangeId.`,
          })
        }
        if (!rangeIds.has(record.rangeId)) {
          context.addIssue({
            code: 'custom',
            path: [field, key, 'rangeId'],
            message: 'Referenced range does not exist in ranges.',
          })
        }
      }
    }

    ensureRangeMap(backup.practiceStats, 'practiceStats')
    ensureRangeMap(backup.reviewStates, 'reviewStates')

    for (const [rangeId, entries] of Object.entries(backup.handAccuracy)) {
      if (!rangeIds.has(rangeId)) {
        context.addIssue({
          code: 'custom',
          path: ['handAccuracy', rangeId],
          message: 'Referenced range does not exist in ranges.',
        })
      }
      void entries
    }
    for (const [rangeId, entries] of Object.entries(backup.actionAccuracy)) {
      if (!rangeIds.has(rangeId)) {
        context.addIssue({
          code: 'custom',
          path: ['actionAccuracy', rangeId],
          message: 'Referenced range does not exist in ranges.',
        })
      }
      void entries
    }
    for (const [rangeId, sessions] of Object.entries(backup.sessionHistory)) {
      if (!rangeIds.has(rangeId)) {
        context.addIssue({
          code: 'custom',
          path: ['sessionHistory', rangeId],
          message: 'Referenced range does not exist in ranges.',
        })
      }
      for (const [sessionIndex, session] of sessions.entries()) {
        if (session.rangeId !== rangeId) {
          context.addIssue({
            code: 'custom',
            path: ['sessionHistory', rangeId, sessionIndex, 'rangeId'],
            message: 'Session-history map key must match session.rangeId.',
          })
        }
      }
    }
  })
export type LegacyBackupV1 = z.infer<typeof legacyBackupV1Schema>

/** Check file metadata before reading a backup into memory. */
export function assertLegacyBackupSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_LEGACY_BACKUP_BYTES) {
    throw new Error(`Legacy backup must be between 0 and ${MAX_LEGACY_BACKUP_BYTES} bytes.`)
  }
}

const backupDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)

export const legacyBackupCountsSchema = z
  .object({
    ranges: nonNegativeIntegerSchema,
    practiceStats: nonNegativeIntegerSchema,
    handAccuracy: nonNegativeIntegerSchema,
    actionAccuracy: nonNegativeIntegerSchema,
    sessions: nonNegativeIntegerSchema,
    reviewStates: nonNegativeIntegerSchema,
    spotAccuracy: nonNegativeIntegerSchema,
  })
  .strict()
export type LegacyBackupCounts = z.infer<typeof legacyBackupCountsSchema>

export const legacyPreservationWarningSchema = z
  .object({
    kind: z.enum(['dormant_range_fields', 'unknown_backup_fields', 'retired_accuracy_records']),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])).min(1).max(20),
    message: z.string().min(1).max(500),
  })
  .strict()
export type LegacyPreservationWarning = z.infer<typeof legacyPreservationWarningSchema>

export const legacyImportConflictSchema = z
  .object({
    kind: z.enum(['already_imported', 'range_id_collision', 'merge_required']),
    rangeIds: z.array(legacyRangeIdSchema).max(MAX_LEGACY_RANGES),
    message: z.string().min(1).max(500),
  })
  .strict()
export type LegacyImportConflict = z.infer<typeof legacyImportConflictSchema>

export const legacyBackupPreviewRequestSchema = z.object({ backup: legacyBackupV1Schema }).strict()
export type LegacyBackupPreviewRequest = z.infer<typeof legacyBackupPreviewRequestSchema>

export const legacyBackupPreviewDataSchema = z
  .object({
    digest: backupDigestSchema,
    counts: legacyBackupCountsSchema,
    preservationWarnings: z.array(legacyPreservationWarningSchema).max(MAX_LEGACY_IMPORT_WARNINGS),
    conflicts: z.array(legacyImportConflictSchema).max(MAX_LEGACY_IMPORT_WARNINGS),
    alreadyImported: z.boolean(),
  })
  .strict()
export const legacyBackupPreviewResponseSchema = successResponseSchema(legacyBackupPreviewDataSchema)
export type LegacyBackupPreviewResponse = z.infer<typeof legacyBackupPreviewResponseSchema>

export const legacyBackupCommitRequestSchema = z
  .object({
    backup: legacyBackupV1Schema,
    expectedDigest: backupDigestSchema,
    strategy: z.enum(['merge', 'replace']),
  })
  .strict()
export type LegacyBackupCommitRequest = z.infer<typeof legacyBackupCommitRequestSchema>

/** A successful commit is atomic by contract; partial success is never representable. */
export const legacyBackupCommitDataSchema = z
  .object({
    result: z.literal('committed'),
    atomic: z.literal(true),
    digest: backupDigestSchema,
    strategy: z.enum(['merge', 'replace']),
    counts: legacyBackupCountsSchema,
  })
  .strict()
export const legacyBackupCommitResponseSchema = successResponseSchema(legacyBackupCommitDataSchema)
export type LegacyBackupCommitResponse = z.infer<typeof legacyBackupCommitResponseSchema>

/** Server-side export uses the same validated v1-compatible envelope. */
export const legacyBackupExportDataSchema = z.object({ backup: legacyBackupV1Schema }).strict()
export const legacyBackupExportResponseSchema = successResponseSchema(legacyBackupExportDataSchema)
export type LegacyBackupExportResponse = z.infer<typeof legacyBackupExportResponseSchema>
