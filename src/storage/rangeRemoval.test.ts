import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearDeletedRanges,
  deleteRangesWithRecords,
  describeDeletedRanges,
  peekDeletedRanges,
  rememberDeletedRanges,
  restoreDeletedRanges,
} from './rangeRemoval'
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

  it('hands back what it removed', () => {
    seedEverything('gone')
    seedEverything('kept')

    const deleted = deleteRangesWithRecords(['gone'])

    expect(deleted.ranges.map((entry) => entry.range.id)).toEqual(['gone'])
    expect(Object.keys(deleted.records)).toHaveLength(5)
    for (const entries of Object.values(deleted.records)) {
      expect(Object.keys(entries)).toEqual(['gone'])
    }
  })

  it('hands back an empty snapshot for an empty id list', () => {
    seedEverything('kept')

    expect(deleteRangesWithRecords([])).toEqual({ ranges: [], records: {} })
  })
})

describe('restoreDeletedRanges', () => {
  it('puts the range and every record back', () => {
    seedEverything('gone')
    const before = storedIds()

    restoreDeletedRanges(deleteRangesWithRecords(['gone']))

    expect(storedIds()).toEqual(before)
    expect(loadPracticeStats().gone).toMatchObject({ totalAttempts: 10, correctAttempts: 8 })
    expect(loadHandAccuracy().gone.AA).toMatchObject({ attempts: 2, correct: 1 })
    expect(loadReviewStates().gone).toBeDefined()
  })

  it('restores each range to the position it was deleted from', () => {
    seedEverything('a')
    seedEverything('b')
    seedEverything('c')

    restoreDeletedRanges(deleteRangesWithRecords(['a', 'b']))

    expect(loadSavedRanges().map((range) => range.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps practice recorded on other ranges since the delete', () => {
    seedEverything('gone')
    const deleted = deleteRangesWithRecords(['gone'])
    seedEverything('later')

    restoreDeletedRanges(deleted)

    expect(storedIds().ranges.sort()).toEqual(['gone', 'later'])
    expect(Object.keys(loadPracticeStats()).sort()).toEqual(['gone', 'later'])
    expect(loadSessionHistory().later).toHaveLength(1)
  })

  it('does nothing for a snapshot that deleted nothing', () => {
    seedEverything('kept')

    restoreDeletedRanges({ ranges: [], records: {} })

    expect(storedIds().ranges).toEqual(['kept'])
  })
})

describe('the pending undo handoff', () => {
  beforeEach(() => {
    clearDeletedRanges()
  })

  it('hands the delete over, and only until it is cleared', () => {
    seedEverything('gone')
    const deleted = deleteRangesWithRecords(['gone'])

    rememberDeletedRanges(deleted)

    // A peek is pure, so it can run in a render; only clearing consumes it.
    expect(peekDeletedRanges()).toBe(deleted)
    expect(peekDeletedRanges()).toBe(deleted)
    clearDeletedRanges()
    expect(peekDeletedRanges()).toBeNull()
  })

  it('keeps only the most recent delete', () => {
    seedEverything('first')
    seedEverything('second')
    rememberDeletedRanges(deleteRangesWithRecords(['first']))
    const latest = deleteRangesWithRecords(['second'])

    rememberDeletedRanges(latest)

    expect(peekDeletedRanges()).toBe(latest)
  })

  it('never offers an undo for a delete that removed nothing', () => {
    rememberDeletedRanges({ ranges: [], records: {} })

    expect(peekDeletedRanges()).toBeNull()
  })
})

describe('describeDeletedRanges', () => {
  it('names a single deleted range', () => {
    seedEverything('gone')

    expect(describeDeletedRanges(deleteRangesWithRecords(['gone']))).toBe('“Range gone”')
  })

  it('falls back to Untitled for an unnamed range', () => {
    saveSavedRange({ ...makeRange('gone', ''), name: '' })

    expect(describeDeletedRanges(deleteRangesWithRecords(['gone']))).toBe('“Untitled”')
  })

  it('counts several deleted ranges', () => {
    seedEverything('a')
    seedEverything('b')

    expect(describeDeletedRanges(deleteRangesWithRecords(['a', 'b']))).toBe('2 ranges')
  })
})
