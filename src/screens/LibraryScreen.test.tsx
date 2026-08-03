import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from './LibraryScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { saveReviewState } from '../storage/reviewStateStorage'
import { STARTER_RANGE_TEMPLATES } from '../domain/starterRanges'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

function makeRange(id: string, name: string, extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function rowNames() {
  const list = screen.getByRole('list', { name: 'Saved ranges' })
  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.replace('Open range ', ''))
}

describe('LibraryScreen', () => {
  it('shows spot coverage for a non-empty library, and not for an empty one', () => {
    const { unmount } = render(<LibraryScreen onPlaySpots={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Spot coverage' })).toBeNull()
    unmount()

    saveSavedRange(makeRange('a', 'BTN open', { metadata: { position: 'btn', actionType: 'open' } }))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    const coverage = screen.getByRole('region', { name: 'Spot coverage' })
    expect(within(coverage).getByRole('button', { name: /BTN folded to you: 1 of 1/ })).toBeVisible()
  })

  it('shows the empty state and the New range button', () => {
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Empty library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New range' })).toHaveAttribute(
      'href',
      '#/library/new',
    )
  })

  it('fills an empty library with the starter pack in one action', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add starter ranges' }))

    const saved = loadSavedRanges()
    expect(saved).toHaveLength(STARTER_RANGE_TEMPLATES.length)
    expect(screen.queryByRole('region', { name: 'Empty library' })).toBeNull()
    expect(rowNames()).toContain('BTN open (6-max 100bb)')
    // The pack exists to make the rest of the app usable, so the spot map has to
    // see it immediately.
    expect(screen.getByRole('region', { name: 'Spot coverage' })).toBeVisible()
  })

  it('renders rows with thumbnails, chips, and links to the range page', () => {
    saveSavedRange(
      makeRange('a', 'UTG open', {
        metadata: { position: 'utg', actionType: 'open' },
      }),
    )
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    const row = screen.getByRole('link', { name: 'Open range UTG open' })
    expect(row).toHaveAttribute('href', '#/library/a')
    expect(within(row).getByTestId('range-thumbnail')).toBeInTheDocument()
    expect(within(row).getByText('UTG')).toBeInTheDocument()
    expect(within(row).getByText('Open')).toBeInTheDocument()
    // 3 hands: AA+KK (12) + AKs (4) = 16 combos of 1326 -> 1.2%
    expect(within(row).getByText('1.2%')).toBeInTheDocument()
    // Never reviewed -> due.
    expect(within(row).getByText('Due')).toBeInTheDocument()
    expect(within(row).getByText('Not practiced')).toBeInTheDocument()
  })

  it('announces what the row shows, not just the range name', () => {
    saveSavedRange(
      makeRange('a', 'UTG open', {
        favorite: true,
        tags: ['Starter'],
        metadata: { position: 'utg', actionType: 'open' },
      }),
    )
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 9 }, new Date().toISOString())
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    // A row's own aria-label replaces its contents for a screen reader, so
    // everything the row draws has to be pointed back at explicitly or it is
    // announced to nobody.
    const row = screen.getByRole('link', { name: 'Open range UTG open' })
    const description = row.getAttribute('aria-describedby')
    expect(description).toBeTruthy()
    const spoken = description!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? `MISSING:${id}`)
      .join(' ')

    expect(spoken).toContain('UTG')
    expect(spoken).toContain('Open')
    expect(spoken).toContain('1.2%')
    expect(spoken).toContain('Starter')
    expect(spoken).toContain('90%')
    expect(spoken).not.toContain('MISSING')
    // The star is drawn, so "favorite" has to be said rather than shown.
    expect(within(row).getByRole('img', { name: 'Favorite' })).toBeInTheDocument()
    expect(description).toContain(
      within(row).getByRole('img', { name: 'Favorite' }).getAttribute('id'),
    )
  })

  it('shows accuracy and last practiced once a range has stats', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSession(
      'a',
      { totalQuestions: 10, correctAnswers: 9 },
      new Date().toISOString(),
    )
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    const row = screen.getByRole('link', { name: 'Open range UTG open' })
    expect(within(row).getByText('90%')).toBeInTheDocument()
    expect(within(row).getByText('today')).toBeInTheDocument()
  })

  it('hides the Due chip when the range is scheduled in the future', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveReviewState({
      rangeId: 'a',
      ease: 2.5,
      intervalDays: 7,
      dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      lastReviewedAt: new Date().toISOString(),
    })
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    expect(screen.queryByText('Due')).not.toBeInTheDocument()
  })

  it('searches by name', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN defend'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name'), 'btn')
    expect(rowNames()).toEqual(['BTN defend'])
  })

  it('shows a no-match message for a search without hits', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name'), 'zzz')
    expect(screen.getByText(/No ranges match “zzz”/)).toBeInTheDocument()
  })

  it('filters by position from the collapsible filter row', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open', { metadata: { position: 'utg' } }))
    saveSavedRange(makeRange('b', 'BTN open', { metadata: { position: 'btn' } }))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    // Filters are collapsed by default.
    expect(screen.queryByLabelText('Filter ranges by position')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Filter ranges by position'), 'btn')
    expect(rowNames()).toEqual(['BTN open'])
    // The filter button shows the active count.
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument()
  })

  it('shows tag chips on rows and filters by tag', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'MTT open', { tags: ['MTT'] }))
    saveSavedRange(makeRange('b', 'Cash open', { tags: ['Cash'] }))
    saveSavedRange(makeRange('c', 'No tags'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    // The tag chip renders on its row (before the filter panel is opened).
    expect(screen.getByText('MTT')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Filter ranges by tag'), 'Cash')
    expect(rowNames()).toEqual(['Cash open'])
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument()
  })

  it('offers no tag filter when no range is tagged', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.queryByLabelText('Filter ranges by tag')).not.toBeInTheDocument()
  })

  it('filters by stack depth, action, and game type', async () => {
    const user = userEvent.setup()
    saveSavedRange(
      makeRange('a', 'Cash 100bb open', {
        metadata: { stackDepthBb: 100, actionType: 'open', gameType: 'cash' },
      }),
    )
    saveSavedRange(
      makeRange('b', 'MTT 40bb jam', {
        metadata: { stackDepthBb: 40, actionType: 'jam', gameType: 'tournament' },
      }),
    )
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Filter ranges by stack depth'), '40')
    expect(rowNames()).toEqual(['MTT 40bb jam'])
    await user.selectOptions(screen.getByLabelText('Filter ranges by action type'), 'jam')
    await user.selectOptions(screen.getByLabelText('Filter ranges by game type'), 'tournament')
    expect(rowNames()).toEqual(['MTT 40bb jam'])
  })

  it('clears search, sort, filters, and toggles in one action', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Zebra', { metadata: { position: 'utg' } }))
    saveSavedRange(makeRange('b', 'Alpha', { metadata: { position: 'btn' } }))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.type(screen.getByLabelText('Search ranges by name'), 'alpha')
    await user.selectOptions(screen.getByLabelText('Sort ranges'), 'name')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Filter ranges by position'), 'btn')
    expect(rowNames()).toEqual(['Alpha'])

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Search ranges by name')).toHaveValue('')
    expect(screen.getByLabelText('Sort ranges')).toHaveValue('')
    expect(rowNames()).toEqual(['Zebra', 'Alpha'])
  })

  it('hides archived ranges until Show archived is on', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Active range'))
    saveSavedRange(makeRange('b', 'Old range', { archived: true }))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    expect(rowNames()).toEqual(['Active range'])
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Show archived' }))
    expect(rowNames()).toEqual(['Active range', 'Old range'])
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('narrows to favorites with the Favorites only toggle', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Plain range'))
    saveSavedRange(makeRange('b', 'Starred range', { favorite: true }))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Favorites only' }))
    expect(rowNames()).toEqual(['Starred range'])
  })

  it('sorts by name', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Zebra'))
    saveSavedRange(makeRange('b', 'Alpha'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    expect(rowNames()).toEqual(['Zebra', 'Alpha'])
    await user.selectOptions(screen.getByLabelText('Sort ranges'), 'name')
    expect(rowNames()).toEqual(['Alpha', 'Zebra'])
  })

  it('sorts by accuracy with never-practiced ranges last', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Never practiced'))
    saveSavedRange(makeRange('b', 'Sharp'))
    saveSavedRange(makeRange('c', 'Rusty'))
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 9 })
    recordPracticeSession('c', { totalQuestions: 10, correctAnswers: 4 })
    render(<LibraryScreen onPlaySpots={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Sort ranges'), 'accuracy')
    expect(rowNames()).toEqual(['Sharp', 'Rusty', 'Never practiced'])
  })

  it('bulk deletes selected ranges after confirmation', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Delete one'))
    saveSavedRange(makeRange('c', 'Delete two'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete two' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Keep'])
    expect(rowNames()).toEqual(['Keep'])
  })

  it('bulk archives and unarchives selected ranges', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Archive one'))
    saveSavedRange(makeRange('c', 'Archive two'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Archive one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Archive two' }))
    await user.click(screen.getByRole('button', { name: 'Archive selected' }))

    expect(loadSavedRanges().filter((range) => range.archived).map((range) => range.name)).toEqual([
      'Archive one',
      'Archive two',
    ])
    expect(rowNames()).toEqual(['Keep'])

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Show archived' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Archive one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Archive two' }))
    await user.click(screen.getByRole('button', { name: 'Unarchive selected' }))

    expect(loadSavedRanges().some((range) => range.archived)).toBe(false)
    expect(rowNames()).toEqual(['Keep', 'Archive one', 'Archive two'])
  })

  it('reports a bulk action that could not be saved and keeps the list honest', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Archive one'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Archive one' }))
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      await user.click(screen.getByRole('button', { name: 'Archive selected' }))

      expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
      // The row must not disappear as though it archived: nothing was written.
      expect(rowNames()).toEqual(['Keep', 'Archive one'])
      expect(loadSavedRanges().some((range) => range.archived)).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('bulk favorites and unfavorites selected ranges', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Favorite one'))
    saveSavedRange(makeRange('c', 'Favorite two'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Favorite one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Favorite two' }))
    await user.click(screen.getByRole('button', { name: 'Favorite selected' }))

    expect(loadSavedRanges().filter((range) => range.favorite).map((range) => range.name)).toEqual([
      'Favorite one',
      'Favorite two',
    ])

    await user.click(screen.getByRole('checkbox', { name: 'Select Favorite one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Favorite two' }))
    await user.click(screen.getByRole('button', { name: 'Unfavorite selected' }))

    expect(loadSavedRanges().some((range) => range.favorite)).toBe(false)
  })

  it('toggles selection for every visible range', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'One'))
    saveSavedRange(makeRange('b', 'Two'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('button', { name: 'Select visible' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select One' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Two' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Deselect visible' }))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select One' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Two' })).not.toBeChecked()
  })

  it('drops bulk selections that become hidden by search', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Hide me'))
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Hide me' }))
    await user.type(screen.getByLabelText('Search ranges by name'), 'keep')

    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Favorite selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled()
    expect(loadSavedRanges()).toHaveLength(2)
  })
})
