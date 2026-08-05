import { describe, it, expect } from 'vitest'
import {
  describeFreePractice,
  freePracticeAction,
  suggestFreePractice,
  type FreePracticeInput,
} from './freePractice'
import type { RangeHandAccuracy, RangeReviewState } from '../types/practice'
import type { SavedRange } from '../types/range'

const NOW = '2026-08-04T12:00:00.000Z'
const LATER = '2026-08-09T12:00:00.000Z'
const MUCH_LATER = '2026-08-20T12:00:00.000Z'

function makeRange(id: string, extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name: `Range ${id}`,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function missed(hand: string, attempts = 4, correct = 1): RangeHandAccuracy {
  return { [hand]: { hand, attempts, correct, falsePositives: 0, falseNegatives: attempts - correct } }
}

function reviewState(rangeId: string, dueAt: string): RangeReviewState {
  return { rangeId, ease: 2.5, intervalDays: 5, dueAt, lastReviewedAt: NOW }
}

function suggest(overrides: Partial<FreePracticeInput> = {}) {
  return suggestFreePractice({
    ranges: [],
    handAccuracy: {},
    reviewStates: {},
    now: NOW,
    ...overrides,
  })
}

describe('suggestFreePractice', () => {
  it('offers the weak hands it has actually watched go wrong', () => {
    const suggestion = suggest({
      ranges: [makeRange('a'), makeRange('b')],
      handAccuracy: { a: missed('AA') },
      reviewStates: { a: reviewState('a', LATER), b: reviewState('b', LATER) },
    })

    expect(suggestion).toMatchObject({
      kind: 'weakHands',
      pools: { a: ['AA'] },
      handCount: 1,
    })
    expect(suggestion?.kind === 'weakHands' && suggestion.ranges.map((r) => r.id)).toEqual(['a'])
  })

  it('prefers the weak hands over getting ahead on the schedule', () => {
    expect(
      suggest({
        ranges: [makeRange('a')],
        handAccuracy: { a: missed('AA') },
        reviewStates: { a: reviewState('a', LATER) },
      })?.kind,
    ).toBe('weakHands')
  })

  it('offers the range that comes round soonest when nothing has gone wrong yet', () => {
    const suggestion = suggest({
      ranges: [makeRange('a'), makeRange('b')],
      reviewStates: { a: reviewState('a', MUCH_LATER), b: reviewState('b', LATER) },
    })

    expect(suggestion).toMatchObject({ kind: 'reviewEarly', dueAt: LATER })
    expect(suggestion?.kind === 'reviewEarly' && suggestion.range.id).toBe('b')
  })

  it('never names a record whose range is gone', () => {
    // A deleted range's leaks would name a drill that cannot be run, and would
    // also spend a slot the live leaks need.
    expect(
      suggest({
        ranges: [makeRange('a')],
        handAccuracy: { deleted: missed('AA') },
        reviewStates: { a: reviewState('a', LATER) },
      }),
    ).toMatchObject({ kind: 'reviewEarly' })
  })

  it('ignores archived ranges entirely', () => {
    expect(
      suggest({
        ranges: [makeRange('a', { archived: true })],
        handAccuracy: { a: missed('AA') },
        reviewStates: { a: reviewState('a', LATER) },
      }),
    ).toBeNull()
  })

  it('never offers a range that is already due — that is a review, not a head start', () => {
    expect(
      suggest({
        ranges: [makeRange('a')],
        reviewStates: { a: reviewState('a', '2026-08-01T12:00:00.000Z') },
      }),
    ).toBeNull()
  })

  it('offers nothing for an empty library, or one with no schedule yet', () => {
    expect(suggest()).toBeNull()
    expect(suggest({ ranges: [makeRange('a')] })).toBeNull()
  })

  it('skips an unparseable due date rather than ranking it first', () => {
    expect(
      suggest({
        ranges: [makeRange('a'), makeRange('b')],
        reviewStates: { a: reviewState('a', 'not a date'), b: reviewState('b', LATER) },
      }),
    ).toMatchObject({ kind: 'reviewEarly', dueAt: LATER })
  })

  it('caps the weak-hand drill at the requested size', () => {
    const handAccuracy = {
      a: { ...missed('AA'), ...missed('KK'), ...missed('QQ') },
    }

    const suggestion = suggest({ ranges: [makeRange('a')], handAccuracy, limit: 2 })

    expect(suggestion?.kind === 'weakHands' && suggestion.handCount).toBe(2)
  })
})

describe('describeFreePractice', () => {
  it('says what a weak-hand drill would cover', () => {
    const suggestion = suggest({
      ranges: [makeRange('a'), makeRange('b')],
      handAccuracy: { a: missed('AA'), b: missed('KK') },
    })!

    expect(describeFreePractice(suggestion)).toBe(
      'Sharpen the 2 hands you play worst, across 2 charts.',
    )
    expect(freePracticeAction(suggestion)).toBe('Drill weak hands')
  })

  it('names the range a head start would cover', () => {
    const suggestion = suggest({
      ranges: [makeRange('a', { name: 'UTG open' })],
      reviewStates: { a: reviewState('a', LATER) },
    })!

    expect(describeFreePractice(suggestion)).toBe('Get ahead: UTG open comes round next.')
    expect(freePracticeAction(suggestion)).toBe('Review early')
  })

  it('counts a single hand and chart in the singular', () => {
    const suggestion = suggest({
      ranges: [makeRange('a')],
      handAccuracy: { a: missed('AA') },
    })!

    expect(describeFreePractice(suggestion)).toBe(
      'Sharpen the 1 hand you play worst, across 1 chart.',
    )
  })
})
