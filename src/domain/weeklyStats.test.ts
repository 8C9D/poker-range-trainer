import { describe, it, expect } from 'vitest'
import { summarizeWeek } from './weeklyStats'
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
