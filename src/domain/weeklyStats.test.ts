import { describe, it, expect } from 'vitest'
import { dailyHandCounts, summarizeWeek } from './weeklyStats'
import type { PracticeSessionRecord } from '../types/practice'

const NOW = '2026-07-11T12:00:00.000Z'

function session(rangeId: string, playedAt: string, total: number, correct: number): PracticeSessionRecord {
  return { rangeId, playedAt, totalQuestions: total, correctAnswers: correct }
}

describe('summarizeWeek', () => {
  it('returns zeros and no sharpest range for empty history', () => {
    expect(summarizeWeek({}, NOW)).toEqual({
      handsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      sharpestRangeId: null,
      sharpestAccuracy: 0,
    })
  })

  it('sums hands and accuracy across ranges inside the window', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 10, 9)],
      b: [session('b', '2026-07-08T10:00:00.000Z', 20, 10)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.handsAnswered).toBe(30)
    expect(summary.correctAnswers).toBe(19)
    expect(summary.accuracy).toBeCloseTo((19 / 30) * 100)
  })

  it('excludes sessions older than the window and in the future', () => {
    const history = {
      a: [
        session('a', '2026-07-01T10:00:00.000Z', 10, 10), // too old
        session('a', '2026-07-20T10:00:00.000Z', 10, 10), // future
        session('a', '2026-07-09T10:00:00.000Z', 5, 4),
      ],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.handsAnswered).toBe(5)
    expect(summary.correctAnswers).toBe(4)
  })

  it('picks the range with the highest windowed accuracy as sharpest', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 10, 6)],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 9)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.sharpestRangeId).toBe('b')
    expect(summary.sharpestAccuracy).toBe(90)
  })

  it('breaks accuracy ties toward more hands answered', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 4, 2)],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 5)],
    }
    expect(summarizeWeek(history, NOW).sharpestRangeId).toBe('b')
  })

  it('aggregates multiple sessions of the same range before ranking', () => {
    const history = {
      a: [
        session('a', '2026-07-09T10:00:00.000Z', 10, 5),
        session('a', '2026-07-10T10:00:00.000Z', 10, 10),
      ],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 8)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.sharpestRangeId).toBe('b')
    expect(summary.sharpestAccuracy).toBe(80)
  })
})

describe('dailyHandCounts', () => {
  it('returns seven zeroed days for empty history, ending today', () => {
    const days = dailyHandCounts({}, NOW)
    expect(days).toHaveLength(7)
    expect(days.every((day) => day.handsAnswered === 0)).toBe(true)
    expect(new Date(days[6].dayStart).getDate()).toBe(11)
    expect(new Date(days[0].dayStart).getDate()).toBe(5)
    expect(new Date(days[6].dayStart).getHours()).toBe(0)
    expect(new Date(days[0].dayStart).getHours()).toBe(0)
  })

  it('buckets sessions into their local calendar day', () => {
    const localNow = new Date(2026, 6, 11, 12).toISOString()
    const days = dailyHandCounts(
      {
        a: [
          session('a', new Date(2026, 6, 11, 1).toISOString(), 10, 8),
          session('a', new Date(2026, 6, 11, 23).toISOString(), 5, 5),
          session('a', new Date(2026, 6, 9, 12).toISOString(), 7, 6),
        ],
        b: [session('b', new Date(2026, 6, 9, 13).toISOString(), 3, 1)],
      },
      localNow,
    )
    expect(days[6].handsAnswered).toBe(15)
    expect(days[4].handsAnswered).toBe(10)
    expect(days[5].handsAnswered).toBe(0)
  })

  it('does not pull the previous local evening into today near a UTC boundary', () => {
    const now = new Date(2026, 6, 11, 0, 30).toISOString()
    const previousEvening = new Date(2026, 6, 10, 23, 30).toISOString()
    const afterMidnight = new Date(2026, 6, 11, 0, 15).toISOString()

    const days = dailyHandCounts(
      {
        a: [
          session('a', previousEvening, 9, 9),
          session('a', afterMidnight, 4, 4),
        ],
      },
      now,
      1,
    )

    expect(days[0].handsAnswered).toBe(4)
  })

  it('ignores sessions outside the window', () => {
    const days = dailyHandCounts(
      {
        a: [
          session('a', '2026-07-04T12:00:00.000Z', 10, 8), // day before window
          session('a', '2026-07-12T12:00:00.000Z', 10, 8), // tomorrow
        ],
      },
      NOW,
    )
    expect(days.every((day) => day.handsAnswered === 0)).toBe(true)
  })
})
