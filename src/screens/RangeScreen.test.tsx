import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeScreen } from './RangeScreen'
import { findSavedRangeById, loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRange(extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'UTG open',
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

describe('RangeScreen header and menu', () => {
  it('shows the name, metadata chips, back link, and Practice button', () => {
    saveSavedRange(
      makeRange({ metadata: { position: 'utg', actionType: 'open', stackDepthBb: 100 } }),
    )
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'UTG open' })).toBeInTheDocument()
    expect(screen.getByText('UTG')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('100bb')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Library' })).toHaveAttribute('href', '#/library')
    expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument()
  })

  it('reports a missing range instead of crashing', () => {
    render(<RangeScreen id="ghost" tab="overview" onPractice={vi.fn()} />)
    expect(screen.getByText(/does not exist/)).toBeInTheDocument()
  })

  it('launches practice for the range', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={onPractice} />)
    await user.click(screen.getByRole('button', { name: 'Practice' }))
    expect(onPractice).toHaveBeenCalledTimes(1)
    expect(onPractice.mock.calls[0][0].id).toBe('r1')
  })

  it('toggles favorite and archive from the overflow menu', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Favorite' }))
    expect(findSavedRangeById('r1')?.favorite).toBe(true)
    expect(screen.getByText('★ Favorite')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(findSavedRangeById('r1')?.archived).toBe(true)
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('duplicates the range and navigates to the copy', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    const ranges = loadSavedRanges()
    expect(ranges).toHaveLength(2)
    const copy = ranges.find((r) => r.id !== 'r1')!
    expect(window.location.hash).toBe(`#/library/${copy.id}`)
  })

  it('deletes after confirmation and navigates back to the library', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(loadSavedRanges()).toHaveLength(0)
    expect(window.location.hash).toBe('#/library')
  })

  it('keeps the range when deletion is not confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(loadSavedRanges()).toHaveLength(1)
  })

  it('exports JSON from the menu', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Export JSON' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('hides cloud publishing when signed out', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.queryByRole('menuitem', { name: 'Publish link' })).not.toBeInTheDocument()
  })

  it('opens the comparison panel from the menu', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    saveSavedRange(makeRange({ id: 'r2', name: 'BTN open', hands: ['AA', 'A5s'] }))
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Compare…' }))
    const panel = screen.getByRole('region', { name: 'Range comparison' })
    await user.selectOptions(within(panel).getByLabelText('Compare with'), 'r2')
    // Diff renders once a comparison target is picked.
    expect(within(panel).getByText(/Only UTG open/)).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Close comparison' }))
    expect(screen.queryByRole('region', { name: 'Range comparison' })).not.toBeInTheDocument()
  })
})

