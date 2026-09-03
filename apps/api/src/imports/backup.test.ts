import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  legacyBackupV1Schema,
  legacyRangeSchema,
  type LegacyBackupV1,
} from '@poker-range-trainer/contracts'

import {
  buildLegacyBackupExport,
  countLegacyBackup,
  derivePreservationWarnings,
  digestHex,
  FALLBACK_RANGE_NAME,
  legacyBackupDigest,
  normalizeLegacyRange,
  normalizeReviewEase,
  normalizeTrainingGoal,
  sessionFingerprint,
  stableStringify,
  type ExportSnapshot,
} from './backup.js'

const seedBackup: LegacyBackupV1 = legacyBackupV1Schema.parse(
  JSON.parse(
    readFileSync(new URL('../../../../screenshots/seed-backup.json', import.meta.url), 'utf8'),
  ),
)

const emptyBackup = {
  version: 1,
  exportedAt: '2026-01-02T03:04:05.000Z',
  ranges: [],
  practiceStats: {},
  handAccuracy: {},
  actionAccuracy: {},
  sessionHistory: {},
  reviewStates: {},
} as const

function backupWith(overrides: Record<string, unknown>): LegacyBackupV1 {
  return legacyBackupV1Schema.parse({ ...emptyBackup, ...overrides })
}

