import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountScreen } from './AccountScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { loadPracticeStats, recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from '../storage/spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

describe('AccountScreen', () => {
  it('is local-only: notes where the data lives and offers no cloud actions', () => {
    render(<AccountScreen />)
    expect(screen.getByText(/live in this browser/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cloud/i })).not.toBeInTheDocument()
  })
})

describe('AccountScreen reset practice stats', () => {
  /** A practiced library: a chart plus a record in one of the practice stores. */
  function seedPracticed(): void {
    saveSavedRange(makeRange('r1', 'UTG open'))
    saveTrainingGoal(40)
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 })
    recordSpotAccuracy([{ spotKey: 'sixMax|bb|facingOpen|co|100', attempts: 10, correct: 3 }])
  }

  it('clears the records but keeps the charts and the goal', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    seedPracticed()
    render(<AccountScreen />)

    await user.click(screen.getByRole('button', { name: 'Reset practice stats' }))

    expect(loadPracticeStats()).toEqual({})
    expect(loadSpotAccuracy()).toEqual({})
    // Clearing site data is the only other clean slate, and it takes these with it.
    expect(loadSavedRanges()).toHaveLength(1)
    expect(loadTrainingGoal()).toBe(40)
    expect(screen.getByRole('status')).toHaveTextContent(/your ranges are untouched/)
  })

  it('keeps everything when the reset is not confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    seedPracticed()
    render(<AccountScreen />)

    await user.click(screen.getByRole('button', { name: 'Reset practice stats' }))

    expect(loadPracticeStats()['r1'].totalAttempts).toBe(10)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
