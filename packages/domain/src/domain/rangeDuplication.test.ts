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

  it('carries every content-bearing overlay by value', () => {
    const source = makeRange({
      handActions: { AA: 'raise', AKs: 'call' },
      comboSelections: { AA: ['AsAh', 'AsAd'] },
      mixedStrategies: { A5s: [{ action: 'fourBet', frequency: 50 }, { action: 'fold', frequency: 50 }] },
      handNotes: { AKs: '4-bet vs UTG' },
      source: { kind: 'coach', reference: 'Jane' },
      tags: ['MTT', 'Cash'],
    })
    const copy = duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(copy.handActions).toEqual(source.handActions)
    expect(copy.comboSelections).toEqual(source.comboSelections)
    expect(copy.mixedStrategies).toEqual(source.mixedStrategies)
    expect(copy.handNotes).toEqual(source.handNotes)
    expect(copy.source).toEqual(source.source)
    expect(copy.tags).toEqual(['MTT', 'Cash'])
    expect(copy.tags).not.toBe(source.tags)
  })

  it('deep-copies array-valued overlays so the copy is independent', () => {
    const source = makeRange({
      comboSelections: { AA: ['AsAh'] },
      mixedStrategies: { A5s: [{ action: 'fourBet', frequency: 100 }] },
    })
    const copy = duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(copy.comboSelections!.AA).not.toBe(source.comboSelections!.AA)
    expect(copy.mixedStrategies!.A5s).not.toBe(source.mixedStrategies!.A5s)
    expect(copy.mixedStrategies!.A5s[0]).not.toBe(source.mixedStrategies!.A5s[0])
    // Mutating the copy must not reach back into the source.
    copy.comboSelections!.AA.push('AsAd')
    copy.mixedStrategies!.A5s[0].frequency = 25
    expect(source.comboSelections!.AA).toEqual(['AsAh'])
    expect(source.mixedStrategies!.A5s[0].frequency).toBe(100)
  })

  it('omits overlays the source lacks', () => {
    const copy = duplicateRange(makeRange(), NEW_ID, TIMESTAMP)
    for (const key of ['handActions', 'comboSelections', 'mixedStrategies', 'handNotes', 'source', 'tags']) {
      expect(key in copy).toBe(false)
    }
  })

  it('does not inherit library state (archived/favorite)', () => {
    const copy = duplicateRange(makeRange({ archived: true, favorite: true }), NEW_ID, TIMESTAMP)
    expect(copy.archived).toBeUndefined()
    expect(copy.favorite).toBeUndefined()
  })

  it('does not mutate the source', () => {
    const source = makeRange({
      metadata: { position: 'btn' },
      handActions: { AA: 'raise' },
      comboSelections: { AA: ['AsAh'] },
      mixedStrategies: { A5s: [{ action: 'fourBet', frequency: 100 }] },
    })
    const snapshot = structuredClone(source)
    duplicateRange(source, NEW_ID, TIMESTAMP)
    expect(source).toEqual(snapshot)
  })
})
