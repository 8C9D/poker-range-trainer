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
import { STORAGE_KEY } from './rangeStorage'
import { TRAINING_GOAL_STORAGE_KEY } from './trainingGoalStorage'
import type { SavedRange } from '../types/range'

/**
 * Every storage module, so the coverage guard below sees a new one the moment
 * it exists. The twin of the discovery in backup.test.ts (kept inline so each
 * guard stays self-contained); see CLAUDE.md "Storage versioning" for the rule
 * both enforce.
 */
const STORAGE_MODULES = import.meta.glob<Record<string, unknown>>(['./*.ts', '!./*.test.ts'], {
  eager: true,
})

/** Every versioned localStorage key the app persists, by the module that owns it. */
function everyStorageKey(): Map<string, string> {
  const keys = new Map<string, string>()
  for (const [path, module] of Object.entries(STORAGE_MODULES)) {
    for (const [name, value] of Object.entries(module)) {
      if (!/STORAGE_KEY$/.test(name)) continue
      if (typeof value !== 'string' || !value.startsWith('poker-range-trainer.')) continue
      keys.set(value, path)
    }
  }
  return keys
}

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

/**
 * The reset list is one of the hand-maintained storage-key lists that can
 * silently drift when a key is added (review/findings.md S2's bug class): a
 * new recorded store left off `RECORDED_PRACTICE_STORES` would survive "Reset
 * practice stats" and keep reporting records the user asked to clear. So the
 * keys are discovered rather than trusted, and every one must either be
 * cleared by a reset or be named here with the reason it is kept.
 */
describe('reset coverage', () => {
  /** Keys a reset deliberately keeps, each with why it is not a practice record. */
  const KEPT = new Map([
    [STORAGE_KEY, 'the ranges themselves - what the user authored, not a record'],
    [TRAINING_GOAL_STORAGE_KEY, 'a chosen setting - clearing it would switch the goal off'],
  ])

  it('clears every persisted storage key, or names it as kept', () => {
    const owned = everyStorageKey()
    // Guards the guard: a glob that resolved nothing would exempt everything.
    expect(owned.size).toBeGreaterThanOrEqual(9)

    // Write something under every key, reset, and see what survived. Raw
    // writes rather than each module's recorder, so a key is exercised even
    // when its writer validates or scopes (and the value does not matter:
    // reset removes keys, it does not parse them).
    for (const [key] of owned) localStorage.setItem(key, '"seeded"')
    resetPracticeRecords()

    const survived = [...owned]
      .filter(([key]) => localStorage.getItem(key) !== null && !KEPT.has(key))
      .map(([key, path]) => `${key} (${path}) survived a practice-record reset unnamed`)
    expect(survived).toEqual([])

    // And the kept list has to still be real keys, so a renamed one cannot sit
    // here quietly exempting nothing.
    expect([...KEPT.keys()].filter((key) => !owned.has(key))).toEqual([])
  })
})

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
