import { describe, it, expect, beforeEach } from 'vitest'
import type { RangeMetadata, SavedRange } from '../types/range'
import {
  STORAGE_KEY,
  loadSavedRanges,
  saveSavedRange,
  deleteSavedRange,
  findSavedRangeById,
  replaceSavedRanges,
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

describe('range metadata', () => {
  const fullMetadata: RangeMetadata = {
    gameType: 'cash',
    tableSize: 'sixMax',
    stackDepthBb: 100,
    position: 'btn',
    actionType: 'open',
    versusPosition: 'co',
    notes: 'Standard BTN open.',
  }

  it('loads pre-v1.3 records that have no metadata field', () => {
    const legacy = {
      id: 'r1',
      name: 'Legacy',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]))

    const loaded = loadSavedRanges()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].hands).toEqual(['AA', 'KK'])
    expect(loaded[0]).not.toHaveProperty('metadata')
  })

  it('adds no metadata field when a saved range has none', () => {
    const range = makeRange()
    saveSavedRange(range)

    const [loaded] = loadSavedRanges()
    expect(loaded).toEqual(range)
    expect(loaded).not.toHaveProperty('metadata')
  })

  it('preserves full metadata across a save/load round trip', () => {
    const range = makeRange({ metadata: fullMetadata })
    saveSavedRange(range)
    expect(loadSavedRanges()).toEqual([range])
  })

  it('preserves partial metadata across a save/load round trip', () => {
    const range = makeRange({ metadata: { position: 'sb', actionType: 'threeBet' } })
    saveSavedRange(range)
    expect(loadSavedRanges()[0].metadata).toEqual({ position: 'sb', actionType: 'threeBet' })
  })

  it('drops unknown and invalid metadata fields but keeps the range and its valid fields', () => {
    const stored = {
      ...makeRange({ id: 'r1' }),
      metadata: {
        gameType: 'cash', // valid
        tableSize: 'tenMax', // invalid value
        position: 'lojack', // invalid value
        actionType: 'open', // valid
        stackDepthBb: -5, // non-positive
        notes: '   ', // whitespace only
        unknownField: 'x', // unknown key
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))

    const [loaded] = loadSavedRanges()
    expect(loaded.id).toBe('r1')
    expect(loaded.hands).toEqual(['AA', 'KK'])
    expect(loaded.metadata).toEqual({ gameType: 'cash', actionType: 'open' })
  })

  it('omits metadata entirely when no field is valid', () => {
    const stored = {
      ...makeRange({ id: 'r1' }),
      metadata: { gameType: 'rummy', stackDepthBb: 0, notes: '' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))

    const [loaded] = loadSavedRanges()
    expect(loaded).not.toHaveProperty('metadata')
    expect(loaded.hands).toEqual(['AA', 'KK'])
  })

  it('ignores non-object metadata and keeps the range', () => {
    const stored = { ...makeRange({ id: 'r1' }), metadata: 'not-an-object' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))

    const [loaded] = loadSavedRanges()
    expect(loaded).not.toHaveProperty('metadata')
    expect(loaded.id).toBe('r1')
  })

  it('keeps a positive stack depth but drops non-positive or non-numeric ones', () => {
    const storeDepth = (depth: unknown) => {
      localStorage.clear()
      const stored = { ...makeRange({ id: 'r1' }), metadata: { stackDepthBb: depth } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    }

    storeDepth(40)
    expect(loadSavedRanges()[0].metadata).toEqual({ stackDepthBb: 40 })

    for (const bad of [0, -10, '100', null]) {
      storeDepth(bad)
      expect(loadSavedRanges()[0]).not.toHaveProperty('metadata')
    }
  })

  it('trims notes when saving', () => {
    saveSavedRange(
      makeRange({ id: 'r1', metadata: { gameType: 'tournament', notes: '  3-bet vs LJ  ' } }),
    )
    expect(loadSavedRanges()[0].metadata).toEqual({ gameType: 'tournament', notes: '3-bet vs LJ' })
  })

  it('normalizes metadata on save, dropping fields that fail validation', () => {
    saveSavedRange(
      makeRange({ id: 'r1', metadata: { gameType: 'cash', stackDepthBb: 0, notes: '   ' } }),
    )
    expect(loadSavedRanges()[0].metadata).toEqual({ gameType: 'cash' })
  })
})

