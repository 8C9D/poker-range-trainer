import { describe, it, expect } from 'vitest'
import { ALL_HANDS } from './pokerHands'
import {
  isHandInRange,
  createPracticeAttempt,
  summarizePracticeAttempts,
  getRandomPracticeHand,
} from './practice'
import type { PracticeAttempt } from '../types/practice'

const RANGE = ['AA', 'KK', 'AKs', 'AKo']

describe('isHandInRange', () => {
  it('returns true for a hand that is in the range', () => {
    expect(isHandInRange('AA', RANGE)).toBe(true)
    expect(isHandInRange('AKs', RANGE)).toBe(true)
    expect(isHandInRange('AKo', RANGE)).toBe(true)
  })

  it('returns false for a hand that is not in the range', () => {
    expect(isHandInRange('QQ', RANGE)).toBe(false)
    expect(isHandInRange('72o', RANGE)).toBe(false)
  })

  it('returns false for an empty range', () => {
    expect(isHandInRange('AA', [])).toBe(false)
  })

  it('is unaffected by duplicate hands in the range', () => {
    expect(isHandInRange('AA', ['AA', 'AA', 'AA'])).toBe(true)
    expect(isHandInRange('KK', ['AA', 'AA'])).toBe(false)
  })

  it('throws on an invalid practice hand', () => {
    expect(() => isHandInRange('ZZ', RANGE)).toThrow(/ZZ/)
    expect(() => isHandInRange('aks', RANGE)).toThrow()
    expect(() => isHandInRange('KAs', RANGE)).toThrow() // wrong rank order
  })

  it('throws on an invalid hand inside the range', () => {
    expect(() => isHandInRange('AA', ['AA', 'ZZ'])).toThrow(/ZZ/)
  })
})

describe('createPracticeAttempt', () => {
  it('marks a true positive correct (in range, answered in range)', () => {
    expect(createPracticeAttempt('AA', RANGE, true, 'T')).toEqual({
      hand: 'AA',
      expectedInRange: true,
      userAnsweredInRange: true,
      correct: true,
      timestamp: 'T',
    })
  })

  it('marks a true negative correct (out of range, answered out of range)', () => {
    const attempt = createPracticeAttempt('QQ', RANGE, false, 'T')
    expect(attempt.expectedInRange).toBe(false)
    expect(attempt.correct).toBe(true)
  })

  it('marks a false positive incorrect (out of range, answered in range)', () => {
    const attempt = createPracticeAttempt('QQ', RANGE, true, 'T')
    expect(attempt.expectedInRange).toBe(false)
    expect(attempt.correct).toBe(false)
  })

  it('marks a false negative incorrect (in range, answered out of range)', () => {
    const attempt = createPracticeAttempt('AA', RANGE, false, 'T')
    expect(attempt.expectedInRange).toBe(true)
    expect(attempt.correct).toBe(false)
  })

  it('defaults the timestamp to a round-trippable ISO-8601 string', () => {
    const attempt = createPracticeAttempt('AA', RANGE, true)
    expect(attempt.timestamp).toBe(new Date(attempt.timestamp).toISOString())
  })

  it('throws on an invalid practice hand', () => {
    expect(() => createPracticeAttempt('ZZ', RANGE, true)).toThrow(/ZZ/)
  })
})

describe('summarizePracticeAttempts', () => {
  const attempt = (correct: boolean): PracticeAttempt => ({
    hand: 'AA',
    expectedInRange: true,
    userAnsweredInRange: correct,
    correct,
    timestamp: 'T',
  })

  it('summarizes an empty session as all zeros', () => {
    expect(summarizePracticeAttempts([])).toEqual({
      totalQuestions: 0,
      correctAnswers: 0,
      accuracyPercentage: 0,
    })
  })

  it('counts total questions, correct answers, and accuracy', () => {
    const summary = summarizePracticeAttempts([
      attempt(true),
      attempt(true),
      attempt(false),
      attempt(true),
    ])
    expect(summary).toEqual({
      totalQuestions: 4,
      correctAnswers: 3,
      accuracyPercentage: 75,
    })
  })

  it('reports 100% when every answer is correct', () => {
    const summary = summarizePracticeAttempts([attempt(true), attempt(true)])
    expect(summary.accuracyPercentage).toBe(100)
  })

  it('reports 0% when every answer is wrong', () => {
    expect(summarizePracticeAttempts([attempt(false)]).accuracyPercentage).toBe(0)
  })
})

describe('getRandomPracticeHand', () => {
  it('returns the first hand when random() is 0', () => {
    expect(getRandomPracticeHand(() => 0)).toBe(ALL_HANDS[0])
    expect(getRandomPracticeHand(() => 0)).toBe('AA')
  })

  it('returns the middle hand for a mid-range random value', () => {
    // floor(0.5 * 169) = 84, the center of the 169-hand list.
    expect(getRandomPracticeHand(() => 0.5)).toBe(ALL_HANDS[84])
    expect(getRandomPracticeHand(() => 0.5)).toBe('88')
  })

  it('returns the last hand for a near-1 random value', () => {
    expect(getRandomPracticeHand(() => 0.999)).toBe(ALL_HANDS[ALL_HANDS.length - 1])
    expect(getRandomPracticeHand(() => 0.999)).toBe('22')
  })

  it('clamps an out-of-range random() of exactly 1 to the last hand', () => {
    expect(getRandomPracticeHand(() => 1)).toBe(ALL_HANDS[ALL_HANDS.length - 1])
  })

  it('always returns a valid canonical hand using the default RNG', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(ALL_HANDS).toContain(getRandomPracticeHand())
    }
  })
})
