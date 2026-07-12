import { describe, it, expect, beforeEach } from 'vitest'
import { recordFinishedPracticeSession } from './sessionRecording'
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
