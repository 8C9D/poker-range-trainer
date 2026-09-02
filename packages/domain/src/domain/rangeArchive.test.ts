import { describe, it, expect } from 'vitest'
import { setRangeArchived } from './rangeArchive'
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

describe('setRangeArchived', () => {
  it('sets archived: true when archiving', () => {
    expect(setRangeArchived(makeRange(), true).archived).toBe(true)
  })

  it('omits the archived key when unarchiving', () => {
    const result = setRangeArchived(makeRange({ archived: true }), false)
    expect('archived' in result).toBe(false)
  })

  it('keeps archived: true when archiving an already-archived range', () => {
    expect(setRangeArchived(makeRange({ archived: true }), true).archived).toBe(true)
  })

  it('leaves id, name, hands, timestamps, and metadata unchanged', () => {
    const source = makeRange({ metadata: { position: 'btn', actionType: 'open' } })
    const result = setRangeArchived(source, true)
    expect(result.id).toBe(source.id)
    expect(result.name).toBe(source.name)
    expect(result.hands).toEqual(source.hands)
    expect(result.createdAt).toBe(source.createdAt)
    expect(result.updatedAt).toBe(source.updatedAt)
    expect(result.metadata).toEqual(source.metadata)
  })

  it('returns a new object without mutating the source', () => {
    const source = makeRange({ archived: true })
    const snapshot = structuredClone(source)
    const result = setRangeArchived(source, false)
    expect(result).not.toBe(source)
    expect(source).toEqual(snapshot)
  })
})
