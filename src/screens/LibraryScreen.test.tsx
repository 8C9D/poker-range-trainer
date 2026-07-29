import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from './LibraryScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { saveReviewState } from '../storage/reviewStateStorage'
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
})