describe('range archive flag', () => {
  it('preserves archived: true across a save/load round trip', () => {
    const range = makeRange({ archived: true })
    saveSavedRange(range)
    expect(loadSavedRanges()).toEqual([range])
  })

  it('does not persist an archived key when archived is false', () => {
    saveSavedRange(makeRange({ archived: false }))
    expect(loadSavedRanges()[0]).not.toHaveProperty('archived')
  })

  it('adds no archived key when a saved range has none', () => {
    saveSavedRange(makeRange())
    expect(loadSavedRanges()[0]).not.toHaveProperty('archived')
  })

  it('ignores a stored archived: false flag on load', () => {
    const stored = { ...makeRange({ id: 'r1' }), archived: false }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    expect(loadSavedRanges()[0]).not.toHaveProperty('archived')
  })

  it('ignores a non-boolean stored archived value', () => {
    const stored = { ...makeRange({ id: 'r1' }), archived: 'yes' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    expect(loadSavedRanges()[0]).not.toHaveProperty('archived')
  })
})

describe('range favorite flag', () => {
  it('preserves favorite: true across a save/load round trip', () => {
    const range = makeRange({ favorite: true })
    saveSavedRange(range)
    expect(loadSavedRanges()).toEqual([range])
  })

  it('does not persist a favorite key when favorite is false', () => {
    saveSavedRange(makeRange({ favorite: false }))
    expect(loadSavedRanges()[0]).not.toHaveProperty('favorite')
  })

  it('adds no favorite key when a saved range has none', () => {
    saveSavedRange(makeRange())
    expect(loadSavedRanges()[0]).not.toHaveProperty('favorite')
  })

  it('ignores a stored favorite: false flag on load', () => {
    const stored = { ...makeRange({ id: 'r1' }), favorite: false }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    expect(loadSavedRanges()[0]).not.toHaveProperty('favorite')
  })

  it('ignores a non-boolean stored favorite value', () => {
    const stored = { ...makeRange({ id: 'r1' }), favorite: 'yes' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    expect(loadSavedRanges()[0]).not.toHaveProperty('favorite')
  })

  it('persists favorite and archived together on one range', () => {
    const range = makeRange({ favorite: true, archived: true })
    saveSavedRange(range)
    const [loaded] = loadSavedRanges()
    expect(loaded.favorite).toBe(true)
    expect(loaded.archived).toBe(true)
    expect(loaded).toEqual(range)
  })
})

describe('handActions persistence', () => {
  it('round-trips a range saved with handActions', () => {
    saveSavedRange(makeRange({ id: 'r1', handActions: { AA: 'raise', KK: 'fold' } }))
    expect(loadSavedRanges()[0].handActions).toEqual({ AA: 'raise', KK: 'fold' })
  })

  it('loads a hands-only range without a handActions field', () => {
    saveSavedRange(makeRange({ id: 'r1' }))
    expect(loadSavedRanges()[0].handActions).toBeUndefined()
  })

  it('sanitizes malformed handActions on load (drops bad hand keys and actions)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          handActions: { AA: 'raise', ZZ: 'fold', KK: 'bogus' },
        },
      ]),
    )
    expect(loadSavedRanges()[0].handActions).toEqual({ AA: 'raise' })
  })

  it('omits handActions entirely when no entries are valid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          handActions: { ZZ: 'fold', KK: 'bogus' },
        },
      ]),
    )
    expect(loadSavedRanges()[0].handActions).toBeUndefined()
  })
})

describe('comboSelections persistence', () => {
  it('round-trips a range saved with comboSelections', () => {
    saveSavedRange(makeRange({ id: 'r1', comboSelections: { AKs: ['AhKh', 'AsKs'] } }))
    expect(loadSavedRanges()[0].comboSelections).toEqual({ AKs: ['AhKh', 'AsKs'] })
  })

  it('loads a range without a comboSelections field', () => {
    saveSavedRange(makeRange({ id: 'r1' }))
    expect(loadSavedRanges()[0].comboSelections).toBeUndefined()
  })

  it('sanitizes malformed comboSelections on load (drops bad keys and non-array values)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          comboSelections: { AKs: ['AhKh', 5], ZZ: ['AcKc'], QQ: 'not-an-array' },
        },
      ]),
    )
    expect(loadSavedRanges()[0].comboSelections).toEqual({ AKs: ['AhKh'] })
  })

  it('omits comboSelections entirely when no entries are valid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          comboSelections: { ZZ: ['AcKc'], QQ: 'nope' },
        },
      ]),
    )
    expect(loadSavedRanges()[0].comboSelections).toBeUndefined()
  })
})

