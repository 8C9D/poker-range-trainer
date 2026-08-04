import { describe, it, expect, beforeEach } from 'vitest'
import { recordFinishedSummarySession, recordFinishedPracticeSession } from './sessionRecording'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import type { PracticeAttempt } from '../types/practice'

beforeEach(() => {
  localStorage.clear()
})

function attempt(hand: string, correct: boolean): PracticeAttempt {
  return {
    hand,
    expectedInRange: true,
    userAnsweredInRange: correct,
    correct,
    timestamp: '2026-07-11T10:00:00.000Z',
  }
}

describe('recordFinishedPracticeSession', () => {
  it('records stats, hand accuracy, history, and schedules a review', () => {
    recordFinishedPracticeSession('r1', [attempt('AA', true), attempt('KK', false)])

    const stats = loadPracticeStats()['r1']
    expect(stats.totalAttempts).toBe(2)
    expect(stats.correctAttempts).toBe(1)

    const handAccuracy = loadHandAccuracy()['r1']
    expect(handAccuracy['AA'].correct).toBe(1)
    expect(handAccuracy['KK'].correct).toBe(0)

    const history = loadSessionHistory()['r1']
    expect(history).toHaveLength(1)
    expect(history[0].totalQuestions).toBe(2)

    const review = loadReviewStates()['r1']
    expect(review.dueAt).not.toBe('')
    expect(review.intervalDays).toBeGreaterThanOrEqual(1)
  })

  it('advances an existing review schedule instead of reseeding it', () => {
    recordFinishedPracticeSession('r1', [attempt('AA', true)])
    const first = loadReviewStates()['r1']
    recordFinishedPracticeSession('r1', [attempt('AA', true), attempt('KK', true)])
    const second = loadReviewStates()['r1']
    expect(second.ease).toBeGreaterThan(first.ease)
  })

  it('records no stats for an empty session but still advances the schedule', () => {
    recordFinishedPracticeSession('r1', [])
    expect(loadPracticeStats()['r1']).toBeUndefined()
    expect(loadSessionHistory()['r1']).toBeUndefined()
    expect(loadReviewStates()['r1']).toBeDefined()
  })
})

describe('recordFinishedSummarySession', () => {
  it('counts the session everywhere volume and scheduling are read from', () => {
    recordFinishedSummarySession('r1', {
      totalQuestions: 9,
      correctAnswers: 6,
      accuracyPercentage: (6 / 9) * 100,
    })

    const stats = loadPracticeStats()['r1']
    expect(stats.totalAttempts).toBe(9)
    expect(stats.correctAttempts).toBe(6)

    // The streak, the daily goal and the weekly charts all read the history.
    const history = loadSessionHistory()['r1']
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ totalQuestions: 9, correctAnswers: 6 })

    expect(loadReviewStates()['r1'].dueAt).not.toBe('')
  })

  it('leaves the per-hand record alone', () => {
    // "Which action" has no in-or-out answer, so it has no false positive or
    // negative to record — writing one would invent a mistake in a direction the
    // quiz never asked about.
    recordFinishedSummarySession('r1', {
      totalQuestions: 4,
      correctAnswers: 2,
      accuracyPercentage: 50,
    })
    expect(loadHandAccuracy()['r1']).toBeUndefined()
  })

  it('shares one schedule with recognition rather than running a second one', () => {
    recordFinishedPracticeSession('r1', [attempt('AA', true)])
    const first = loadReviewStates()['r1']
    recordFinishedSummarySession('r1', {
      totalQuestions: 10,
      correctAnswers: 10,
      accuracyPercentage: 100,
    })
    const second = loadReviewStates()['r1']
    expect(second.ease).toBeGreaterThan(first.ease)
  })
})

describe('recordFinishedPracticeSession confidence weighting', () => {
  /** Ten answers on `hand`, all correct — a perfect session by whole-session accuracy. */
  function perfectSession(hand: string): PracticeAttempt[] {
    return Array.from({ length: 10 }, () => attempt(hand, true))
  }

  it('shortens the next interval while stubbornly-wrong hands remain', () => {
    // A long-standing weak hand, then a flawless session on a different hand.
    recordFinishedPracticeSession('r1', [attempt('72o', false), attempt('72o', false)])
    const afterWeak = loadReviewStates()['r1']

    recordFinishedPracticeSession('r1', perfectSession('AA'))
    const withWeakHand = loadReviewStates()['r1'].intervalDays

    // The same perfect session on a range with a clean record schedules further out.
    localStorage.clear()
    recordFinishedPracticeSession('r2', perfectSession('AA'))
    recordFinishedPracticeSession('r2', perfectSession('AA'))
    const clean = loadReviewStates()['r2'].intervalDays

    expect(afterWeak.intervalDays).toBe(1)
    expect(withWeakHand).toBeLessThan(clean)
  })
})
