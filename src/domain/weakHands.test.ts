import { describe, it, expect } from 'vitest'
import { rankWeakHands, weakHandPools } from './weakHands'
import type { HandAccuracyStat } from '../types/practice'

function stat(hand: string, attempts: number, correct: number): HandAccuracyStat {
  return { hand, attempts, correct, falsePositives: 0, falseNegatives: attempts - correct }
}

describe('rankWeakHands', () => {
  it('returns nothing for empty or mistake-free data', () => {
    expect(rankWeakHands({})).toEqual([])
    expect(rankWeakHands({ r1: { AA: stat('AA', 5, 5) } })).toEqual([])
  })

  it('ranks hands with mistakes by ascending accuracy across ranges', () => {
    const ranked = rankWeakHands({
      r1: { AKs: stat('AKs', 4, 3), A9s: stat('A9s', 4, 1) },
      r2: { KQo: stat('KQo', 2, 1) },
    })
    expect(ranked.map((entry) => entry.hand)).toEqual(['A9s', 'KQo', 'AKs'])
    expect(ranked[0]).toMatchObject({ rangeId: 'r1', accuracy: 25 })
  })

  it('breaks accuracy ties toward more attempts', () => {
    const ranked = rankWeakHands({
      r1: { AKs: stat('AKs', 2, 1), QQ: stat('QQ', 10, 5) },
    })
    expect(ranked.map((entry) => entry.hand)).toEqual(['QQ', 'AKs'])
  })

  it('truncates to the limit', () => {
    const hands = Object.fromEntries(
      ['AA', 'KK', 'QQ', 'JJ'].map((hand) => [hand, stat(hand, 2, 0)]),
    )
    expect(rankWeakHands({ r1: hands }, 2)).toHaveLength(2)
  })
})

describe('weakHandPools', () => {
  it('groups deduped hands per range', () => {
    const pools = weakHandPools([
      { rangeId: 'r1', hand: 'A9s', attempts: 4, correct: 1, accuracy: 25 },
      { rangeId: 'r2', hand: 'KQo', attempts: 2, correct: 1, accuracy: 50 },
      { rangeId: 'r1', hand: 'AKs', attempts: 4, correct: 3, accuracy: 75 },
      { rangeId: 'r1', hand: 'A9s', attempts: 4, correct: 1, accuracy: 25 },
    ])
    expect(pools).toEqual({ r1: ['A9s', 'AKs'], r2: ['KQo'] })
  })
})
