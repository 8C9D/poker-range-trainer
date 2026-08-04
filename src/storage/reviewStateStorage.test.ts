import { describe, it, expect, beforeEach } from 'vitest'
import type { RangeReviewState } from '../types/practice'
import {
  REVIEW_STATE_STORAGE_KEY,
  loadReviewStates,
  saveReviewState,
} from './reviewStateStorage'

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

function state(over: Partial<RangeReviewState> = {}): RangeReviewState {
  return {
    rangeId: 'r1',
    ease: 2.5,
    intervalDays: 1,
    dueAt: '2026-01-02T00:00:00.000Z',
    lastReviewedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('loadReviewStates', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadReviewStates()).toEqual({})
  })

  it('returns an empty map when the stored JSON is corrupt', () => {
    localStorage.setItem(REVIEW_STATE_STORAGE_KEY, '{not valid json')
    expect(loadReviewStates()).toEqual({})
  })

  it('returns an empty map when the stored value is not an object', () => {
    localStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadReviewStates()).toEqual({})
  })

  it('skips malformed entries but keeps valid ones', () => {
    const valid = state({ rangeId: 'good' })
    localStorage.setItem(
      REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        good: valid,
        noId: { ease: 2.5, intervalDays: 1, dueAt: 'x', lastReviewedAt: 'y' },
        badEase: { rangeId: 'badEase', ease: 'lots', intervalDays: 1, dueAt: 'x', lastReviewedAt: 'y' },
        negInterval: { rangeId: 'negInterval', ease: 2, intervalDays: -1, dueAt: 'x', lastReviewedAt: 'y' },
        fractionalInterval: {
          rangeId: 'fractionalInterval',
          ease: 2,
          intervalDays: 1.5,
          dueAt: '2026-01-02T00:00:00.000Z',
          lastReviewedAt: '2026-01-01T00:00:00.000Z',
        },
        backwardsDue: {
          rangeId: 'backwardsDue',
          ease: 2,
          intervalDays: 1,
          dueAt: '2025-12-31T00:00:00.000Z',
          lastReviewedAt: '2026-01-01T00:00:00.000Z',
        },
        notAnObject: 42,
      }),
    )
    expect(loadReviewStates()).toEqual({ good: valid })
  })

  it('re-keys entries by their own rangeId', () => {
    const value = state({ rangeId: 'real-id' })
    localStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify({ 'stale-key': value }))
    expect(loadReviewStates()).toEqual({ 'real-id': value })
  })
})

describe('saveReviewState', () => {
  it('round-trips a saved state', () => {
    const value = state()
    saveReviewState(value)
    expect(loadReviewStates()).toEqual({ r1: value })
  })

  it('upserts the same range without duplicating', () => {
    saveReviewState(state({ intervalDays: 1 }))
    saveReviewState(state({ intervalDays: 6, dueAt: '2026-01-07T00:00:00.000Z' }))
    const loaded = loadReviewStates()
    expect(Object.keys(loaded)).toEqual(['r1'])
    expect(loaded.r1.intervalDays).toBe(6)
  })

  it('keeps ranges isolated', () => {
    saveReviewState(state({ rangeId: 'a' }))
    saveReviewState(state({ rangeId: 'b', intervalDays: 9 }))
    const loaded = loadReviewStates()
    expect(loaded.a.rangeId).toBe('a')
    expect(loaded.b.intervalDays).toBe(9)
  })

  it('rejects an invalid schedule instead of persisting it', () => {
    expect(() =>
      saveReviewState(
        state({
          dueAt: '2025-12-31T00:00:00.000Z',
          lastReviewedAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ).toThrow(/invalid review state/)
    expect(loadReviewStates()).toEqual({})
  })
})
