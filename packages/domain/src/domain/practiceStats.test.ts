import { describe, it, expect } from 'vitest'
import { practiceAccuracyPercentage } from './practiceStats'
import type { RangePracticeStats } from '../types/practice'

function makeStats(overrides: Partial<RangePracticeStats> = {}): RangePracticeStats {
  return {
    rangeId: 'r1',
    totalAttempts: 0,
    correctAttempts: 0,
    lastPracticedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('practiceAccuracyPercentage', () => {
  it('is 100 for a perfect record', () => {
    expect(
      practiceAccuracyPercentage(makeStats({ totalAttempts: 4, correctAttempts: 4 })),
    ).toBe(100)
  })

  it('is the correct fraction for a partial record', () => {
    expect(
      practiceAccuracyPercentage(makeStats({ totalAttempts: 4, correctAttempts: 1 })),
    ).toBe(25)
  })

  it('guards the zero-attempt case as 0 rather than NaN', () => {
    const accuracy = practiceAccuracyPercentage(
      makeStats({ totalAttempts: 0, correctAttempts: 0 }),
    )
    expect(accuracy).toBe(0)
    expect(Number.isNaN(accuracy)).toBe(false)
  })
})
