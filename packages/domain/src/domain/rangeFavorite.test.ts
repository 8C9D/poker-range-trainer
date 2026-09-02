import { describe, it, expect } from 'vitest'
import { setRangeFavorite } from './rangeFavorite'
import type { SavedRange } from '../types/range'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Button open',
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('setRangeFavorite', () => {
  it('sets favorite: true when favoriting', () => {
    expect(setRangeFavorite(makeRange(), true).favorite).toBe(true)
  })

  it('omits the favorite key when unfavoriting', () => {
    const result = setRangeFavorite(makeRange({ favorite: true }), false)
    expect('favorite' in result).toBe(false)
  })

  it('keeps favorite: true when favoriting an already-favorited range', () => {
    expect(setRangeFavorite(makeRange({ favorite: true }), true).favorite).toBe(true)
  })

  it('leaves id, name, hands, timestamps, and metadata unchanged', () => {
    const source = makeRange({ metadata: { position: 'btn', actionType: 'open' } })
    const result = setRangeFavorite(source, true)
    expect(result.id).toBe(source.id)
    expect(result.name).toBe(source.name)
    expect(result.hands).toEqual(source.hands)
    expect(result.createdAt).toBe(source.createdAt)
    expect(result.updatedAt).toBe(source.updatedAt)
    expect(result.metadata).toEqual(source.metadata)
  })

  it('returns a new object without mutating the source', () => {
    const source = makeRange({ favorite: true })
    const snapshot = structuredClone(source)
    const result = setRangeFavorite(source, false)
    expect(result).not.toBe(source)
    expect(source).toEqual(snapshot)
  })
})
