import { describe, it, expect, beforeEach } from 'vitest'
import type { SavedRange } from '../types/range'
import { saveSavedRange } from './rangeStorage'
import {
  BACKUP_VERSION,
  buildBackup,
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
