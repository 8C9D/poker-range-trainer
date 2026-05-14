import { describe, it, expect } from 'vitest'
import { ALL_HANDS } from './pokerHands'
import {
  WEAKNESS_MISTAKE_WEIGHT,
  buildWeaknessPool,
  getWeaknessFocusedHand,
} from './weaknessDrill'
import type { PracticeAttempt } from '../types/practice'

// Only `hand` and `correct` affect the weighting; the other fields are filler.
function attempt(hand: string, correct: boolean): PracticeAttempt {
  return { hand, expectedInRange: true, userAnsweredInRange: correct, correct, timestamp: 'T' }
}

function countIn(pool: string[], hand: string): number {
  return pool.filter((h) => h === hand).length
}

describe('buildWeaknessPool', () => {
  it('is exactly ALL_HANDS when there are no attempts', () => {
    expect(buildWeaknessPool([])).toEqual(ALL_HANDS)
  })

  it('adds mistakeWeight extra copies for a single missed hand', () => {
    const pool = buildWeaknessPool([attempt('QQ', false)])
    expect(countIn(pool, 'QQ')).toBe(1 + WEAKNESS_MISTAKE_WEIGHT)
    expect(countIn(pool, 'AA')).toBe(1) // unrelated hands are unaffected
    expect(pool).toHaveLength(ALL_HANDS.length + WEAKNESS_MISTAKE_WEIGHT)
  })

  it('adds no copies for a correct attempt', () => {
    expect(buildWeaknessPool([attempt('QQ', true)])).toEqual(ALL_HANDS)
  })

  it('stacks repeated mistakes on the same hand', () => {
    const pool = buildWeaknessPool([attempt('72o', false), attempt('72o', false)])
    expect(countIn(pool, '72o')).toBe(1 + WEAKNESS_MISTAKE_WEIGHT * 2)
    expect(pool).toHaveLength(ALL_HANDS.length + WEAKNESS_MISTAKE_WEIGHT * 2)
  })

  it('respects a custom mistake weight', () => {
    const pool = buildWeaknessPool([attempt('QQ', false)], 1)
    expect(countIn(pool, 'QQ')).toBe(2)
    expect(pool).toHaveLength(ALL_HANDS.length + 1)
  })
})

describe('getWeaknessFocusedHand', () => {
  it('draws uniformly when there are no mistakes', () => {
    expect(getWeaknessFocusedHand([], () => 0)).toBe(ALL_HANDS[0])
    expect(getWeaknessFocusedHand([], () => 0)).toBe('AA')
    expect(getWeaknessFocusedHand([], () => 0.999)).toBe(ALL_HANDS[ALL_HANDS.length - 1])
  })

  it('clamps an out-of-range random() of exactly 1 to the last pool entry', () => {
    expect(getWeaknessFocusedHand([], () => 1)).toBe(ALL_HANDS[ALL_HANDS.length - 1])
  })

  it('biases the draw toward a heavily-missed hand', () => {
    const missed = Array.from({ length: 20 }, () => attempt('KK', false))
    const pool = buildWeaknessPool(missed)
    expect(countIn(pool, 'KK')).toBe(1 + WEAKNESS_MISTAKE_WEIGHT * 20)

    // A random value landing inside the (now large) KK block returns KK...
    const kkStart = pool.indexOf('KK')
    const insideKkBlock = (kkStart + 0.5) / pool.length
    expect(getWeaknessFocusedHand(missed, () => insideKkBlock)).toBe('KK')
    // ...whereas the same value on an unbiased pool lands on a different hand.
    expect(getWeaknessFocusedHand([], () => insideKkBlock)).not.toBe('KK')
  })

  it('always returns a canonical hand using the default RNG', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(ALL_HANDS).toContain(getWeaknessFocusedHand([attempt('QQ', false)]))
    }
  })
})
