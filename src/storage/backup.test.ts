import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SavedRange } from '../types/range'
import { saveSavedRange } from './rangeStorage'
import { loadSavedRanges } from './rangeStorage'
import { ACTION_ACCURACY_STORAGE_KEY } from './actionAccuracyStorage'
import { WORKOUT_STORAGE_KEY } from './workoutStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from './spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from './trainingGoalStorage'
import {
  BACKUP_VERSION,
  type Backup,
  buildBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from './backup'

/**
 * Every storage module, so the coverage guard below sees a new one the moment it
 * exists. Read through the bundler rather than off disk, which keeps this file
 * in the browser-typed config with the rest of the suite. Tests are excluded, or
 * their suites would be pulled in and run a second time here.
 */
const STORAGE_MODULES = import.meta.glob<Record<string, unknown>>(['./*.ts', '!./*.test.ts'], {
  eager: true,
})

/** Every versioned localStorage key the app persists, by the module that owns it. */
function everyStorageKey(): Map<string, string> {
  const keys = new Map<string, string>()
  for (const [path, module] of Object.entries(STORAGE_MODULES)) {
    for (const [name, value] of Object.entries(module)) {
      if (!/STORAGE_KEY$/.test(name)) continue
      if (typeof value !== 'string' || !value.startsWith('poker-range-trainer.')) continue
      keys.set(value, path)
    }
  }
  return keys
}

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

/**
 * A backup is the only thing standing between a user and losing everything when
 * they move devices, and nothing about adding a tenth storage key forces anyone
 * to remember this file. A slice left out does not fail anywhere: it exports
 * fine, imports fine, and is simply gone on the other side — silently, and only
 * for the data that took the longest to earn.
 *
 * So the keys are discovered rather than listed, and each one is either carried
 * by a real build → restore round trip or named here with the reason it is not.
 */
describe('backup coverage', () => {
  /** Keys a backup deliberately leaves behind, each with why it is not library data. */
  const DEVICE_ONLY = new Map([
    [
      WORKOUT_STORAGE_KEY,
      'the day-scoped "workout done today" flag — restoring it would mark another device done',
    ],
  ])

  it('carries every persisted storage key, or names it as device-only', () => {
    const owned = everyStorageKey()
    // Guards the guard: a glob that resolved nothing would exempt everything.
    expect(owned.size).toBeGreaterThanOrEqual(9)

    // What a restore actually writes, taken from the real code rather than a
    // list: every slice is written unconditionally, empty ones included.
    localStorage.clear()
    restoreBackup(buildBackup())
    const restored = new Set(Object.keys(localStorage))

    const dropped = [...owned]
      .filter(([key]) => !restored.has(key) && !DEVICE_ONLY.has(key))
      .map(([key, path]) => `${key} (${path}) is persisted but no backup carries it`)
    expect(dropped).toEqual([])

    // And the exemptions have to still be real keys, so a renamed one cannot sit
    // here quietly exempting nothing.
    expect([...DEVICE_ONLY.keys()].filter((key) => !owned.has(key))).toEqual([])
  })
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
      trainingGoal: 0,
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

  it('rejects a malformed range before it can replace the local library', () => {
    const malformed = {
      ...buildBackup('2026-06-08T00:00:00.000Z'),
      ranges: [{ ...makeRange(), name: 42 }],
    }

    expect(() => parseBackup(JSON.stringify(malformed))).toThrow(/invalid range/)
  })

  it('rejects impossible practice stats instead of restoring a partial record', () => {
    const malformed = {
      ...buildBackup('2026-06-08T00:00:00.000Z'),
      practiceStats: {
        r1: {
          rangeId: 'r1',
          totalAttempts: 2,
          correctAttempts: 3,
          lastPracticedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    }

    expect(() => parseBackup(JSON.stringify(malformed))).toThrow(/practiceStats/)
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

  it('validates a directly supplied backup before touching storage', () => {
    saveSavedRange(makeRange({ id: 'keep' }))
    const malformed = {
      ...buildBackup('2026-06-08T00:00:00.000Z'),
      ranges: [{ ...makeRange({ id: 'bad' }), name: 42 }],
    } as unknown as Backup

    expect(() => restoreBackup(malformed)).toThrow(/invalid range/)
    expect(loadSavedRanges().map((range) => range.id)).toEqual(['keep'])
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

  it('carries and restores the daily goal, so a restored device keeps the target', () => {
    saveTrainingGoal(40)

    const snapshot = parseBackup(serializeBackup(buildBackup('2026-06-08T00:00:00.000Z')))
    expect(snapshot.trainingGoal).toBe(40)
    localStorage.clear()
    restoreBackup(snapshot)

    expect(loadTrainingGoal()).toBe(40)
  })

  it('clears the goal when restoring a file written before the field existed', () => {
    saveTrainingGoal(40)
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

    // A restore replaces the library wholesale rather than merging into it.
    expect(loadTrainingGoal()).toBe(0)
  })

  it('rejects a file whose trainingGoal is not a number', () => {
    const broken = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-08T00:00:00.000Z',
      ranges: [],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
      trainingGoal: '40',
    }

    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/trainingGoal/)
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
