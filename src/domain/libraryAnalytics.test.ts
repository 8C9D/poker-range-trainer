import { describe, it, expect } from 'vitest'
import type { RangePracticeStats } from '../types/practice'
import { summarizeLibraryAnalytics } from './libraryAnalytics'

function makeStats(overrides: Partial<RangePracticeStats> = {}): RangePracticeStats {
  return {
    rangeId: 'r1',
    totalAttempts: 10,
    correctAttempts: 8,
    lastPracticedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('summarizeLibraryAnalytics', () => {
  it('returns all zeros for an empty list', () => {
    expect(summarizeLibraryAnalytics([])).toEqual({
      rangesPracticed: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
    })
  })

  it('aggregates totals and overall accuracy across ranges', () => {
    // Totals chosen so the overall ratio (20/40 = 0.5) is exact in float.
    const stats = [
      makeStats({ rangeId: 'a', totalAttempts: 10, correctAttempts: 7 }),
      makeStats({ rangeId: 'b', totalAttempts: 30, correctAttempts: 13 }),
    ]
    expect(summarizeLibraryAnalytics(stats)).toEqual({
      rangesPracticed: 2,
      totalAttempts: 40,
      totalCorrect: 20,
      overallAccuracy: 50,
    })
  })

  it('does not count zero-attempt ranges as practiced', () => {
    // 6/8 = 0.75 is exact in float, so overallAccuracy is precisely 75.
    const stats = [
      makeStats({ rangeId: 'a', totalAttempts: 8, correctAttempts: 6 }),
      makeStats({ rangeId: 'z', totalAttempts: 0, correctAttempts: 0 }),
    ]
    expect(summarizeLibraryAnalytics(stats)).toEqual({
      rangesPracticed: 1,
      totalAttempts: 8,
      totalCorrect: 6,
      overallAccuracy: 75,
    })
  })
})
