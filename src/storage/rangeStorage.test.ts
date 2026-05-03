import { describe, it, expect, beforeEach } from 'vitest'
import type { SavedRange } from '../types/range'
import {
  STORAGE_KEY,
  loadSavedRanges,
  saveSavedRange,
  deleteSavedRange,
  findSavedRangeById,
} from './rangeStorage'

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

describe('loadSavedRanges', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(loadSavedRanges()).toEqual([])
  })

  it('returns an empty array when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadSavedRanges()).toEqual([])
  })

  it('returns an empty array when the stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'r1' }))
    expect(loadSavedRanges()).toEqual([])
  })

  it('skips entries with an invalid shape but keeps valid ones', () => {
    const valid = makeRange({ id: 'good' })
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        valid,
        { id: 'bad', name: 'missing hands/timestamps' },
        { name: 'missing id', hands: [], createdAt: 'x', updatedAt: 'x' },
        42,
        null,
      ]),
    )
    expect(loadSavedRanges()).toEqual([valid])
  })

  it('skips entries containing invalid hands but keeps valid ones', () => {
    const valid = makeRange({ id: 'good' })
    const bad = { ...makeRange({ id: 'bad' }), hands: ['AA', 'ZZ'] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([valid, bad]))
    expect(loadSavedRanges()).toEqual([valid])
  })

  it('normalizes stored hands into canonical order on load', () => {
    const stored = { ...makeRange({ id: 'r1' }), hands: ['KK', 'AA', 'KK'] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    expect(loadSavedRanges()[0].hands).toEqual(['AA', 'KK'])
  })
})

describe('saveSavedRange', () => {
  it('saves a range that can then be loaded back', () => {
    const range = makeRange()
    saveSavedRange(range)
    expect(loadSavedRanges()).toEqual([range])
  })

  it('appends new ranges in insertion order', () => {
    saveSavedRange(makeRange({ id: 'a' }))
    saveSavedRange(makeRange({ id: 'b' }))
    saveSavedRange(makeRange({ id: 'c' }))
    expect(loadSavedRanges().map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('updates in place when the id already exists', () => {
    saveSavedRange(makeRange({ id: 'r1', name: 'Original', hands: ['AA'] }))
    saveSavedRange(makeRange({ id: 'r1', name: 'Renamed', hands: ['QQ'] }))

    const ranges = loadSavedRanges()
    expect(ranges).toHaveLength(1)
    expect(ranges[0].name).toBe('Renamed')
    expect(ranges[0].hands).toEqual(['QQ'])
  })

  it('preserves ordering when updating an existing range', () => {
    saveSavedRange(makeRange({ id: 'a' }))
    saveSavedRange(makeRange({ id: 'b' }))
    saveSavedRange(makeRange({ id: 'c' }))

    saveSavedRange(makeRange({ id: 'b', name: 'Updated B' }))

    const ranges = loadSavedRanges()
    expect(ranges.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(ranges.find((r) => r.id === 'b')?.name).toBe('Updated B')
  })

  it('normalizes duplicate hands by de-duplicating and sorting', () => {
    saveSavedRange(makeRange({ id: 'r1', hands: ['KK', 'AA', 'KK', 'AA'] }))
    expect(loadSavedRanges()[0].hands).toEqual(['AA', 'KK'])
  })

  it('throws on invalid hands and leaves existing storage untouched', () => {
    const good = makeRange({ id: 'good' })
    saveSavedRange(good)

    expect(() => saveSavedRange(makeRange({ id: 'bad', hands: ['AA', 'ZZ'] }))).toThrow(/ZZ/)
    expect(loadSavedRanges()).toEqual([good])
  })
})

describe('deleteSavedRange', () => {
  it('removes only the range with the matching id', () => {
    saveSavedRange(makeRange({ id: 'a' }))
    saveSavedRange(makeRange({ id: 'b' }))
    saveSavedRange(makeRange({ id: 'c' }))

    deleteSavedRange('b')

    expect(loadSavedRanges().map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('is a no-op when the id does not exist', () => {
    saveSavedRange(makeRange({ id: 'a' }))
    deleteSavedRange('does-not-exist')
    expect(loadSavedRanges().map((r) => r.id)).toEqual(['a'])
  })
})

describe('findSavedRangeById', () => {
  it('returns the range with the matching id', () => {
    const a = makeRange({ id: 'a' })
    const b = makeRange({ id: 'b', name: 'Second' })
    saveSavedRange(a)
    saveSavedRange(b)
    expect(findSavedRangeById('b')).toEqual(b)
  })

  it('returns undefined when no range matches', () => {
    saveSavedRange(makeRange({ id: 'a' }))
    expect(findSavedRangeById('missing')).toBeUndefined()
  })
})
