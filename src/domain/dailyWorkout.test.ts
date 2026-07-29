import { describe, expect, it } from 'vitest'
import {
  MAX_REVIEW_RANGES,
  MAX_WEAK_SPOTS,
  MIN_SEGMENT_QUESTIONS,
  buildDailyWorkout,
  summarizeWorkout,
  workoutCompletedToday,
  type DailyWorkoutInput,
  type FreshSpotsSegment,
  type ReviewSegment,
  type WeakSpotsSegment,
} from './dailyWorkout'
import type { RangeReviewState, SpotAccuracyStat } from '../types/practice'
import type { RangeMetadata, SavedRange } from '../types/range'

const NOW = '2026-07-27T12:00:00.000Z'

function makeRange(name: string, metadata: RangeMetadata, archived = false): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
    ...(archived ? { archived: true } : {}),
  }
}

function notDue(rangeId: string): RangeReviewState {
  return { rangeId, ease: 2.5, intervalDays: 1, dueAt: '2027-01-01T00:00:00.000Z', lastReviewedAt: NOW }
}

function stat(spotKey: string, attempts: number, correct: number): SpotAccuracyStat {
  return { spotKey, attempts, correct }
}

const btnOpen = makeRange('BTN open', { position: 'btn', actionType: 'open' })
const bbVsCo = makeRange('BB defend vs CO', {
  position: 'bb',
  actionType: 'defend',
  versusPosition: 'co',
})

function build(overrides: Partial<DailyWorkoutInput>): ReturnType<typeof buildDailyWorkout> {
  return buildDailyWorkout({
    ranges: [],
    reviewStates: {},
    spotAccuracy: {},
    now: NOW,
    goalHands: 0,
    ...overrides,
  })
}

