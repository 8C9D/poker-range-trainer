import { describe, it, expect, beforeEach } from 'vitest'
import type { PracticeSessionRecord } from '../types/practice'
import {
  SESSION_HISTORY_STORAGE_KEY,
  loadSessionHistory,
  recordPracticeSessionHistory,
} from './sessionHistoryStorage'

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

describe('loadSessionHistory', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadSessionHistory()).toEqual({})
  })

  it('returns an empty map when the stored JSON is corrupt', () => {
    localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, '{not valid json')
    expect(loadSessionHistory()).toEqual({})
  })

  it('returns an empty map when the stored value is not an object', () => {
    localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadSessionHistory()).toEqual({})
  })

  it('skips malformed records but keeps valid ones', () => {
    const valid: PracticeSessionRecord = {
      rangeId: 'r1',
      playedAt: '2026-01-01T00:00:00.000Z',
      totalQuestions: 5,
      correctAnswers: 4,
    }
    localStorage.setItem(
      SESSION_HISTORY_STORAGE_KEY,
      JSON.stringify({
        r1: [
          valid,
          { rangeId: 'r1', playedAt: 'x', totalQuestions: -1, correctAnswers: 0 }, // negative
          { playedAt: 'x', totalQuestions: 1, correctAnswers: 1 }, // missing rangeId
          42,
        ],
        notAList: 7,
      }),
    )
    expect(loadSessionHistory()).toEqual({ r1: [valid] })
  })
})

describe('recordPracticeSessionHistory', () => {
  it('records a session and round-trips it', () => {
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 5, correctAnswers: 4 },
      '2026-01-01T00:00:00.000Z',
    )
    expect(loadSessionHistory()).toEqual({
      r1: [
        {
          rangeId: 'r1',
          playedAt: '2026-01-01T00:00:00.000Z',
          totalQuestions: 5,
          correctAnswers: 4,
        },
      ],
    })
  })

  it('appends a second session oldest-first', () => {
    recordPracticeSessionHistory('r1', { totalQuestions: 3, correctAnswers: 3 }, '2026-01-01T00:00:00.000Z')
    recordPracticeSessionHistory('r1', { totalQuestions: 4, correctAnswers: 1 }, '2026-01-02T00:00:00.000Z')

    const list = loadSessionHistory().r1
    expect(list).toHaveLength(2)
    expect(list.map((record) => record.playedAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ])
  })

  it('is a no-op when totalQuestions is 0', () => {
    recordPracticeSessionHistory('r1', { totalQuestions: 0, correctAnswers: 0 }, '2026-01-01T00:00:00.000Z')
    expect(loadSessionHistory()).toEqual({})
  })

  it('records ranges independently', () => {
    recordPracticeSessionHistory('a', { totalQuestions: 2, correctAnswers: 2 }, '2026-01-01T00:00:00.000Z')
    recordPracticeSessionHistory('b', { totalQuestions: 6, correctAnswers: 3 }, '2026-01-02T00:00:00.000Z')

    const history = loadSessionHistory()
    expect(history.a).toHaveLength(1)
    expect(history.b).toHaveLength(1)
    expect(history.a[0].rangeId).toBe('a')
    expect(history.b[0].rangeId).toBe('b')
  })

  it('defaults playedAt to now when not supplied', () => {
    const before = Date.now()
    recordPracticeSessionHistory('r1', { totalQuestions: 1, correctAnswers: 1 })
    const after = Date.now()

    const recordedMs = new Date(loadSessionHistory().r1[0].playedAt).getTime()
    expect(recordedMs).toBeGreaterThanOrEqual(before)
    expect(recordedMs).toBeLessThanOrEqual(after)
  })
})
