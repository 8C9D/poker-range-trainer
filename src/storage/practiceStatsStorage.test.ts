import { describe, it, expect, beforeEach } from 'vitest'
import type { RangePracticeStats } from '../types/practice'
import {
  PRACTICE_STATS_STORAGE_KEY,
  loadPracticeStats,
  recordPracticeSession,
} from './practiceStatsStorage'

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

describe('loadPracticeStats', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadPracticeStats()).toEqual({})
  })

  it('returns an empty map when the stored JSON is corrupt', () => {
    localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, '{not valid json')
    expect(loadPracticeStats()).toEqual({})
  })

  it('returns an empty map when the stored value is not an object', () => {
    localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadPracticeStats()).toEqual({})

    localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify('a string'))
    expect(loadPracticeStats()).toEqual({})
  })

  it('skips malformed entries but keeps valid ones', () => {
    const valid: RangePracticeStats = {
      rangeId: 'good',
      totalAttempts: 10,
      correctAttempts: 7,
      lastPracticedAt: '2026-01-01T00:00:00.000Z',
    }
    localStorage.setItem(
      PRACTICE_STATS_STORAGE_KEY,
      JSON.stringify({
        good: valid,
        missingId: { totalAttempts: 1, correctAttempts: 1, lastPracticedAt: 'x' },
        negativeCount: {
          rangeId: 'negativeCount',
          totalAttempts: -1,
          correctAttempts: 0,
          lastPracticedAt: 'x',
        },
        nonNumericCount: {
          rangeId: 'nonNumericCount',
          totalAttempts: 'lots',
          correctAttempts: 0,
          lastPracticedAt: 'x',
        },
        noTimestamp: { rangeId: 'noTimestamp', totalAttempts: 1, correctAttempts: 1 },
        notAnObject: 42,
        nullEntry: null,
      }),
    )
    expect(loadPracticeStats()).toEqual({ good: valid })
  })

  it('re-keys entries by their own rangeId, ignoring the stored map key', () => {
    const value: RangePracticeStats = {
      rangeId: 'real-id',
      totalAttempts: 4,
      correctAttempts: 2,
      lastPracticedAt: '2026-01-01T00:00:00.000Z',
    }
    localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify({ 'stale-key': value }))
    expect(loadPracticeStats()).toEqual({ 'real-id': value })
  })

  it('round-trips a value written by recordPracticeSession', () => {
    recordPracticeSession(
      'r1',
      { totalQuestions: 5, correctAnswers: 4 },
      '2026-01-01T00:00:00.000Z',
    )
    expect(loadPracticeStats()).toEqual({
      r1: {
        rangeId: 'r1',
        totalAttempts: 5,
        correctAttempts: 4,
        lastPracticedAt: '2026-01-01T00:00:00.000Z',
      },
    })
  })
})

describe('recordPracticeSession', () => {
  it('creates a new record for a first session', () => {
    recordPracticeSession(
      'r1',
      { totalQuestions: 8, correctAnswers: 6 },
      '2026-02-01T00:00:00.000Z',
    )
    expect(loadPracticeStats().r1).toEqual({
      rangeId: 'r1',
      totalAttempts: 8,
      correctAttempts: 6,
      lastPracticedAt: '2026-02-01T00:00:00.000Z',
    })
  })

  it('folds a second session into the existing record cumulatively', () => {
    recordPracticeSession(
      'r1',
      { totalQuestions: 8, correctAnswers: 6 },
      '2026-02-01T00:00:00.000Z',
    )
    recordPracticeSession(
      'r1',
      { totalQuestions: 4, correctAnswers: 1 },
      '2026-02-02T00:00:00.000Z',
    )
    expect(loadPracticeStats().r1).toEqual({
      rangeId: 'r1',
      totalAttempts: 12,
      correctAttempts: 7,
      lastPracticedAt: '2026-02-02T00:00:00.000Z',
    })
  })

  it('records ranges independently', () => {
    recordPracticeSession('a', { totalQuestions: 3, correctAnswers: 3 }, '2026-02-01T00:00:00.000Z')
    recordPracticeSession('b', { totalQuestions: 5, correctAnswers: 2 }, '2026-02-02T00:00:00.000Z')
    expect(loadPracticeStats()).toEqual({
      a: {
        rangeId: 'a',
        totalAttempts: 3,
        correctAttempts: 3,
        lastPracticedAt: '2026-02-01T00:00:00.000Z',
      },
      b: {
        rangeId: 'b',
        totalAttempts: 5,
        correctAttempts: 2,
        lastPracticedAt: '2026-02-02T00:00:00.000Z',
      },
    })
  })

  it('is a no-op when totalQuestions is 0 and no record exists', () => {
    recordPracticeSession(
      'r1',
      { totalQuestions: 0, correctAnswers: 0 },
      '2026-02-01T00:00:00.000Z',
    )
    expect(loadPracticeStats()).toEqual({})
  })

  it('leaves an existing record unchanged when totalQuestions is 0', () => {
    recordPracticeSession(
      'r1',
      { totalQuestions: 8, correctAnswers: 6 },
      '2026-02-01T00:00:00.000Z',
    )
    recordPracticeSession(
      'r1',
      { totalQuestions: 0, correctAnswers: 0 },
      '2026-02-09T00:00:00.000Z',
    )
    expect(loadPracticeStats().r1).toEqual({
      rangeId: 'r1',
      totalAttempts: 8,
      correctAttempts: 6,
      lastPracticedAt: '2026-02-01T00:00:00.000Z',
    })
  })

  it('defaults the timestamp to now when one is not supplied', () => {
    const before = Date.now()
    recordPracticeSession('r1', { totalQuestions: 1, correctAnswers: 1 })
    const after = Date.now()

    const recordedMs = new Date(loadPracticeStats().r1.lastPracticedAt).getTime()
    expect(recordedMs).toBeGreaterThanOrEqual(before)
    expect(recordedMs).toBeLessThanOrEqual(after)
  })
})
