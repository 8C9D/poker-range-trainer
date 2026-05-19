import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EASE,
  MIN_EASE,
  FIRST_INTERVAL_DAYS,
  seedReviewState,
  scheduleNextReview,
  isReviewDue,
} from './spacedRepetition'
import type { RangeReviewState } from '../types/practice'

const REVIEWED_AT = '2026-01-01T00:00:00.000Z'

describe('seedReviewState', () => {
  it('creates a never-scheduled state with the default ease', () => {
    expect(seedReviewState('r1')).toEqual({
      rangeId: 'r1',
      ease: DEFAULT_EASE,
      intervalDays: 0,
      dueAt: '',
      lastReviewedAt: '',
    })
  })
})

describe('scheduleNextReview', () => {
  it('resets the interval to 1 day and lowers ease for a weak session', () => {
    const next = scheduleNextReview(seedReviewState('r1'), 30, REVIEWED_AT)
    expect(next.intervalDays).toBe(1)
    expect(next.ease).toBeCloseTo(DEFAULT_EASE - 0.2)
    expect(next.dueAt).toBe('2026-01-02T00:00:00.000Z')
    expect(next.lastReviewedAt).toBe(REVIEWED_AT)
  })

  it('floors ease at MIN_EASE on repeated weak sessions', () => {
    const low: RangeReviewState = { ...seedReviewState('r1'), ease: 1.4 }
    expect(scheduleNextReview(low, 10, REVIEWED_AT).ease).toBe(MIN_EASE)
  })

  it('keeps ease and a minimum interval for a medium session', () => {
    const fresh = scheduleNextReview(seedReviewState('r1'), 60, REVIEWED_AT)
    expect(fresh.intervalDays).toBe(1) // seed interval 0 -> at least 1
    expect(fresh.ease).toBe(DEFAULT_EASE)

    const established: RangeReviewState = { ...seedReviewState('r1'), intervalDays: 6 }
    const kept = scheduleNextReview(established, 60, REVIEWED_AT)
    expect(kept.intervalDays).toBe(6)
    expect(kept.ease).toBe(DEFAULT_EASE)
  })

  it('grants the first interval and raises ease for a strong first session', () => {
    const next = scheduleNextReview(seedReviewState('r1'), 90, REVIEWED_AT)
    expect(next.intervalDays).toBe(FIRST_INTERVAL_DAYS)
    expect(next.ease).toBeCloseTo(DEFAULT_EASE + 0.1)
  })

  it('multiplies the interval by ease (rounded) for a strong later session', () => {
    const established: RangeReviewState = { ...seedReviewState('r1'), ease: 2.5, intervalDays: 6 }
    const next = scheduleNextReview(established, 100, REVIEWED_AT)
    expect(next.intervalDays).toBe(15) // round(6 * 2.5)
    expect(next.dueAt).toBe('2026-01-16T00:00:00.000Z') // reviewedAt + 15 days
  })
})

describe('isReviewDue', () => {
  const state: RangeReviewState = {
    rangeId: 'r1',
    ease: DEFAULT_EASE,
    intervalDays: 1,
    dueAt: '2026-01-02T00:00:00.000Z',
    lastReviewedAt: REVIEWED_AT,
  }

  it('is true when now is at or past dueAt', () => {
    expect(isReviewDue(state, '2026-01-02T00:00:00.000Z')).toBe(true)
    expect(isReviewDue(state, '2026-01-03T00:00:00.000Z')).toBe(true)
  })

  it('is false before dueAt', () => {
    expect(isReviewDue(state, '2026-01-01T12:00:00.000Z')).toBe(false)
  })

  it('is false for a never-scheduled seed state', () => {
    expect(isReviewDue(seedReviewState('r1'), '2030-01-01T00:00:00.000Z')).toBe(false)
  })
})
