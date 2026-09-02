import { describe, expect, it } from 'vitest'
import { rankHandClassLeaks } from './leakReport'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'

function stat(hand: string, attempts: number, correct: number): HandAccuracyStat {
  const wrong = attempts - correct
  return { hand, attempts, correct, falsePositives: wrong, falseNegatives: 0 }
}

function range(...stats: HandAccuracyStat[]): RangeHandAccuracy {
  return Object.fromEntries(stats.map((entry) => [entry.hand, entry]))
}

describe('rankHandClassLeaks', () => {
  it('returns nothing for an empty history', () => {
    expect(rankHandClassLeaks({})).toEqual([])
  })

  it('aggregates hands of the same class across ranges', () => {
    const leaks = rankHandClassLeaks({
      r1: range(stat('98s', 4, 1), stat('76s', 2, 0)),
      r2: range(stat('54s', 4, 4)),
    })

    expect(leaks).toHaveLength(1)
    expect(leaks[0].handClass).toBe('suitedConnector')
    expect(leaks[0].attempts).toBe(10)
    expect(leaks[0].correct).toBe(5)
    expect(leaks[0].accuracy).toBe(50)
    // 54s was never missed, so it is not something to drill.
    expect(leaks[0].missedHands).toEqual(['98s', '76s'])
    expect(leaks[0].pools).toEqual({ r1: ['98s', '76s'] })
  })

  it('ranks the weakest class first', () => {
    const leaks = rankHandClassLeaks({
      r1: range(stat('98s', 4, 3), stat('A5s', 4, 1), stat('AA', 4, 2)),
    })

    expect(leaks.map((leak) => leak.handClass)).toEqual([
      'suitedAce',
      'premiumPair',
      'suitedConnector',
    ])
  })

  it('ignores classes below the attempts threshold', () => {
    const thin = { r1: range(stat('98s', 2, 0)) }
    expect(rankHandClassLeaks(thin)).toEqual([])
    expect(rankHandClassLeaks(thin, 2)).toHaveLength(1)
  })

  it('drops classes the user never gets wrong', () => {
    expect(rankHandClassLeaks({ r1: range(stat('AA', 9, 9)) })).toEqual([])
  })

  it('breaks an accuracy tie toward the class with more attempts', () => {
    const leaks = rankHandClassLeaks({
      r1: range(stat('98s', 4, 2), stat('AA', 10, 5)),
    })

    expect(leaks.map((leak) => leak.handClass)).toEqual(['premiumPair', 'suitedConnector'])
  })
})