function rangeWith(overrides: Record<string, unknown>) {
  return legacyRangeSchema.parse({
    id: 'rng-1',
    name: 'BTN open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  })
}

describe('legacy backup digest', () => {
  it('sorts keys recursively so file key order cannot change the digest', () => {
    expect(stableStringify({ b: 1, a: { d: [3, { f: 2, e: 1 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"e":1,"f":2}]},"b":1}',
    )

    const ordered = backupWith({
      ranges: [rangeWith({})],
      practiceStats: {
        'rng-1': {
          rangeId: 'rng-1',
          totalAttempts: 4,
          correctAttempts: 3,
          lastPracticedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    })
    const shuffled = legacyBackupV1Schema.parse(
      JSON.parse(
        JSON.stringify({
          practiceStats: {
            'rng-1': {
              lastPracticedAt: '2026-01-02T00:00:00.000Z',
              correctAttempts: 3,
              totalAttempts: 4,
              rangeId: 'rng-1',
            },
          },
          reviewStates: {},
          sessionHistory: {},
          actionAccuracy: {},
          handAccuracy: {},
          ranges: [
            {
              updatedAt: '2026-01-02T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              hands: ['AA', 'KK'],
              name: 'BTN open',
              id: 'rng-1',
            },
          ],
          exportedAt: '2026-01-02T03:04:05.000Z',
          version: 1,
        }),
      ),
    )
    expect(legacyBackupDigest(shuffled)).toBe(legacyBackupDigest(ordered))
    expect(legacyBackupDigest(ordered)).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(digestHex(legacyBackupDigest(ordered))).toHaveLength(64)
  })

  it('changes when any value changes', () => {
    const digest = legacyBackupDigest(backupWith({ ranges: [rangeWith({})] }))
    expect(legacyBackupDigest(backupWith({ ranges: [rangeWith({ name: 'BTN opens' })] }))).not.toBe(
      digest,
    )
    expect(legacyBackupDigest(backupWith({ ranges: [rangeWith({ hands: ['AA'] })] }))).not.toBe(
      digest,
    )
  })

  it('identifies a legacy drill by its range, time, and score', () => {
    const session = {
      rangeId: 'rng-1',
      playedAt: '2026-01-02T00:00:00.000Z',
      totalQuestions: 20,
      correctAnswers: 17,
    }
    expect(sessionFingerprint(session)).toMatch(/^[a-f0-9]{64}$/)
    expect(sessionFingerprint(session)).toBe(sessionFingerprint({ ...session }))
    expect(sessionFingerprint({ ...session, correctAnswers: 16 })).not.toBe(
      sessionFingerprint(session),
    )
  })
})

describe('legacy backup counts and warnings', () => {
  it('counts every slice of the seed fixture', () => {
    expect(countLegacyBackup(seedBackup)).toEqual({
      ranges: 4,
      practiceStats: 4,
      handAccuracy: 65,
      actionAccuracy: 8,
      sessions: 16,
      reviewStates: 4,
      spotAccuracy: 4,
    })
  })

  it('reports the seed fixture dormant fields and retired accuracy records', () => {
    const warnings = derivePreservationWarnings(seedBackup)
    const dormant = warnings.filter((warning) => warning.kind === 'dormant_range_fields')
    expect(dormant.map((warning) => warning.path)).toEqual([
      ['ranges', 0, 'source'],
      ['ranges', 0, 'tags'],
      ['ranges', 1, 'source'],
      ['ranges', 1, 'tags'],
      ['ranges', 2, 'tags'],
      ['ranges', 3, 'source'],
      ['ranges', 3, 'tags'],
    ])
    expect(
      warnings
        .filter((warning) => warning.kind === 'retired_accuracy_records')
        .map((warning) => warning.path),
    ).toEqual([['actionAccuracy'], ['spotAccuracy']])
    expect(warnings.filter((warning) => warning.kind === 'unknown_backup_fields')).toEqual([])
  })

  it('reports unknown root fields and stays silent on an unremarkable backup', () => {
    const warnings = derivePreservationWarnings(
      backupWith({ ranges: [rangeWith({})], futureSlice: { a: 1 } }),
    )
    expect(warnings).toEqual([
      {
        kind: 'unknown_backup_fields',
        path: ['futureSlice'],
        message: expect.stringContaining('futureSlice'),
      },
    ])
    expect(derivePreservationWarnings(backupWith({ ranges: [rangeWith({})] }))).toEqual([])
  })
})

describe('legacy range normalisation', () => {
  it('keeps a storable range unchanged and preserves nothing', () => {
    const { range, warnings } = normalizeLegacyRange(
      rangeWith({
        hands: ['KK', 'AA'],
        archived: true,
        metadata: { gameType: 'cash', position: 'btn', stackDepthBb: 100, notes: 'Solid.' },
      }),
      0,
    )
    expect(warnings).toEqual([])
    expect(range).toMatchObject({
      legacyRangeId: 'rng-1',
      name: 'BTN open',
      // Canonical 13x13 order, not the file's order.
      hands: ['AA', 'KK'],
      archived: true,
      favorite: false,
      legacyPayload: null,
    })
    expect(range?.metadata).toEqual({
      gameType: 'cash',
      tableSize: null,
      stackDepthBb: '100.00',
      position: 'btn',
      actionType: null,
      versusPosition: null,
      notes: 'Solid.',
    })
  })

  it('preserves dormant range and metadata fields', () => {
    const { range, warnings } = normalizeLegacyRange(
      rangeWith({
        tags: ['6-max'],
        source: { kind: 'coach' },
        metadata: { position: 'btn', futureField: 7 },
      }),
      2,
    )
    expect(range?.legacyPayload).toEqual({
      tags: ['6-max'],
      source: { kind: 'coach' },
      metadata: { futureField: 7 },
    })
    expect(warnings.map((warning) => warning.path)).toEqual([
      ['ranges', 2, 'tags'],
      ['ranges', 2, 'source'],
      ['ranges', 2, 'metadata', 'futureField'],
    ])
  })

  it('normalises names, notes, and stack depth towards the stored bounds', () => {
    const trimmed = normalizeLegacyRange(rangeWith({ name: '   ' }), 0)
    expect(trimmed.range?.name).toBe(FALLBACK_RANGE_NAME)
    expect(trimmed.range?.legacyPayload).toEqual({ name: '   ' })

    const long = normalizeLegacyRange(rangeWith({ name: 'x'.repeat(200) }), 1)
    expect(long.range?.name).toHaveLength(120)
    expect(long.range?.legacyPayload).toEqual({ name: 'x'.repeat(200) })
    expect(long.warnings.map((warning) => warning.path)).toEqual([['ranges', 1, 'name']])

    const notes = normalizeLegacyRange(
      rangeWith({ metadata: { notes: `${'n'.repeat(2_500)}` } }),
      0,
    )
    expect(notes.range?.metadata.notes).toHaveLength(2_000)
    expect(notes.range?.legacyPayload).toEqual({ metadata: { notes: 'n'.repeat(2_500) } })

    const rounded = normalizeLegacyRange(rangeWith({ metadata: { stackDepthBb: 100.456 } }), 0)
    expect(rounded.range?.metadata.stackDepthBb).toBe('100.46')
    expect(rounded.range?.legacyPayload).toEqual({ metadata: { stackDepthBb: 100.456 } })

    const deep = normalizeLegacyRange(rangeWith({ metadata: { stackDepthBb: 20_000 } }), 0)
    expect(deep.range?.metadata.stackDepthBb).toBeNull()
    expect(deep.range?.legacyPayload).toEqual({ metadata: { stackDepthBb: 20_000 } })
  })

  it('refuses to import a range that selects no hands', () => {
    const { range, warnings } = normalizeLegacyRange(rangeWith({ hands: [] }), 3)
    expect(range).toBeNull()
    expect(warnings).toEqual([
      {
        kind: 'dormant_range_fields',
        path: ['ranges', 3, 'hands'],
        message: expect.stringContaining('not imported'),
      },
    ])
  })

  it('clamps review ease and the daily goal into their stored domains', () => {
    expect(normalizeReviewEase(1)).toBe('1.30')
    expect(normalizeReviewEase(2.345)).toBe('2.35')
    expect(normalizeReviewEase(10_000)).toBe('999.99')
    expect(normalizeTrainingGoal(0)).toBeNull()
    expect(normalizeTrainingGoal(50)).toBe(50)
    expect(normalizeTrainingGoal(5_000_000_000)).toBe(1_000_000_000)
  })
})

describe('backup export shaping', () => {
  const snapshot: ExportSnapshot = {
    ranges: [
      {
        id: '2e0f4cb4-6d0a-4ef2-9ee6-6a3f5a7f0d21',
        legacyRangeId: 'rng-btn-open',
        name: 'BTN open',
        hands: ['AA', 'AKs'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        archived: false,
        favorite: true,
        gameType: 'cash',
        tableSize: null,
        stackDepthBb: 100,
        position: 'btn',
        actionType: 'open',
        versusPosition: null,
        notes: 'Trimmed notes.',
        legacyPayload: {
          tags: ['6-max'],
          name: 'The original much longer name',
          metadata: { futureField: 7, notes: 'Original notes.' },
        },
      },
      {
        id: '9f2b7f2c-0f2a-4a0c-9d3f-3f5a5d7b8c11',
        legacyRangeId: null,
        name: 'CO open',
        hands: ['QQ'],
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
        archived: false,
        favorite: false,
        gameType: null,
        tableSize: null,
        stackDepthBb: null,
        position: null,
        actionType: null,
        versusPosition: null,
        notes: null,
        legacyPayload: null,
      },
    ],
    practiceStats: {
      '2e0f4cb4-6d0a-4ef2-9ee6-6a3f5a7f0d21': {
        totalAttempts: 10,
        correctAttempts: 8,
        lastPracticedAt: '2026-01-02T00:00:00.000Z',
      },
    },
    handAccuracy: {
      '2e0f4cb4-6d0a-4ef2-9ee6-6a3f5a7f0d21': [
        { hand: 'AA', attempts: 4, correct: 3, falsePositives: 1, falseNegatives: 0 },
      ],
    },
    sessionHistory: {
      '2e0f4cb4-6d0a-4ef2-9ee6-6a3f5a7f0d21': [
        { playedAt: '2026-01-02T00:00:00.000Z', totalQuestions: 10, correctAnswers: 8 },
      ],
    },
    reviewStates: {
      '2e0f4cb4-6d0a-4ef2-9ee6-6a3f5a7f0d21': {
        ease: 2.5,
        intervalDays: 2,
        dueAt: '2026-01-04T00:00:00.000Z',
        lastReviewedAt: '2026-01-02T00:00:00.000Z',
      },
      '9f2b7f2c-0f2a-4a0c-9d3f-3f5a5d7b8c11': {
        ease: 2.5,
        intervalDays: 0,
        dueAt: null,
        lastReviewedAt: null,
      },
    },
    trainingGoal: 50,
  }

  it('produces a valid v1 file keyed by the legacy identifiers', () => {
    const exported = buildLegacyBackupExport(snapshot, '2026-02-01T00:00:00.000Z')
    const parsed = legacyBackupV1Schema.parse(exported)
    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(parsed.ranges.map((range) => range.id)).toEqual([
      'rng-btn-open',
      '9f2b7f2c-0f2a-4a0c-9d3f-3f5a5d7b8c11',
    ])
    expect(Object.keys(parsed.practiceStats)).toEqual(['rng-btn-open'])
    expect(Object.keys(parsed.handAccuracy)).toEqual(['rng-btn-open'])
    expect(parsed.sessionHistory['rng-btn-open']).toEqual([
      {
        rangeId: 'rng-btn-open',
        playedAt: '2026-01-02T00:00:00.000Z',
        totalQuestions: 10,
        correctAnswers: 8,
      },
    ])
    expect(parsed.actionAccuracy).toEqual({})
    expect(parsed.trainingGoal).toBe(50)
    // A never-scheduled review is spelled with empty timestamps in the file.
    expect(parsed.reviewStates['9f2b7f2c-0f2a-4a0c-9d3f-3f5a5d7b8c11']).toEqual({
      rangeId: '9f2b7f2c-0f2a-4a0c-9d3f-3f5a5d7b8c11',
      ease: 2.5,
      intervalDays: 0,
      dueAt: '',
      lastReviewedAt: '',
    })
  })

  it('restores dormant fields while stored columns win over stale payload copies', () => {
    const exported = buildLegacyBackupExport(snapshot, '2026-02-01T00:00:00.000Z')
    const [range] = legacyBackupV1Schema.parse(exported).ranges
    expect(range).toMatchObject({
      id: 'rng-btn-open',
      name: 'BTN open',
      tags: ['6-max'],
      favorite: true,
    })
    expect(range).not.toHaveProperty('archived')
    expect(range?.metadata).toEqual({
      futureField: 7,
      gameType: 'cash',
      stackDepthBb: 100,
      position: 'btn',
      actionType: 'open',
      notes: 'Trimmed notes.',
    })
  })

  it('exports an empty library as a valid, empty file', () => {
    const parsed = legacyBackupV1Schema.parse(
      buildLegacyBackupExport(
        {
          ranges: [],
          practiceStats: {},
          handAccuracy: {},
          sessionHistory: {},
          reviewStates: {},
          trainingGoal: null,
        },
        '2026-02-01T00:00:00.000Z',
      ),
    )
    expect(parsed.ranges).toEqual([])
    expect(parsed.trainingGoal).toBe(0)
  })
})
