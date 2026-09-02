import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MAX_LEGACY_BACKUP_BYTES,
  assertLegacyBackupSize,
  legacyBackupCommitRequestSchema,
  legacyBackupCommitResponseSchema,
  legacyBackupExportResponseSchema,
  legacyBackupPreviewRequestSchema,
  legacyBackupPreviewResponseSchema,
  legacyBackupV1Schema,
} from './index.js'

const seedBackupPath = [
  resolve(process.cwd(), 'screenshots/seed-backup.json'),
  resolve(process.cwd(), '../../screenshots/seed-backup.json'),
].find(existsSync)

if (!seedBackupPath) {
  throw new Error('Could not locate screenshots/seed-backup.json.')
}

const seedBackup: unknown = JSON.parse(readFileSync(seedBackupPath, 'utf8'))

const digest = `sha256:${'a'.repeat(64)}`
const counts = {
  ranges: 2,
  practiceStats: 1,
  handAccuracy: 1,
  actionAccuracy: 0,
  sessions: 1,
  reviewStates: 1,
  spotAccuracy: 0,
}

function copySeed(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(seedBackup)) as Record<string, unknown>
}

describe('legacy backup v1 contract', () => {
  it('parses the checked-in legacy screenshot fixture without dropping dormant fields', () => {
    const backup = copySeed()
    ;(backup.ranges as Array<Record<string, unknown>>)[0]!.handActions = { AA: 'raise' }
    ;(backup.ranges as Array<Record<string, unknown>>)[0]!.unknownRetiredField = { opaque: true }
    backup.unknownBackupField = { retainedForAudit: ['legacy'] }

    const parsed = legacyBackupV1Schema.parse(backup)
    const firstRange = parsed.ranges[0]

    expect(parsed.version).toBe(1)
    expect(firstRange?.source).toEqual({ kind: 'coach', reference: 'Preflop lab, module 4' })
    expect(firstRange?.tags).toEqual(['6-max', 'RFI'])
    expect(firstRange?.handActions).toEqual({ AA: 'raise' })
    expect(firstRange?.unknownRetiredField).toEqual({ opaque: true })
    expect(parsed.unknownBackupField).toEqual({ retainedForAudit: ['legacy'] })
  })

  it('accepts legacy backups without optional spot accuracy and training goal', () => {
    const backup = copySeed()
    delete backup.spotAccuracy
    delete backup.trainingGoal

    expect(legacyBackupV1Schema.parse(backup)).not.toHaveProperty('spotAccuracy')
    expect(legacyBackupV1Schema.parse(backup)).not.toHaveProperty('trainingGoal')
  })

  it('rejects duplicate range IDs, broken map keys, and records for deleted ranges', () => {
    const duplicate = copySeed()
    const duplicateRanges = duplicate.ranges as Array<Record<string, unknown>>
    duplicateRanges.push({ ...duplicateRanges[0] })
    expect(legacyBackupV1Schema.safeParse(duplicate).success).toBe(false)

    const mismatched = copySeed()
    const stats = mismatched.practiceStats as Record<string, Record<string, unknown>>
    const [rangeId, stat] = Object.entries(stats)[0] as [string, Record<string, unknown>]
    stats[rangeId] = { ...stat, rangeId: 'other-range' }
    expect(legacyBackupV1Schema.safeParse(mismatched).success).toBe(false)

    const orphan = copySeed()
    ;(orphan.handAccuracy as Record<string, unknown>)['deleted-range'] = {}
    expect(legacyBackupV1Schema.safeParse(orphan).success).toBe(false)

    const mismatchedAction = copySeed()
    const actionRecords = Object.values(
      mismatchedAction.actionAccuracy as Record<string, Record<string, Record<string, unknown>>>,
    )[0]!
    const [action, actionRecord] = Object.entries(actionRecords)[0] as [string, Record<string, unknown>]
    actionRecords[action] = { ...actionRecord, action: 'call' }
    expect(legacyBackupV1Schema.safeParse(mismatchedAction).success).toBe(false)

    const mismatchedSession = copySeed()
    const sessionRecords = Object.values(
      mismatchedSession.sessionHistory as Record<string, Array<Record<string, unknown>>>,
    )[0]!
    sessionRecords[0] = { ...sessionRecords[0], rangeId: 'other-range' }
    expect(legacyBackupV1Schema.safeParse(mismatchedSession).success).toBe(false)

    const mismatchedSpotKey = copySeed()
    const spotAccuracy = mismatchedSpotKey.spotAccuracy as Record<string, Record<string, unknown>>
    const [spotKey, spotRecord] = Object.entries(spotAccuracy)[0] as [string, Record<string, unknown>]
    spotAccuracy[spotKey] = { ...spotRecord, spotKey: 'sixMax|co|foldedToYou|-|100' }
    expect(legacyBackupV1Schema.safeParse(mismatchedSpotKey).success).toBe(false)

  })

  it('accepts domain-valid orphaned spot records and rejects malformed spot keys', () => {
    const domainValidSpot = copySeed()
    const spotAccuracy = domainValidSpot.spotAccuracy as Record<string, Record<string, unknown>>
    const [firstSpotKey, firstSpotRecord] = Object.entries(spotAccuracy)[0] as [string, Record<string, unknown>]
    delete spotAccuracy[firstSpotKey]
    spotAccuracy['sixMax|bb|foldedToYou|-|100'] = {
      ...firstSpotRecord,
      spotKey: 'sixMax|bb|foldedToYou|-|100',
    }
    expect(legacyBackupV1Schema.safeParse(domainValidSpot).success).toBe(true)

    const malformedSpot = copySeed()
    const malformedSpotAccuracy = malformedSpot.spotAccuracy as Record<string, Record<string, unknown>>
    const [spotKey, spotRecord] = Object.entries(malformedSpotAccuracy)[0] as [string, Record<string, unknown>]
    delete malformedSpotAccuracy[spotKey]
    malformedSpotAccuracy['sixMax|btn|not-a-situation|-|100'] = {
      ...spotRecord,
      spotKey: 'sixMax|btn|not-a-situation|-|100',
    }
    expect(legacyBackupV1Schema.safeParse(malformedSpot).success).toBe(false)
  })

  it('rejects invalid active timestamps, hands, flags, and counter invariants', () => {
    const invalidTimestamp = copySeed()
    ;(invalidTimestamp.ranges as Array<Record<string, unknown>>)[0]!.createdAt = 'yesterday'
    expect(legacyBackupV1Schema.safeParse(invalidTimestamp).success).toBe(false)

    const backwardsRangeTimestamp = copySeed()
    const firstRange = (backwardsRangeTimestamp.ranges as Array<Record<string, unknown>>)[0]!
    firstRange.createdAt = '2026-08-18T00:00:00.000Z'
    firstRange.updatedAt = '2026-08-17T00:00:00.000Z'
    expect(legacyBackupV1Schema.safeParse(backwardsRangeTimestamp).success).toBe(false)

    const invalidHand = copySeed()
    ;(invalidHand.ranges as Array<Record<string, unknown>>)[0]!.hands = ['AA', 'AAs']
    expect(legacyBackupV1Schema.safeParse(invalidHand).success).toBe(false)

    const duplicateHands = copySeed()
    ;(duplicateHands.ranges as Array<Record<string, unknown>>)[0]!.hands = ['AA', 'AA']
    expect(legacyBackupV1Schema.safeParse(duplicateHands).success).toBe(false)

    const invalidFlag = copySeed()
    ;(invalidFlag.ranges as Array<Record<string, unknown>>)[0]!.favorite = 'true'
    expect(legacyBackupV1Schema.safeParse(invalidFlag).success).toBe(false)

    const invalidPracticeStats = copySeed()
    const firstPracticeStat = Object.values(
      invalidPracticeStats.practiceStats as Record<string, Record<string, unknown>>,
    )[0]!
    firstPracticeStat.correctAttempts = 999
    expect(legacyBackupV1Schema.safeParse(invalidPracticeStats).success).toBe(false)

    const invalidAccuracy = copySeed()
    const handRecords = Object.values(invalidAccuracy.handAccuracy as Record<string, Record<string, unknown>>)[0]!
    const firstHand = Object.keys(handRecords)[0]!
    handRecords[firstHand] = {
      ...(handRecords[firstHand] as Record<string, unknown>),
      falsePositives: 99,
    }
    expect(legacyBackupV1Schema.safeParse(invalidAccuracy).success).toBe(false)

    const invalidActionAccuracy = copySeed()
    const firstActionRecord = Object.values(
      Object.values(
        invalidActionAccuracy.actionAccuracy as Record<string, Record<string, Record<string, unknown>>>,
      )[0]!,
    )[0]!
    firstActionRecord.correct = 999
    expect(legacyBackupV1Schema.safeParse(invalidActionAccuracy).success).toBe(false)

    const invalidSession = copySeed()
    const firstSession = Object.values(
      invalidSession.sessionHistory as Record<string, Array<Record<string, unknown>>>,
    )[0]![0]!
    firstSession.correctAnswers = 999
    expect(legacyBackupV1Schema.safeParse(invalidSession).success).toBe(false)

    const invalidReview = copySeed()
    const firstReview = Object.values(
      invalidReview.reviewStates as Record<string, Record<string, unknown>>,
    )[0]!
    firstReview.dueAt = '2026-01-01T00:00:00.000Z'
    expect(legacyBackupV1Schema.safeParse(invalidReview).success).toBe(false)
  })

  it('bounds metadata before parsing and validates preview, commit, and export envelopes', () => {
    expect(() => assertLegacyBackupSize(MAX_LEGACY_BACKUP_BYTES)).not.toThrow()
    expect(() => assertLegacyBackupSize(MAX_LEGACY_BACKUP_BYTES + 1)).toThrow(/Legacy backup/)

    expect(legacyBackupPreviewRequestSchema.parse({ backup: seedBackup })).toHaveProperty('backup.version', 1)
    expect(
      legacyBackupPreviewResponseSchema.parse({
        data: {
          digest,
          counts,
          preservationWarnings: [
            {
              kind: 'dormant_range_fields',
              path: ['ranges', 0, 'source'],
              message: 'Preserved source for recovery without enabling it in the new UI.',
            },
          ],
          conflicts: [],
          alreadyImported: false,
        },
      }),
    ).toHaveProperty('data.digest', digest)

    const commit = legacyBackupCommitRequestSchema.parse({
      backup: seedBackup,
      expectedDigest: digest,
      strategy: 'merge',
    })
    expect(commit.strategy).toBe('merge')
    expect(
      legacyBackupCommitResponseSchema.parse({
        data: { result: 'committed', atomic: true, digest, strategy: 'merge', counts },
      }),
    ).toHaveProperty('data.atomic', true)
    expect(
      legacyBackupExportResponseSchema.parse({ data: { backup: seedBackup } }),
    ).toHaveProperty('data.backup.version', 1)
  })

  it('does not represent partial import success', () => {
    expect(
      legacyBackupCommitResponseSchema.safeParse({
        data: { result: 'committed', atomic: false, digest, strategy: 'replace', counts },
      }).success,
    ).toBe(false)
    expect(
      legacyBackupCommitResponseSchema.safeParse({
        data: {
          result: 'committed',
          atomic: true,
          digest,
          strategy: 'replace',
          counts,
          importedRanges: 1,
          failedRanges: 1,
        },
      }).success,
    ).toBe(false)
  })
})
