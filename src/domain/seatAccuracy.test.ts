import { describe, expect, it } from 'vitest'
import { accuracyByActionType, accuracyByPosition } from './seatAccuracy'
import type { RangePracticeStats } from '../types/practice'
import type { RangeMetadata, SavedRange } from '../types/range'

function makeRange(id: string, metadata: RangeMetadata, archived = false): SavedRange {
  return {
    id,
    name: id,
    hands: ['AA'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
    archived,
  }
}

function stat(rangeId: string, totalAttempts: number, correctAttempts: number): RangePracticeStats {
  return { rangeId, totalAttempts, correctAttempts, lastPracticedAt: '2026-07-20T00:00:00.000Z' }
}

describe('accuracyByPosition', () => {
  it('is empty without practice', () => {
    expect(accuracyByPosition([makeRange('a', { position: 'btn' })], {})).toEqual([])
  })

  it('sums every range saved for a seat', () => {
    const ranges = [makeRange('a', { position: 'btn' }), makeRange('b', { position: 'btn' })]
    const stats = { a: stat('a', 10, 8), b: stat('b', 10, 6) }

    expect(accuracyByPosition(ranges, stats)).toEqual([
      { key: 'btn', attempts: 20, correct: 14, accuracy: 70, rangeCount: 2 },
    ])
  })

  it('ranks the weakest seat first', () => {
    const ranges = [
      makeRange('a', { position: 'btn' }),
      makeRange('b', { position: 'sb' }),
      makeRange('c', { position: 'bb' }),
    ]
    const stats = { a: stat('a', 10, 9), b: stat('b', 10, 4), c: stat('c', 10, 7) }

    expect(accuracyByPosition(ranges, stats).map((group) => group.key)).toEqual(['sb', 'bb', 'btn'])
  })

  it('leaves out seats below the attempt threshold', () => {
    const ranges = [makeRange('a', { position: 'btn' }), makeRange('b', { position: 'sb' })]
    const stats = { a: stat('a', 4, 0), b: stat('b', 5, 5) }

    expect(accuracyByPosition(ranges, stats).map((group) => group.key)).toEqual(['sb'])
  })

  it('ignores archived ranges and ranges with no seat recorded', () => {
    const ranges = [
      makeRange('a', { position: 'btn' }, true),
      makeRange('b', {}),
      makeRange('c', { position: 'co' }),
    ]
    const stats = { a: stat('a', 10, 0), b: stat('b', 10, 0), c: stat('c', 10, 5) }

    expect(accuracyByPosition(ranges, stats)).toEqual([
      { key: 'co', attempts: 10, correct: 5, accuracy: 50, rangeCount: 1 },
    ])
  })
})

describe('accuracyByActionType', () => {
  it('cuts the same stats by the declared action', () => {
    const ranges = [
      makeRange('a', { position: 'btn', actionType: 'open' }),
      makeRange('b', { position: 'bb', actionType: 'defend' }),
    ]
    const stats = { a: stat('a', 10, 9), b: stat('b', 10, 3) }

    expect(accuracyByActionType(ranges, stats)).toEqual([
      { key: 'defend', attempts: 10, correct: 3, accuracy: 30, rangeCount: 1 },
      { key: 'open', attempts: 10, correct: 9, accuracy: 90, rangeCount: 1 },
    ])
  })

  it('breaks an accuracy tie toward the more practiced action', () => {
    const ranges = [
      makeRange('a', { actionType: 'open' }),
      makeRange('b', { actionType: 'threeBet' }),
    ]
    const stats = { a: stat('a', 10, 5), b: stat('b', 20, 10) }

    expect(accuracyByActionType(ranges, stats).map((group) => group.key)).toEqual([
      'threeBet',
      'open',
    ])
  })
})
