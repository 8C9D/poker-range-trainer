import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountScreen } from './AccountScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { loadPracticeStats, recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadSpotAccuracy, recordSpotAccuracy } from '../storage/spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import { buildBackup, serializeBackup } from '../storage/backup'
import { serializeRangeExport, serializeRangePack } from '../domain/rangeTransfer'
import { buildStarterRanges, STARTER_RANGE_TEMPLATES } from '../domain/starterRanges'
import { createRangeId } from '../app/ids'
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
  it('shows the local-only note when cloud is not configured', () => {
    render(<AccountScreen />)
    expect(screen.getByText(/Running local-only/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Push to cloud' })).not.toBeInTheDocument()
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

  it('imports a range JSON as a new range', async () => {
    const user = userEvent.setup()
    const exported = serializeRangeExport(makeRange('src', 'Shared range'))
    render(<AccountScreen />)
    await user.upload(screen.getByLabelText('Import range'), jsonFile('range.json', exported))
    expect(await screen.findByText(/Imported range “Shared range”/)).toBeInTheDocument()
    const saved = loadSavedRanges()
    expect(saved).toHaveLength(1)
    expect(saved[0].id).not.toBe('src')
  })

  it('imports a CSV range using the file name as fallback', async () => {
    const user = userEvent.setup()
    render(<AccountScreen />)
    await user.upload(
      screen.getByLabelText('Import CSV'),
      jsonFile('my-csv-range.csv', 'hand\nAA\nKK\n', 'text/csv'),
    )
    expect(await screen.findByText(/Imported range “my-csv-range” from CSV/)).toBeInTheDocument()
    expect(loadSavedRanges()[0].hands).toEqual(['AA', 'KK'])
  })

  it('imports every range in a pack with fresh ids', async () => {
    const user = userEvent.setup()
    const pack = serializeRangePack('My pack', [
      makeRange('a', 'Pack range A'),
      makeRange('b', 'Pack range B'),
    ])
    render(<AccountScreen />)
    await user.upload(screen.getByLabelText('Import pack'), jsonFile('pack.json', pack))
    expect(await screen.findByText(/Imported 2 ranges from the pack/)).toBeInTheDocument()
    expect(loadSavedRanges()).toHaveLength(2)
  })

  it('rejects an invalid import file with an alert and no changes', async () => {
    const user = userEvent.setup()
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<AccountScreen />)
    await user.upload(
      screen.getByLabelText('Import range'),
      jsonFile('bad.json', '{"nope": true}'),
    )
    expect(alert).toHaveBeenCalled()
    expect(loadSavedRanges()).toHaveLength(0)
  })

  // A readable file the store then refuses (quota exhausted, storage disabled)
  // used to leave the screen silent: no range, no message, nothing to act on.
  it('reports a refused write instead of importing a range in silence', async () => {
    const user = userEvent.setup()
    const exported = serializeRangeExport(makeRange('src', 'Shared range'))
    render(<AccountScreen />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await user.upload(screen.getByLabelText('Import range'), jsonFile('range.json', exported))
    spy.mockRestore()

    expect(await screen.findByText(/storage is full or unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/Imported range/)).not.toBeInTheDocument()
    expect(loadSavedRanges()).toHaveLength(0)
  })

  it('reports a refused write instead of importing a CSV in silence', async () => {
    const user = userEvent.setup()
    render(<AccountScreen />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await user.upload(
      screen.getByLabelText('Import CSV'),
      jsonFile('my-csv-range.csv', 'hand\nAA\nKK\n', 'text/csv'),
    )
    spy.mockRestore()

    expect(await screen.findByText(/storage is full or unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/from CSV/)).not.toBeInTheDocument()
  })

  it('does not claim a whole pack imported when the store refused part of it', async () => {
    const user = userEvent.setup()
    const pack = serializeRangePack('My pack', [
      makeRange('a', 'Pack range A'),
      makeRange('b', 'Pack range B'),
    ])
    render(<AccountScreen />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await user.upload(screen.getByLabelText('Import pack'), jsonFile('pack.json', pack))
    spy.mockRestore()

    expect(await screen.findByText(/storage is full or unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/Imported 2 ranges/)).not.toBeInTheDocument()
    expect(loadSavedRanges()).toHaveLength(0)
  })
})

describe('AccountScreen starter ranges', () => {
  it('adds the whole pack to a library that has other ranges', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('mine', 'My own chart'))
    render(<AccountScreen />)

    await user.click(screen.getByRole('button', { name: 'Add starter ranges' }))

    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length + 1)
    expect(screen.getByRole('status')).toHaveTextContent(
      `Added ${STARTER_RANGE_TEMPLATES.length} starter charts.`,
    )
  })

  it('adds nothing a second time instead of duplicating the pack', async () => {
    const user = userEvent.setup()
    render(<AccountScreen />)

    await user.click(screen.getByRole('button', { name: 'Add starter ranges' }))
    await user.click(screen.getByRole('button', { name: 'Add starter ranges' }))

    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length)
    expect(screen.getByRole('status')).toHaveTextContent(/already in your library/)
  })

  it('tops up only the charts that are missing', async () => {
    const user = userEvent.setup()
    for (const range of buildStarterRanges('2026-01-01T00:00:00.000Z', createRangeId).slice(0, 4)) {
      saveSavedRange(range)
    }
    render(<AccountScreen />)

    await user.click(screen.getByRole('button', { name: 'Add starter ranges' }))

    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length)
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
