import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SavedRange } from '../types/range'
import { saveSavedRange } from './rangeStorage'
import { loadSavedRanges } from './rangeStorage'
import { ACTION_ACCURACY_STORAGE_KEY } from './actionAccuracyStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from './spotAccuracyStorage'
import {
  BACKUP_VERSION,
  type Backup,
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
      spotAccuracy: {},
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

  it('rolls back every slice when a write fails partway through', () => {
    const original: Backup = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-08T00:00:00.000Z',
      ranges: [makeRange({ id: 'original' })],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
    }
    restoreBackup(original)

    const replacement: Backup = { ...original, ranges: [makeRange({ id: 'replacement' })] }

    // Fail the fourth write (action accuracy) once; the earlier ranges/stats
    // writes have already landed, so a non-atomic restore would leave them
    // holding the replacement data. Later rollback writes must still succeed.
    const realSetItem = Storage.prototype.setItem
    let failed = false
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === ACTION_ACCURACY_STORAGE_KEY && !failed) {
          failed = true
          throw new Error('QuotaExceededError')
        }
        realSetItem.call(this, key, value)
      })

    expect(() => restoreBackup(replacement)).toThrow(/QuotaExceededError/)
    spy.mockRestore()

    const restored = loadSavedRanges()
    expect(restored).toHaveLength(1)
    expect(restored[0].id).toBe('original')
  })
})

describe('per-spot accuracy in a backup', () => {
  const stat = { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 10, correct: 7 }

  it('carries the record that drives weakest spots', () => {
    recordSpotAccuracy([stat])

    const backup = buildBackup('2026-06-08T00:00:00.000Z')

    expect(backup.spotAccuracy).toEqual({ [stat.spotKey]: stat })
  })

  it('restores it, so exporting and re-importing does not lose the leak history', () => {
    recordSpotAccuracy([stat])
    const snapshot = parseBackup(serializeBackup(buildBackup('2026-06-08T00:00:00.000Z')))
    localStorage.clear()

    restoreBackup(snapshot)

    expect(loadSpotAccuracy()).toEqual({ [stat.spotKey]: stat })
  })

  it('still imports a backup file written before the field existed', () => {
    recordSpotAccuracy([stat])
    const older = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-08T00:00:00.000Z',
      ranges: [],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
    }

    restoreBackup(parseBackup(JSON.stringify(older)))

    // A restore replaces the library wholesale, so an older file leaves no
    // stale spot record pointing at a library that is no longer there.
    expect(loadSpotAccuracy()).toEqual({})
  })

  it('rejects a file whose spotAccuracy is not an object', () => {
    const broken = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-08T00:00:00.000Z',
      ranges: [],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
      spotAccuracy: [],
    }

    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/spotAccuracy/)
  })
})
