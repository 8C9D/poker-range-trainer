import { describe, it, expect } from 'vitest'
import { duplicateRange } from './rangeDuplication'
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

const NEW_ID = 'r2'
const TIMESTAMP = '2026-06-05T12:00:00.000Z'

describe('duplicateRange', () => {
  it('gives the copy the supplied new id', () => {
    expect(duplicateRange(makeRange(), NEW_ID, TIMESTAMP).id).toBe(NEW_ID)
  })

  it('names the copy "<name> (copy)"', () => {
    expect(duplicateRange(makeRange({ name: 'Button open' }), NEW_ID, TIMESTAMP).name).toBe(
      'Button open (copy)',
    )
  })

  it('copies hands by value into a fresh array', () => {
    const source = makeRange({ hands: ['AA', 'KK'] })
    const copy = duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(copy.hands).toEqual(['AA', 'KK'])
    expect(copy.hands).not.toBe(source.hands)
  })

  it('sets both createdAt and updatedAt to the supplied timestamp', () => {
    const copy = duplicateRange(makeRange(), NEW_ID, TIMESTAMP)
    expect(copy.createdAt).toBe(TIMESTAMP)
    expect(copy.updatedAt).toBe(TIMESTAMP)
  })

  it('shallow-copies metadata when present', () => {
    const source = makeRange({ metadata: { position: 'btn', actionType: 'open' } })
    const copy = duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(copy.metadata).toEqual(source.metadata)
    expect(copy.metadata).not.toBe(source.metadata)
  })

  it('omits metadata entirely when the source has none', () => {
    const copy = duplicateRange(makeRange(), NEW_ID, TIMESTAMP)
    expect('metadata' in copy).toBe(false)
  })

  it('does not mutate the source', () => {
    const source = makeRange({ metadata: { position: 'btn' } })
    const snapshot = structuredClone(source)
    duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(source).toEqual(snapshot)
  })
})
