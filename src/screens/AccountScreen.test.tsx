import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountScreen } from './AccountScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { loadPracticeStats, recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from '../storage/spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import { buildBackup, serializeBackup } from '../storage/backup'
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

function jsonFile(name: string, text: string, type = 'application/json') {
  return new File([text], name, { type })
}

describe('AccountScreen', () => {
  it('is local-only: notes where the data lives and offers no cloud actions', () => {
    render(<AccountScreen />)
    expect(screen.getByText(/live in this browser/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cloud/i })).not.toBeInTheDocument()
  })

  it('exports a backup download', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Export backup' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Backup downloaded.')).toBeInTheDocument()
  })

  it('imports a backup after confirmation, replacing local data', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSavedRange(makeRange('old', 'Old local range'))
    // Build a backup containing a different library.
    localStorage.clear()
    saveSavedRange(makeRange('new', 'Backup range'))
    const backupJson = serializeBackup(buildBackup())
    localStorage.clear()
    saveSavedRange(makeRange('old', 'Old local range'))

    render(<AccountScreen />)
    await user.upload(
      screen.getByLabelText('Import backup'),
      jsonFile('backup.json', backupJson),
    )
    expect(await screen.findByText(/Backup imported/)).toBeInTheDocument()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Backup range'])
  })

  it('keeps local data when the backup import is not confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveSavedRange(makeRange('old', 'Old local range'))
    render(<AccountScreen />)
    await user.upload(
      screen.getByLabelText('Import backup'),
      jsonFile('backup.json', serializeBackup(buildBackup())),
    )
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Old local range'])
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