describe('buildDailyWorkout', () => {
  it('returns null when there is nothing to plan', () => {
    expect(build({})).toBeNull()
    // A bare range covers no spot, and with nothing due there is no workout.
    expect(
      build({
        ranges: [makeRange('bare', {})],
        reviewStates: { bare: notDue('bare') },
      }),
    ).toBeNull()
  })

  it('plans review, weak spots, then fresh play, in that order', () => {
    const workout = build({
      ranges: [btnOpen, bbVsCo],
      spotAccuracy: {
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 4),
      },
    })

    expect(workout?.segments.map((segment) => segment.kind)).toEqual([
      'review',
      'weakSpots',
      'freshSpots',
    ])
  })

  it('skips the review segment when nothing is due', () => {
    const workout = build({
      ranges: [btnOpen],
      reviewStates: { 'BTN open': notDue('BTN open') },
    })

    expect(workout?.segments.map((segment) => segment.kind)).toEqual(['freshSpots'])
  })

  it('caps the review queue and says so in the reason', () => {
    const due = Array.from({ length: 5 }, (_, i) => makeRange(`r${i}`, {}))
    const workout = build({ ranges: [...due, btnOpen] })

    const review = workout?.segments[0] as ReviewSegment
    expect(review.ranges).toHaveLength(MAX_REVIEW_RANGES)
    expect(review.reason).toBe(`${MAX_REVIEW_RANGES} of your 6 due ranges.`)
  })

  it('excludes archived ranges from review', () => {
    const workout = build({
      ranges: [makeRange('gone', {}, true), btnOpen],
    })

    const review = workout?.segments[0] as ReviewSegment
    expect(review.ranges.map((range) => range.name)).toEqual(['BTN open'])
  })

  it('only counts a recorded spot as weak below the accuracy bar', () => {
    const workout = build({
      ranges: [btnOpen, bbVsCo],
      reviewStates: {
        'BTN open': notDue('BTN open'),
        'BB defend vs CO': notDue('BB defend vs CO'),
      },
      spotAccuracy: {
        // 90% — a fine spot, not a leak.
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 9),
      },
    })

    expect(workout?.segments.map((segment) => segment.kind)).toEqual(['freshSpots'])
  })

  it('skips weak spots the library no longer covers', () => {
    const workout = build({
      ranges: [btnOpen],
      reviewStates: { 'BTN open': notDue('BTN open') },
      spotAccuracy: {
        // Recorded before the covering range was deleted.
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 2),
      },
    })

    expect(workout?.segments.map((segment) => segment.kind)).toEqual(['freshSpots'])
  })

  it('pins the weak-spot segment to the weakest leak’s format', () => {
    const short = makeRange('20bb jam', { position: 'btn', actionType: 'jam', stackDepthBb: 20 })
    const workout = build({
      ranges: [btnOpen, bbVsCo, short],
      reviewStates: {
        'BTN open': notDue('BTN open'),
        'BB defend vs CO': notDue('BB defend vs CO'),
        '20bb jam': notDue('20bb jam'),
      },
      spotAccuracy: {
        // The weakest leak is at 20bb; the 100bb leak cannot share its drill.
        'sixMax|btn|foldedToYou|-|20': stat('sixMax|btn|foldedToYou|-|20', 10, 1),
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 5),
      },
    })

    const weak = workout?.segments.find(
      (segment): segment is WeakSpotsSegment => segment.kind === 'weakSpots',
    )
    expect(weak?.format).toEqual({ tableSize: 'sixMax', stackDepthBb: 20 })
    expect(weak?.spotKeys).toEqual(['sixMax|btn|foldedToYou|-|20'])
  })

  it('caps the weak-spot list', () => {
    const jam = makeRange('jam', { position: 'btn', actionType: 'jam' })
    const spotKeys = [
      'sixMax|btn|foldedToYou|-|100',
      'sixMax|bb|facingOpen|co|100',
      'sixMax|btn|facingThreeBet|sb|100',
      'sixMax|btn|facingThreeBet|bb|100',
    ]
    const workout = build({
      ranges: [btnOpen, bbVsCo, jam],
      spotAccuracy: Object.fromEntries(spotKeys.map((key) => [key, stat(key, 10, 2)])),
    })

    const weak = workout?.segments.find(
      (segment): segment is WeakSpotsSegment => segment.kind === 'weakSpots',
    )
    expect(weak?.leaks).toHaveLength(MAX_WEAK_SPOTS)
  })

  it('drops fresh play when it would just re-deal the weak spots', () => {
    // The library covers exactly one spot, and that spot is the leak.
    const workout = build({
      ranges: [bbVsCo],
      reviewStates: { 'BB defend vs CO': notDue('BB defend vs CO') },
      spotAccuracy: {
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 2),
      },
    })

    expect(workout?.segments.map((segment) => segment.kind)).toEqual(['weakSpots'])
  })

  it('keeps weak spots out of fresh play at the same format', () => {
    const weakKey = 'sixMax|bb|facingOpen|co|100'
    const workout = build({
      ranges: [btnOpen, bbVsCo],
      reviewStates: {
        'BTN open': notDue('BTN open'),
        'BB defend vs CO': notDue('BB defend vs CO'),
      },
      spotAccuracy: {
        [weakKey]: stat(weakKey, 10, 2),
      },
    })

    const fresh = workout?.segments.find(
      (segment): segment is FreshSpotsSegment => segment.kind === 'freshSpots',
    )
    expect(fresh?.spotKeys).not.toContain(weakKey)
    expect(fresh?.spotKeys).toContain('sixMax|btn|foldedToYou|-|100')
    expect(fresh?.reason).toMatch(/other covered spot/)
  })

  it('splits the goal across the present segments', () => {
    const workout = build({
      ranges: [btnOpen, bbVsCo],
      reviewStates: { 'BB defend vs CO': notDue('BB defend vs CO') },
      spotAccuracy: {
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 4),
      },
      goalHands: 30,
    })

    // Three segments, ten questions each; the one due range takes its whole share.
    const [review, weak, fresh] = workout!.segments
    expect((review as ReviewSegment).questionsPerRange).toBe(10)
    expect((weak as WeakSpotsSegment).questionCount).toBe(10)
    expect(fresh.kind === 'freshSpots' && fresh.questionCount).toBe(10)
    expect(workout?.totalQuestions).toBe(30)
    expect(workout?.estimatedMinutes).toBe(2)
  })

  it('budgets each due range as a drill instead of multiplying the review share', () => {
    const due = [
      makeRange('r1', {}),
      makeRange('r2', {}),
      makeRange('r3', {}),
    ]
    const workout = build({
      ranges: [...due, btnOpen],
      reviewStates: { 'BTN open': notDue('BTN open') },
      goalHands: 20,
    })

    const review = workout?.segments[0] as ReviewSegment
    expect(review.ranges).toHaveLength(3)
    expect(review.questionsPerRange).toBe(5)
    // Three review drills plus one fresh-play drill, five questions each.
    expect(workout?.totalQuestions).toBe(20)
  })

  it('never plans a segment below the question floor', () => {
    const workout = build({
      ranges: [btnOpen, bbVsCo],
      spotAccuracy: {
        'sixMax|bb|facingOpen|co|100': stat('sixMax|bb|facingOpen|co|100', 10, 4),
      },
      goalHands: 10,
    })

    for (const segment of workout!.segments) {
      const questions =
        segment.kind === 'review' ? segment.questionsPerRange : segment.questionCount
      expect(questions).toBeGreaterThanOrEqual(MIN_SEGMENT_QUESTIONS)
    }
  })

  it('uses the default goal size when the goal is off', () => {
    const workout = build({ ranges: [btnOpen] })

    // Two segments (review + fresh) split the default 20 hands.
    expect(workout?.totalQuestions).toBe(20)
  })
})

describe('workoutCompletedToday', () => {
  it('is true only on the same local calendar day', () => {
    const now = new Date(2026, 6, 27, 12).toISOString()
    expect(workoutCompletedToday(new Date(2026, 6, 27, 6).toISOString(), now)).toBe(true)
    expect(workoutCompletedToday(new Date(2026, 6, 26, 23, 59).toISOString(), now)).toBe(false)
    expect(workoutCompletedToday(new Date(2026, 6, 28, 0).toISOString(), now)).toBe(false)
  })

  it('does not mark the workout done across local midnight near a UTC boundary', () => {
    const now = new Date(2026, 6, 28, 0, 30).toISOString()
    const previousEvening = new Date(2026, 6, 27, 23, 30).toISOString()
    const afterMidnight = new Date(2026, 6, 28, 0, 5).toISOString()

    expect(workoutCompletedToday(previousEvening, now)).toBe(false)
    expect(workoutCompletedToday(afterMidnight, now)).toBe(true)
  })

  it('treats a missing or unparseable record as not completed', () => {
    expect(workoutCompletedToday(null, NOW)).toBe(false)
    expect(workoutCompletedToday('not a date', NOW)).toBe(false)
  })
})

describe('summarizeWorkout', () => {
  it('states the exact workload alongside the plan and time estimate', () => {
    const workout = build({ ranges: [btnOpen], goalHands: 20 })

    expect(summarizeWorkout(workout!)).toBe('20 hands · 1 review · free play · ~2 min')
  })
})