describe('mixedStrategies persistence', () => {
  it('round-trips a range saved with mixed strategies', () => {
    saveSavedRange(
      makeRange({
        id: 'r1',
        mixedStrategies: {
          A5s: [
            { action: 'fourBet', frequency: 50 },
            { action: 'fold', frequency: 50 },
          ],
        },
      }),
    )
    expect(loadSavedRanges()[0].mixedStrategies).toEqual({
      A5s: [
        { action: 'fold', frequency: 50 },
        { action: 'fourBet', frequency: 50 },
      ],
    })
  })

  it('loads a range without a mixedStrategies field', () => {
    saveSavedRange(makeRange({ id: 'r1' }))
    expect(loadSavedRanges()[0].mixedStrategies).toBeUndefined()
  })

  it('normalizes each entry on load (merges duplicates, drops bad actions/keys)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          mixedStrategies: {
            AA: [
              { action: 'raise', frequency: 40 },
              { action: 'raise', frequency: 60 },
              { action: 'bogus', frequency: 10 },
            ],
            ZZ: [{ action: 'fold', frequency: 100 }],
            QQ: 'not-an-array',
          },
        },
      ]),
    )
    expect(loadSavedRanges()[0].mixedStrategies).toEqual({
      AA: [{ action: 'raise', frequency: 100 }],
    })
  })

  it('omits mixedStrategies entirely when no entries are valid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          mixedStrategies: { AA: [{ action: 'fold', frequency: 0 }], ZZ: [] },
        },
      ]),
    )
    expect(loadSavedRanges()[0].mixedStrategies).toBeUndefined()
  })
})

describe('range source attribution', () => {
  it('round-trips a range saved with a full source (kind + reference)', () => {
    const range = makeRange({ id: 'r1', source: { kind: 'solver', reference: 'PioSolver sim #4' } })
    saveSavedRange(range)
    expect(loadSavedRanges()).toEqual([range])
  })

  it('round-trips a kind-only source (no reference)', () => {
    saveSavedRange(makeRange({ id: 'r1', source: { kind: 'personal' } }))
    expect(loadSavedRanges()[0].source).toEqual({ kind: 'personal' })
  })

  it('loads a range without a source field', () => {
    saveSavedRange(makeRange({ id: 'r1' }))
    expect(loadSavedRanges()[0].source).toBeUndefined()
  })

  it('trims the reference when saving', () => {
    saveSavedRange(
      makeRange({ id: 'r1', source: { kind: 'book', reference: '  Modern Poker Theory  ' } }),
    )
    expect(loadSavedRanges()[0].source).toEqual({ kind: 'book', reference: 'Modern Poker Theory' })
  })

  it('drops a whitespace-only reference but keeps the kind', () => {
    saveSavedRange(makeRange({ id: 'r1', source: { kind: 'coach', reference: '   ' } }))
    expect(loadSavedRanges()[0].source).toEqual({ kind: 'coach' })
  })

  it('drops an unknown source kind, collapsing the source to undefined', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          source: { kind: 'youtube', reference: 'a video' },
        },
      ]),
    )
    const [loaded] = loadSavedRanges()
    expect(loaded).not.toHaveProperty('source')
    expect(loaded.hands).toEqual(['AA'])
  })

  it('collapses a source with no valid kind to undefined', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r1',
          name: 'R',
          hands: ['AA'],
          createdAt: 'T',
          updatedAt: 'T',
          source: { reference: 'orphan reference, no kind' },
        },
      ]),
    )
    expect(loadSavedRanges()[0]).not.toHaveProperty('source')
  })

  it('ignores a non-object source and keeps the range', () => {
    const stored = { ...makeRange({ id: 'r1' }), source: 'not-an-object' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))
    const [loaded] = loadSavedRanges()
    expect(loaded).not.toHaveProperty('source')
    expect(loaded.id).toBe('r1')
  })
})

describe('replaceSavedRanges', () => {
  it('replaces the whole library, discarding ranges not in the new list', () => {
    saveSavedRange(makeRange({ id: 'old' }))
    replaceSavedRanges([makeRange({ id: 'new-a' }), makeRange({ id: 'new-b' })])
    expect(loadSavedRanges().map((r) => r.id)).toEqual(['new-a', 'new-b'])
  })

  it('clears the library when given an empty list', () => {
    saveSavedRange(makeRange())
    replaceSavedRanges([])
    expect(loadSavedRanges()).toEqual([])
  })
})
