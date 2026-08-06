import { describe, expect, it } from 'vitest'
import { MISS_RECAP_LIMIT, recapMisses } from './missRecap'
import type { PracticeAttempt } from '../types/practice'

function attempt(
  hand: string,
  expectedInRange: boolean,
  correct: boolean,
): PracticeAttempt {
  return {
    hand,
    expectedInRange,
    userAnsweredInRange: correct ? expectedInRange : !expectedInRange,
    correct,
    timestamp: '2026-08-04T10:00:00.000Z',
  }
}

describe('recapMisses', () => {
  it('splits misses into hands to play and hands to fold', () => {
    const recap = recapMisses([
      attempt('AA', true, true),
      attempt('KTs', true, false),
      attempt('72o', false, false),
    ])

    expect(recap).toEqual({ shouldPlay: ['KTs'], shouldFold: ['72o'], hiddenCount: 0 })
  })

  it('returns null when nothing was missed', () => {
    expect(recapMisses([attempt('AA', true, true), attempt('72o', false, true)])).toBeNull()
  })

  it('returns null for an empty session', () => {
    expect(recapMisses([])).toBeNull()
  })

  it('names a repeatedly missed hand once, ahead of the single misses', () => {
    const recap = recapMisses([
      attempt('AKs', true, false),
      attempt('55', true, false),
      attempt('55', true, false),
    ])

    // 55 is missed twice, so it leads even though AKs sorts earlier on the grid.
    expect(recap?.shouldPlay).toEqual(['55', 'AKs'])
  })

  it('breaks ties by grid order, strongest first', () => {
    const recap = recapMisses([
      attempt('72o', false, false),
      attempt('J4s', false, false),
      attempt('Q2s', false, false),
    ])

    expect(recap?.shouldFold).toEqual(['Q2s', 'J4s', '72o'])
  })

  it('keeps the same hand in both lists when the two spots disagree', () => {
    // A spot session spans charts: A5s can be a defend in one and a fold in another.
    const recap = recapMisses([attempt('A5s', true, false), attempt('A5s', false, false)])

    expect(recap).toEqual({ shouldPlay: ['A5s'], shouldFold: ['A5s'], hiddenCount: 0 })
  })

  it('counts the misses the cap leaves out', () => {
    const hands = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55']
    const recap = recapMisses(hands.map((hand) => attempt(hand, true, false)))

    expect(recap?.shouldPlay).toHaveLength(MISS_RECAP_LIMIT)
    expect(recap?.shouldPlay).toEqual(hands.slice(0, MISS_RECAP_LIMIT))
    expect(recap?.hiddenCount).toBe(hands.length - MISS_RECAP_LIMIT)
  })

  it('honours a caller-supplied limit', () => {
    const recap = recapMisses(
      [attempt('AA', true, false), attempt('KK', true, false), attempt('72o', false, false)],
      2,
    )

    expect(recap).toEqual({ shouldPlay: ['AA', 'KK'], shouldFold: [], hiddenCount: 1 })
  })

  it('sorts unrecognised notation last rather than ahead of AA', () => {
    const recap = recapMisses([attempt('ZZ', false, false), attempt('72o', false, false)])

    expect(recap?.shouldFold).toEqual(['72o', 'ZZ'])
  })
})
