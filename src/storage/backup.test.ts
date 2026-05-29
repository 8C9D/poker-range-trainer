import { describe, it, expect, beforeEach } from 'vitest'
import type { SavedRange } from '../types/range'
import { saveSavedRange } from './rangeStorage'
import { loadSavedRanges } from './rangeStorage'
import {
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from './backup'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test Range',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

describe('buildBackup', () => {
  it('produces a versioned, empty snapshot when nothing is stored', () => {
    const backup = buildBackup('2026-06-08T00:00:00.000Z')
    expect(backup).toEqual({
      version: BACKUP_VERSION,
      exportedAt: '2026-06-08T00:00:00.000Z',
      ranges: [],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
    })
  })

  it('gathers persisted ranges into the snapshot', () => {
    const range = makeRange()
    saveSavedRange(range)
    const backup = buildBackup('2026-06-08T00:00:00.000Z')
    expect(backup.ranges).toEqual([range])
  })

  it('defaults exportedAt to a real ISO timestamp', () => {
    const backup = buildBackup()
    expect(() => new Date(backup.exportedAt).toISOString()).not.toThrow()
    expect(backup.exportedAt).toBe(new Date(backup.exportedAt).toISOString())
  })
})

describe('serializeBackup', () => {
  it('pretty-prints the backup as round-trippable JSON', () => {
    const backup = buildBackup('2026-06-08T00:00:00.000Z')
    const json = serializeBackup(backup)
    expect(json).toContain('\n  ')
    expect(JSON.parse(json)).toEqual(backup)
  })
})

describe('parseBackup', () => {
  it('round-trips a serialized backup', () => {
    const backup = buildBackup('2026-06-08T00:00:00.000Z')
    expect(parseBackup(serializeBackup(backup))).toEqual(backup)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(/valid JSON/)
  })

  it('rejects a non-object payload', () => {
    expect(() => parseBackup('[]')).toThrow(/backup object/)
  })

  it('rejects an unsupported version', () => {
    expect(() => parseBackup(JSON.stringify({ version: 999 }))).toThrow(/version/)
  })

  it('rejects a payload missing its ranges list', () => {
    expect(() => parseBackup(JSON.stringify({ version: BACKUP_VERSION }))).toThrow(/ranges/)
  })

  it('rejects a payload missing a data map', () => {
    const incomplete = {
      version: BACKUP_VERSION,
      ranges: [],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      // reviewStates missing
    }
    expect(() => parseBackup(JSON.stringify(incomplete))).toThrow(/reviewStates/)
  })
})

describe('restoreBackup', () => {
  it('replaces local data so a built backup round-trips through storage', () => {
    saveSavedRange(makeRange({ id: 'original' }))
    const snapshot = buildBackup('2026-06-08T00:00:00.000Z')

    saveSavedRange(makeRange({ id: 'added-later', name: 'Later' }))
    expect(loadSavedRanges()).toHaveLength(2)

    restoreBackup(parseBackup(serializeBackup(snapshot)))
    const restored = loadSavedRanges()
    expect(restored).toHaveLength(1)
    expect(restored[0].id).toBe('original')
  })
})
