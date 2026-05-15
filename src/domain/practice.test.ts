import { describe, it, expect } from 'vitest'
import { ALL_HANDS } from './pokerHands'
import {
  isHandInRange,
  createPracticeAttempt,
  summarizePracticeAttempts,
  reviewSessionMistakes,
  summarizeHandAccuracy,
  compareBuiltRange,
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

describe('reviewSessionMistakes', () => {
  it('returns two empty arrays for an empty session', () => {
    expect(reviewSessionMistakes([])).toEqual({ missed: [], wronglyIncluded: [] })
  })

  it('puts a forgotten hand (in range, answered out) in missed', () => {
    // "AA" is in RANGE but answered "out of range".
    const attempts = [createPracticeAttempt('AA', RANGE, false, 'T')]
    expect(reviewSessionMistakes(attempts)).toEqual({ missed: ['AA'], wronglyIncluded: [] })
  })

  it('puts a wrongly-included hand (out of range, answered in) in wronglyIncluded', () => {
    // "QQ" is not in RANGE but answered "in range".
    const attempts = [createPracticeAttempt('QQ', RANGE, true, 'T')]
    expect(reviewSessionMistakes(attempts)).toEqual({ missed: [], wronglyIncluded: ['QQ'] })
  })

  it('excludes correct attempts (true positive and true negative) from both lists', () => {
    const attempts = [
      createPracticeAttempt('AA', RANGE, true, 'T'), // in range, answered in
      createPracticeAttempt('QQ', RANGE, false, 'T'), // out of range, answered out
    ]
    expect(reviewSessionMistakes(attempts)).toEqual({ missed: [], wronglyIncluded: [] })
  })

  it('de-duplicates repeated mistaken hands, preserving first-occurrence order', () => {
    const attempts = [
      createPracticeAttempt('KK', RANGE, false, 'T'), // missed
      createPracticeAttempt('QQ', RANGE, true, 'T'), // wrongly included
      createPracticeAttempt('AA', RANGE, false, 'T'), // missed
      createPracticeAttempt('KK', RANGE, false, 'T'), // missed again (dup)
      createPracticeAttempt('JJ', RANGE, true, 'T'), // wrongly included
      createPracticeAttempt('QQ', RANGE, true, 'T'), // wrongly included again (dup)
    ]
    expect(reviewSessionMistakes(attempts)).toEqual({
      missed: ['KK', 'AA'],
      wronglyIncluded: ['QQ', 'JJ'],
    })
  })
})

describe('summarizeHandAccuracy', () => {
  it('returns an empty array for an empty session', () => {
    expect(summarizeHandAccuracy([])).toEqual([])
  })

  it('counts a single correct attempt', () => {
    const attempts = [createPracticeAttempt('AA', RANGE, true, 'T')]
    expect(summarizeHandAccuracy(attempts)).toEqual([
      { hand: 'AA', attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0 },
    ])
  })

  it('counts a false positive (out of range, answered "in range")', () => {
    const attempts = [createPracticeAttempt('QQ', RANGE, true, 'T')]
    expect(summarizeHandAccuracy(attempts)).toEqual([
      { hand: 'QQ', attempts: 1, correct: 0, falsePositives: 1, falseNegatives: 0 },
    ])
  })

  it('counts a false negative (in range, answered "out of range")', () => {
    const attempts = [createPracticeAttempt('AA', RANGE, false, 'T')]
    expect(summarizeHandAccuracy(attempts)).toEqual([
      { hand: 'AA', attempts: 1, correct: 0, falsePositives: 0, falseNegatives: 1 },
    ])
  })

  it('accumulates repeated attempts on the same hand into one stat', () => {
    const attempts = [
      createPracticeAttempt('AA', RANGE, true, 'T'),
      createPracticeAttempt('AA', RANGE, true, 'T'),
      createPracticeAttempt('AA', RANGE, false, 'T'), // false negative
    ]
    expect(summarizeHandAccuracy(attempts)).toEqual([
      { hand: 'AA', attempts: 3, correct: 2, falsePositives: 0, falseNegatives: 1 },
    ])
  })

  it('returns multiple hands in canonical order', () => {
    const attempts = [
      createPracticeAttempt('KK', RANGE, true, 'T'),
      createPracticeAttempt('AA', RANGE, true, 'T'),
    ]
    expect(summarizeHandAccuracy(attempts).map((stat) => stat.hand)).toEqual(['AA', 'KK'])
  })

  it('keeps falsePositives + falseNegatives === attempts - correct for every hand', () => {
    const attempts = [
      createPracticeAttempt('QQ', RANGE, true, 'T'), // false positive
      createPracticeAttempt('QQ', RANGE, false, 'T'), // correct (true negative)
      createPracticeAttempt('AA', RANGE, false, 'T'), // false negative
      createPracticeAttempt('AA', RANGE, true, 'T'), // correct (true positive)
    ]
    for (const stat of summarizeHandAccuracy(attempts)) {
      expect(stat.falsePositives + stat.falseNegatives).toBe(stat.attempts - stat.correct)
    }
  })
})

describe('compareBuiltRange', () => {
  it('reports an exact match as all correct with nothing missed or extra', () => {
    expect(compareBuiltRange(RANGE, RANGE)).toEqual({
      correct: ['AA', 'AKs', 'AKo', 'KK'],
      missed: [],
      extra: [],
    })
  })

  it('returns three empty arrays for two empty inputs', () => {
    expect(compareBuiltRange([], [])).toEqual({ correct: [], missed: [], extra: [] })
  })

  it('puts a forgotten hand (in target, not built) only in missed', () => {
    expect(compareBuiltRange(['AA', 'KK'], ['AA'])).toEqual({
      correct: ['AA'],
      missed: ['KK'],
      extra: [],
    })
  })

  it('puts an added hand (in built, not target) only in extra', () => {
    expect(compareBuiltRange(['AA'], ['AA', 'QQ'])).toEqual({
      correct: ['AA'],
      missed: [],
      extra: ['QQ'],
    })
  })

  it('splits a mix of correct, missed, and extra hands into the right lists', () => {
    // target: AA KK AKs ; built: AA AKs QQ -> KK missed, QQ extra
    expect(compareBuiltRange(['AA', 'KK', 'AKs'], ['AA', 'AKs', 'QQ'])).toEqual({
      correct: ['AA', 'AKs'],
      missed: ['KK'],
      extra: ['QQ'],
    })
  })

  it('returns each list in canonical 13x13 order regardless of input order', () => {
    expect(compareBuiltRange(['KK', 'AA', 'AKo'], ['AKo', 'AA', 'KK'])).toEqual({
      correct: ['AA', 'AKo', 'KK'],
      missed: [],
      extra: [],
    })
  })

  it('is unaffected by duplicates in either input and never emits duplicates', () => {
    expect(compareBuiltRange(['AA', 'AA', 'KK'], ['AA', 'AA', 'QQ', 'QQ'])).toEqual({
      correct: ['AA'],
      missed: ['KK'],
      extra: ['QQ'],
    })
  })

  it('throws on an invalid hand in the target', () => {
    expect(() => compareBuiltRange(['AA', 'ZZ'], ['AA'])).toThrow(/ZZ/)
  })

  it('throws on an invalid hand in the built range', () => {
    expect(() => compareBuiltRange(['AA'], ['AA', 'ZZ'])).toThrow(/ZZ/)
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
