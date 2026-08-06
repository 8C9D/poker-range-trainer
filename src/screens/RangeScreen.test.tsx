import { describe, it, expect, beforeEach, afterEach, onTestFinished, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeScreen } from './RangeScreen'
import { findSavedRangeById, loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import { clearDeletedRanges, peekDeletedRanges } from '../storage/rangeRemoval'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
  // The pending undo is module state, so it would otherwise outlive its test.
  clearDeletedRanges()
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

  it('reports a menu action the store refused instead of leaving the item dead', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    try {
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      await user.click(screen.getByRole('menuitem', { name: 'Favorite' }))
    } finally {
      spy.mockRestore()
    }

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    // The chip never appears for a favorite that was not stored.
    expect(screen.queryByText('★ Favorite')).not.toBeInTheDocument()
    expect(findSavedRangeById('r1')?.favorite).toBeUndefined()
  })

  it('stays on the range when a delete cannot be written', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    try {
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    } finally {
      spy.mockRestore()
    }

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    expect(loadSavedRanges()).toHaveLength(1)
    expect(window.location.hash).not.toBe('#/library')
  })

  it('closes the overflow menu on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'More actions' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the overflow menu when clicking outside it', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('heading', { name: 'UTG open' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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

  it('hands the delete to the library so it can be undone there', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const deleted = peekDeletedRanges()
    expect(deleted?.ranges.map((entry) => entry.range.id)).toEqual(['r1'])
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
})

describe('RangeScreen tabs', () => {
  it('renders tab links and marks the active tab', () => {
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    const tabs = screen.getByRole('navigation', { name: 'Range sections' })
    for (const label of ['Overview', 'Edit', 'Stats']) {
      expect(within(tabs).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(tabs).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const gone of ['Actions', 'Combos', 'Frequencies']) {
      expect(within(tabs).queryByRole('link', { name: gone })).not.toBeInTheDocument()
    }
    expect(within(tabs).getByRole('link', { name: 'Stats' })).toHaveAttribute(
      'href',
      '#/library/r1/stats',
    )
  })

  it('scrolls the active tab into view, since the strip scrolls sideways on a phone', () => {
    // jsdom has no layout and no scrollIntoView, so stub it and assert the
    // active tab is the one asked for: without this, landing on a tab past the
    // strip's right edge left it scrolled to the start with nothing marked.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    onTestFinished(() => {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    })

    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="stats" onPractice={vi.fn()} />)

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    const scrolled = scrollIntoView.mock.instances[0] as HTMLElement
    expect(scrolled).toHaveTextContent('Stats')
    expect(scrolled).toHaveAttribute('aria-current', 'page')
    // `nearest` so a tab already on screen stays put and the page never jumps.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
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

  it('counts a one-hand range in the singular', () => {
    saveSavedRange(makeRange({ hands: ['AA'] }))
    render(<RangeScreen id="r1" tab="overview" onPractice={vi.fn()} />)
    expect(screen.getByText(/1 hand · 6 combos/)).toBeInTheDocument()
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

  it('persists scenario metadata through a save', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange())
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Position'), 'btn')
    await user.selectOptions(screen.getByLabelText('Action type'), 'open')
    await user.type(screen.getByLabelText('Stack depth'), '100')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = findSavedRangeById('r1')!
    expect(saved.metadata).toMatchObject({ position: 'btn', actionType: 'open', stackDepthBb: 100 })
    // The header chips reflect the saved metadata.
    expect(screen.getByText('BTN', { selector: '.coach-chip' })).toBeInTheDocument()
    expect(screen.getByText('100bb', { selector: '.coach-chip' })).toBeInTheDocument()
  })

  it('fills the scenario from the range name in one action', async () => {
    const user = userEvent.setup()
    // A range named the way the app itself names ranges, with the dropdowns blank:
    // invisible to the Library filters.
    saveSavedRange(makeRange({ name: 'SB 3-bet vs BTN open (6-max 100bb)', metadata: undefined }))
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)

    expect(screen.getByText('SB · 3-bet · vs BTN · 6-max · 100bb')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Use this' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(findSavedRangeById('r1')?.metadata).toEqual({
      position: 'sb',
      actionType: 'threeBet',
      versusPosition: 'btn',
      tableSize: 'sixMax',
      stackDepthBb: 100,
    })
    // Nothing left for the name to add, so the offer goes.
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
  })

  it('offers only what the scenario fields do not already say', async () => {
    const user = userEvent.setup()
    saveSavedRange(
      makeRange({ name: 'SB 3-bet vs BTN', metadata: { position: 'co' } }),
    )
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)

    // The recorded seat wins over the name's, so only the rest is offered.
    expect(screen.getByText('3-bet · vs BTN')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Use this' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(findSavedRangeById('r1')?.metadata).toMatchObject({
      position: 'co',
      actionType: 'threeBet',
      versusPosition: 'btn',
    })
  })

  it('offers no scenario for a name that describes none', () => {
    saveSavedRange(makeRange({ name: 'My favourite chart', metadata: undefined }))
    render(<RangeScreen id="r1" tab="edit" onPractice={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
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
    expect(window.location.hash).toBe(`#/library/${saved[0].id}`)
  })
})
