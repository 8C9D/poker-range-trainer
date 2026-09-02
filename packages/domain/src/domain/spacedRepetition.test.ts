import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EASE,
  MIN_EASE,
  FIRST_INTERVAL_DAYS,
  seedReviewState,
  scheduleNextReview,
  isReviewDue,
  selectDueRanges,
  currentStreak,
} from './spacedRepetition'
import type { RangeReviewState } from '../types/practice'
import type { SavedRange } from '../types/range'

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

/**
 * Dueness is a question about days, not about hours: an interval of 1 means
 * "tomorrow". The timestamps below are built from local wall-clock time (the
 * `calendarDay` suite's convention) so these cases assert the same thing in
 * whatever zone the suite runs in.
 */
function localIso(year: number, month: number, day: number, hour = 0): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

describe('isReviewDue', () => {
  const state: RangeReviewState = {
    rangeId: 'r1',
    ease: DEFAULT_EASE,
    intervalDays: 1,
    // Scheduled by an evening session, so dueAt carries that evening's hour.
    dueAt: localIso(2026, 6, 16, 21),
    lastReviewedAt: localIso(2026, 6, 15, 21),
  }

  it('is true once the due day has started', () => {
    expect(isReviewDue(state, localIso(2026, 6, 16, 0))).toBe(true)
    expect(isReviewDue(state, localIso(2026, 6, 16, 21))).toBe(true)
    expect(isReviewDue(state, localIso(2026, 6, 17, 9))).toBe(true)
  })

  it('offers a range scheduled last evening to this morning’s session', () => {
    // Held to the instant, an evening review pushed the next one past the next
    // morning, and every evening session pushed the hour later still.
    expect(isReviewDue(state, localIso(2026, 6, 16, 9))).toBe(true)
  })

  it('is false on the days before the due day', () => {
    expect(isReviewDue(state, localIso(2026, 6, 15, 23))).toBe(false)
    expect(isReviewDue(state, localIso(2026, 6, 14, 9))).toBe(false)
  })

  it('is false for a never-scheduled seed state', () => {
    expect(isReviewDue(seedReviewState('r1'), '2030-01-01T00:00:00.000Z')).toBe(false)
  })

  it('is false when either timestamp is unreadable', () => {
    expect(isReviewDue({ ...state, dueAt: 'not a date' }, localIso(2026, 6, 20))).toBe(false)
    expect(isReviewDue(state, 'not a date')).toBe(false)
  })
})

describe('an evening review and the next morning', () => {
  it('offers a range the schedule promised for tomorrow', () => {
    const evening = scheduleNextReview(seedReviewState('r1'), 30, localIso(2026, 6, 15, 21))

    expect(evening.intervalDays).toBe(1)
    expect(isReviewDue(evening, localIso(2026, 6, 16, 9))).toBe(true)
    expect(isReviewDue(evening, localIso(2026, 6, 15, 23))).toBe(false)
  })
})

describe('selectDueRanges', () => {
  const NOW = '2026-01-10T00:00:00.000Z'

  function range(id: string): SavedRange {
    return { id, name: id, hands: ['AA'], createdAt: NOW, updatedAt: NOW }
  }

  function reviewState(rangeId: string, dueAt: string): RangeReviewState {
    return { rangeId, ease: DEFAULT_EASE, intervalDays: 1, dueAt, lastReviewedAt: NOW }
  }

  it('returns an empty array when there are no ranges', () => {
    expect(selectDueRanges([], {}, NOW)).toEqual([])
  })

  it('counts a never-reviewed range (no state) as due', () => {
    expect(selectDueRanges([range('fresh')], {}, NOW).map((r) => r.id)).toEqual(['fresh'])
  })

  it('includes due ranges, excludes not-yet-due ones, and preserves order', () => {
    const states = {
      due: reviewState('due', '2026-01-05T00:00:00.000Z'), // past due
      future: reviewState('future', '2026-01-20T00:00:00.000Z'), // not due yet
    }
    const result = selectDueRanges([range('due'), range('future'), range('fresh')], states, NOW)
    expect(result.map((r) => r.id)).toEqual(['due', 'fresh'])
  })
})

describe('currentStreak', () => {
  // The streak buckets by LOCAL day, so these have to be local wall-clock times.
  // Written as UTC literals they described a different set of days once the zone
  // was far enough from UTC — an 08:00Z review is the previous evening in
  // Hawaii — and the block failed there while passing everywhere the suite
  // usually runs.
  const TODAY = localIso(2026, 6, 6, 12)
  const day = (date: number, hour = 8) => localIso(2026, 6, date, hour)

  it('is 0 for no reviews', () => {
    expect(currentStreak([], TODAY)).toBe(0)
  })

  it('counts a review today as a streak of 1', () => {
    expect(currentStreak([day(6)], TODAY)).toBe(1)
  })

  it('counts consecutive days through today', () => {
    expect(currentStreak([day(6), day(5), day(4)], TODAY)).toBe(3)
  })

  it('counts multiple sessions on the same day once', () => {
    expect(currentStreak([day(6, 8), day(6, 20), day(5)], TODAY)).toBe(2)
  })

  it('breaks the streak at a gap', () => {
    // today (06) and 2-days-ago (04), missing yesterday (05).
    expect(currentStreak([day(6), day(4)], TODAY)).toBe(1)
  })

  it('gives a one-day grace when only yesterday is active', () => {
    expect(currentStreak([day(5)], TODAY)).toBe(1)
  })

  it('is 0 when the latest review is older than yesterday', () => {
    expect(currentStreak([day(4)], TODAY)).toBe(0)
  })

  it('starts a new local day at local midnight, not at UTC midnight', () => {
    const today = new Date(2026, 5, 6, 0, 30).toISOString()
    const previousEvening = new Date(2026, 5, 5, 23, 30).toISOString()
    const twoDaysAgo = new Date(2026, 5, 4, 12).toISOString()

    expect(currentStreak([previousEvening, twoDaysAgo], today)).toBe(2)
  })
})

describe('scheduleNextReview confidence weighting', () => {
  const strong: RangeReviewState = {
    rangeId: 'r1',
    ease: 2.5,
    intervalDays: 10,
    dueAt: '',
    lastReviewedAt: '',
  }

  it('leaves the schedule untouched at full confidence', () => {
    const next = scheduleNextReview(strong, 90, '2026-01-01T00:00:00.000Z', 1)
    expect(next.intervalDays).toBe(25)
    expect(scheduleNextReview(strong, 90, '2026-01-01T00:00:00.000Z').intervalDays).toBe(25)
  })

  it('pulls the next review closer when the per-hand record is shaky', () => {
    const next = scheduleNextReview(strong, 90, '2026-01-01T00:00:00.000Z', 0.6)
    expect(next.intervalDays).toBe(15)
    expect(next.dueAt).toBe('2026-01-16T00:00:00.000Z')
  })

  it('never shrinks the interval past half, or below a day', () => {
    expect(scheduleNextReview(strong, 90, '2026-01-01T00:00:00.000Z', 0).intervalDays).toBe(13)
    expect(scheduleNextReview(strong, 30, '2026-01-01T00:00:00.000Z', 0).intervalDays).toBe(1)
  })

  it('ignores a non-finite confidence rather than corrupting the schedule', () => {
    expect(scheduleNextReview(strong, 90, '2026-01-01T00:00:00.000Z', NaN).intervalDays).toBe(25)
  })
})