describe('RangeScreen tabs', () => {
  it('renders tab links and marks the active tab', () => {
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    const tabs = screen.getByRole('navigation', { name: 'Range sections' })
    for (const label of ['Overview', 'Edit', 'Actions', 'Combos', 'Frequencies', 'Stats']) {
      expect(within(tabs).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(tabs).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(tabs).getByRole('link', { name: 'Stats' })).toHaveAttribute(
      'href',
      '#/library/r1/stats',
    )
  })

  it('shows overview facts and recent sessions', () => {
    saveSavedRange(makeRange())
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 10, correctAnswers: 8 },
      '2026-07-10T10:00:00.000Z',
    )
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    // AA+KK = 12 combos, AKs = 4 -> 16 combos, 1.2%
    expect(screen.getByText(/3 hands · 16 combos · 1\.2% of all hands/)).toBeInTheDocument()
    expect(screen.getByText(/Last session: 80%/)).toBeInTheDocument()
    const sessions = screen.getByRole('region', { name: 'Recent sessions' })
    expect(within(sessions).getByText(/8\/10 · 80%/)).toBeInTheDocument()
  })

  it('edits and saves the range from the Edit tab', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'QQ' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(findSavedRangeById('r1')?.hands).toContain('QQ')
    expect(screen.getByRole('status')).toHaveTextContent('Saved “UTG open”.')
  })

  it('assigns and saves hand actions from the Actions tab', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="actions" onPractice={vi.fn()} />)
    // Pick the "Raise" action from the palette, assign AA, save.
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save actions' }))
    expect(findSavedRangeById('r1')?.handActions?.['AA']).toBe('raise')
  })

  it('saves partial combo selections from the Combos tab', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange({ hands: ['AA'] }))
    render(<RangeScreen id="r1" tab="combos" onPractice={vi.fn()} />)
    // Toggle one of AA's six combos off, then save.
    const toggles = within(screen.getByLabelText('Combos for AA')).getAllByRole('button')
    await user.click(toggles[0])
    await user.click(screen.getByRole('button', { name: 'Save combos' }))
    expect(findSavedRangeById('r1')?.comboSelections?.['AA']).toHaveLength(5)
  })

  it('shows the stats tab with the performance view', () => {
    saveSavedRange(makeRange())
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 2, correct: 1, falsePositives: 0, falseNegatives: 1 },
    ])
    render(<RangeScreen id="r1" tab="stats" onPractice={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Range performance' })).toBeInTheDocument()
  })

  it('starts a weak-hands drill from the stats tab', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    saveSavedRange(makeRange())
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 2, correct: 1, falsePositives: 0, falseNegatives: 1 },
    ])
    render(<RangeScreen id="r1" tab="stats" onPractice={onPractice} />)
    await user.click(screen.getByRole('button', { name: /practice mistakes/i }))
    expect(onPractice).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), ['AA'])
  })
})

describe('RangeScreen editor validation', () => {
  it('disables saving until a name and at least one hand are set', async () => {
    const user = userEvent.setup()
    render(<RangeScreen id={null} tab="edit" onPractice={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save Range' })
    expect(save).toBeDisabled()
    expect(
      screen.getByText('Enter a range name and select at least one hand to save.'),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Range name'), 'My Range')
    expect(save).toBeDisabled()
    expect(screen.getByText('Select at least one hand to save.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'AA' }))
    expect(save).toBeEnabled()
  })

  it('blocks saving on an invalid stack depth with an inline error', async () => {
    const user = userEvent.setup()
    render(<RangeScreen id={null} tab="edit" onPractice={vi.fn()} />)
    await user.type(screen.getByLabelText('Range name'), 'My Range')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.type(screen.getByLabelText('Stack depth'), '-5')
    expect(screen.getByText('Stack depth must be a positive number.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Range' })).toBeDisabled()
  })

  it('persists scenario metadata and source through a save', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Position'), 'btn')
    await user.selectOptions(screen.getByLabelText('Action type'), 'open')
    await user.type(screen.getByLabelText('Stack depth'), '100')
    await user.selectOptions(screen.getByLabelText('Source'), 'solver')
    await user.type(screen.getByLabelText('Reference'), 'GTOWizard 6-max')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = findSavedRangeById('r1')!
    expect(saved.metadata).toMatchObject({ position: 'btn', actionType: 'open', stackDepthBb: 100 })
    expect(saved.source).toEqual({ kind: 'solver', reference: 'GTOWizard 6-max' })
    // The header chips reflect the saved metadata.
    expect(screen.getByText('BTN', { selector: '.coach-chip' })).toBeInTheDocument()
    expect(screen.getByText('100bb', { selector: '.coach-chip' })).toBeInTheDocument()
  })

  it('saves per-hand notes with the range', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    // The hand-notes editor lists the selected hands; note the first hand.
    await user.selectOptions(screen.getByLabelText('Hand'), 'AA')
    await user.type(screen.getByLabelText('Note for AA'), 'never fold')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(findSavedRangeById('r1')?.handNotes?.['AA']).toBe('never fold')
  })
})

describe('RangeScreen new-range mode', () => {
  it('creates a range and navigates to its page on save', async () => {
    const user = userEvent.setup()
    render(<RangeScreen id={null} tab="edit" onPractice={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'New range' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Range name'), 'Fresh range')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    const saved = loadSavedRanges()
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Fresh range')
    expect(window.location.hash).toBe(`#/library/${saved[0].id}/edit`)
  })
})
