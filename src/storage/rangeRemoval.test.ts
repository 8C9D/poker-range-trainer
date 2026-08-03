import { describe, it, expect, beforeEach } from 'vitest'
import { deleteRangesWithRecords } from './rangeRemoval'
import { loadActionAccuracy, recordActionAccuracy } from './actionAccuracyStorage'
import { loadHandAccuracy, recordHandAccuracy } from './handAccuracyStorage'
import { loadPracticeStats, recordPracticeSession } from './practiceStatsStorage'
import { loadSavedRanges, saveSavedRange } from './rangeStorage'
import { loadReviewStates, saveReviewState } from './reviewStateStorage'
import { loadSessionHistory, recordPracticeSessionHistory } from './sessionHistoryStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from './spotAccuracyStorage'
import { seedReviewState } from '../domain/spacedRepetition'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

function makeRange(id: string, name: string): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Give `id` a record in every range-keyed store. */
function seedEverything(id: string) {
  saveSavedRange(makeRange(id, `Range ${id}`))
  recordPracticeSession(id, { totalQuestions: 10, correctAnswers: 8 })
  recordPracticeSessionHistory(id, { totalQuestions: 10, correctAnswers: 8 })
  recordHandAccuracy(id, [
    { hand: 'AA', attempts: 2, correct: 1, falsePositives: 0, falseNegatives: 1 },
  ])
  recordActionAccuracy(id, [{ action: 'raise', attempts: 2, correct: 1 }])
  saveReviewState(seedReviewState(id))
}

function storedIds() {
  return {
    ranges: loadSavedRanges().map((range) => range.id),
    stats: Object.keys(loadPracticeStats()),
    history: Object.keys(loadSessionHistory()),
    hands: Object.keys(loadHandAccuracy()),
    actions: Object.keys(loadActionAccuracy()),
    reviews: Object.keys(loadReviewStates()),
  }
}

describe('deleteRangesWithRecords', () => {
  it('removes the range and everything recorded about it', () => {
    seedEverything('gone')

    deleteRangesWithRecords(['gone'])

    expect(storedIds()).toEqual({
      ranges: [],
      stats: [],
      history: [],
      hands: [],
      actions: [],
      reviews: [],
    })
  })

  it('leaves every other range untouched', () => {
    seedEverything('gone')
    seedEverything('kept')

    deleteRangesWithRecords(['gone'])

    expect(storedIds()).toEqual({
      ranges: ['kept'],
      stats: ['kept'],
      history: ['kept'],
      hands: ['kept'],
      actions: ['kept'],
      reviews: ['kept'],
    })
  })

  it('removes several ranges at once', () => {
    seedEverything('a')
    seedEverything('b')
    seedEverything('c')

    deleteRangesWithRecords(['a', 'c'])

    expect(storedIds().ranges).toEqual(['b'])
    expect(storedIds().history).toEqual(['b'])
  })

  it('keeps per-spot accuracy, which another range may still answer', () => {
    seedEverything('gone')
    recordSpotAccuracy([
      { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 4, correct: 3 },
    ])

    deleteRangesWithRecords(['gone'])

    expect(Object.keys(loadSpotAccuracy())).toEqual(['sixMax|btn|foldedToYou|-|100'])
  })

  it('does nothing for an empty id list', () => {
    seedEverything('kept')

    deleteRangesWithRecords([])

    expect(storedIds().ranges).toEqual(['kept'])
    expect(storedIds().history).toEqual(['kept'])
  })

  it('is a no-op on stores that hold nothing for the deleted range', () => {
    saveSavedRange(makeRange('bare', 'Never practiced'))

    expect(() => deleteRangesWithRecords(['bare'])).not.toThrow()
    expect(loadSavedRanges()).toHaveLength(0)
  })
})
