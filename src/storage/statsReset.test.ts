import { describe, it, expect, beforeEach } from 'vitest'
import { resetPracticeRecords } from './statsReset'
import { loadActionAccuracy, recordActionAccuracy } from './actionAccuracyStorage'
import { loadHandAccuracy, recordHandAccuracy } from './handAccuracyStorage'
import { loadPracticeStats, recordPracticeSession } from './practiceStatsStorage'
import { loadSavedRanges, saveSavedRange } from './rangeStorage'
import { loadReviewStates, saveReviewState } from './reviewStateStorage'
import { loadSessionHistory, recordPracticeSessionHistory } from './sessionHistoryStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from './spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from './trainingGoalStorage'
import { loadWorkoutCompletion, recordWorkoutCompletion } from './workoutStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

const RANGE: SavedRange = {
  id: 'r1',
  name: 'UTG open',
  hands: ['AA', 'KK'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/** A library with something recorded in every practice store. */
function seedEverything(): void {
  saveSavedRange(RANGE)
  saveTrainingGoal(40)
  recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 })
  recordPracticeSessionHistory('r1', { totalQuestions: 10, correctAnswers: 8 })
  recordHandAccuracy('r1', [
    { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
  ])
  recordActionAccuracy('r1', [{ action: 'raise', attempts: 4, correct: 3 }])
  saveReviewState({
    rangeId: 'r1',
    ease: 2.5,
    intervalDays: 3,
    dueAt: '2026-01-04T00:00:00.000Z',
    lastReviewedAt: '2026-01-01T00:00:00.000Z',
  })
  recordSpotAccuracy([{ spotKey: 'sixMax|bb|facingOpen|co|100', attempts: 10, correct: 3 }])
  recordWorkoutCompletion('2026-01-01T00:00:00.000Z')
}

describe('resetPracticeRecords', () => {
  it('clears every recorded practice statistic', () => {
    seedEverything()
    resetPracticeRecords()

    expect(loadPracticeStats()).toEqual({})
    expect(loadSessionHistory()).toEqual({})
    expect(loadHandAccuracy()).toEqual({})
    expect(loadActionAccuracy()).toEqual({})
    expect(loadReviewStates()).toEqual({})
    // Unlike a range deletion, per-spot accuracy goes too: a reset is about the
    // record, and keeping it would still name weakest spots afterwards.
    expect(loadSpotAccuracy()).toEqual({})
    expect(loadWorkoutCompletion()).toBeNull()
  })

  it('keeps the library and the daily goal', () => {
    seedEverything()
    resetPracticeRecords()

    // The charts are what the user authored; the goal is a setting, and clearing
    // it would quietly switch the daily goal off.
    expect(loadSavedRanges().map((range) => range.id)).toEqual(['r1'])
    expect(loadTrainingGoal()).toBe(40)
  })

  it('is a no-op on a library that has never been practiced', () => {
    saveSavedRange(RANGE)
    expect(() => resetPracticeRecords()).not.toThrow()
    expect(loadSavedRanges()).toHaveLength(1)
    expect(loadPracticeStats()).toEqual({})
  })
})
