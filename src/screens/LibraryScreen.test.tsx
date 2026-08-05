import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from './LibraryScreen'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import { loadPracticeStats, recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadSessionHistory, recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { saveReviewState } from '../storage/reviewStateStorage'
import {
  deleteRangesWithRecords,
  rememberDeletedRanges,
  clearDeletedRanges,
} from '../storage/rangeRemoval'
import { STARTER_RANGE_TEMPLATES } from '../domain/starterRanges'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
  // The pending undo is module state, so it would otherwise outlive its test.
  clearDeletedRanges()
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
    const { unmount } = render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Spot coverage' })).toBeNull()
    unmount()

    saveSavedRange(makeRange('a', 'BTN open', { metadata: { position: 'btn', actionType: 'open' } }))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    const coverage = screen.getByRole('region', { name: 'Spot coverage' })
    expect(within(coverage).getByRole('button', { name: /BTN folded to you: 1 of 1/ })).toBeVisible()
  })

  it('shows the empty state and the New range button', () => {
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Empty library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New range' })).toHaveAttribute(
      'href',
      '#/library/new',
    )
  })

  it('fills an empty library with the starter pack in one action', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    expect(screen.queryByText('Due')).not.toBeInTheDocument()
  })

  it('searches by name', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN defend'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'btn')
    expect(rowNames()).toEqual(['BTN defend'])
  })

  it('searches by two words the name separates, in either order', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN 3-bet vs CO open'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'co btn')
    expect(rowNames()).toEqual(['BTN 3-bet vs CO open'])
  })

  it('searches for the charts that play a hand', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open', { hands: ['AA', 'KK'] }))
    saveSavedRange(makeRange('b', 'BTN open', { hands: ['AA', 'KK', 'A5s'] }))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    // "How do I play A5s?" — the library is the only screen that can answer it.
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'a5s')

    expect(rowNames()).toEqual(['BTN open'])
  })

  it('searches by tag, so the box agrees with the tag filter beside it', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open', { tags: ['MTT'] }))
    saveSavedRange(makeRange('b', 'BTN open', { tags: ['cash'] }))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'mtt')
    expect(rowNames()).toEqual(['UTG open'])
  })

  it('searches the range’s scenario notes', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open', { metadata: { notes: 'Widen vs a nitty BB.' } }))
    saveSavedRange(makeRange('b', 'BTN open'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'nitty')
    expect(rowNames()).toEqual(['UTG open'])
  })

  it('shows a no-match message for a search without hits', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'zzz')
    expect(screen.getByText(/No ranges match “zzz”/)).toBeInTheDocument()
  })

  it('filters by position from the collapsible filter row', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open', { metadata: { position: 'utg' } }))
    saveSavedRange(makeRange('b', 'BTN open', { metadata: { position: 'btn' } }))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'alpha')
    await user.selectOptions(screen.getByLabelText('Sort ranges'), 'name')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Filter ranges by position'), 'btn')
    expect(rowNames()).toEqual(['Alpha'])

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Search ranges by name, tag, notes or a hand')).toHaveValue('')
    expect(screen.getByLabelText('Sort ranges')).toHaveValue('')
    expect(rowNames()).toEqual(['Zebra', 'Alpha'])
  })

  it('hides archived ranges until Show archived is on', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Active range'))
    saveSavedRange(makeRange('b', 'Old range', { archived: true }))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Favorites only' }))
    expect(rowNames()).toEqual(['Starred range'])
  })

  it('sorts by name', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Zebra'))
    saveSavedRange(makeRange('b', 'Alpha'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Sort ranges'), 'accuracy')
    expect(rowNames()).toEqual(['Sharp', 'Rusty', 'Never practiced'])
  })

  it('bulk deletes selected ranges after confirmation', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Delete one'))
    saveSavedRange(makeRange('c', 'Delete two'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete one' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete two' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Keep'])
    expect(rowNames()).toEqual(['Keep'])
  })

  it('frees the deleted ranges\u2019 recorded stats, not just the range records', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Delete one'))
    for (const id of ['a', 'b']) {
      recordPracticeSession(id, { totalQuestions: 10, correctAnswers: 8 })
      recordPracticeSessionHistory(id, { totalQuestions: 10, correctAnswers: 8 })
    }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete one' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    // Left behind, the records outlived the range for good \u2014 so the advice a
    // full store gives ("delete some ranges to free space") did not free any.
    expect(Object.keys(loadPracticeStats())).toEqual(['a'])
    expect(Object.keys(loadSessionHistory())).toEqual(['a'])
  })

  it('undoes a bulk delete, restoring the ranges and their records', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Delete one'))
    saveSavedRange(makeRange('c', 'Keep too'))
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 8 })
    recordPracticeSessionHistory('b', { totalQuestions: 10, correctAnswers: 8 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete one' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(rowNames()).toEqual(['Keep', 'Keep too'])

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    // Back in its old position, with the practice record that went with it.
    expect(rowNames()).toEqual(['Keep', 'Delete one', 'Keep too'])
    expect(Object.keys(loadPracticeStats()).sort()).toEqual(['b'])
    expect(Object.keys(loadSessionHistory()).sort()).toEqual(['b'])
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('names what a delete removed, and drops the offer when dismissed', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Delete one'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Delete one' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(screen.getByText(/“Delete one” deleted/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Dismiss the undo offer' }))

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Keep'])
  })

  it('offers no undo until something is deleted', () => {
    saveSavedRange(makeRange('a', 'Keep'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('offers the undo for a delete made on the range page', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Deleted elsewhere'))
    // What the range page does before it navigates back here.
    rememberDeletedRanges(deleteRangesWithRecords(['b']))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    expect(screen.getByText(/“Deleted elsewhere” deleted/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(rowNames()).toEqual(['Keep', 'Deleted elsewhere'])
  })

  it('bulk archives and unarchives selected ranges', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Archive one'))
    saveSavedRange(makeRange('c', 'Archive two'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

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
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Hide me' }))
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'keep')

    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Favorite selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled()
    expect(loadSavedRanges()).toHaveLength(2)
  })

  it('drills the selected ranges as one queue, in the order they are listed', async () => {
    const user = userEvent.setup()
    const onPracticeSelected = vi.fn()
    saveSavedRange(makeRange('a', 'BTN 3-bet'))
    saveSavedRange(makeRange('b', 'Skip me'))
    saveSavedRange(makeRange('c', 'SB 3-bet'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={onPracticeSelected} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select SB 3-bet' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select BTN 3-bet' }))
    await user.click(screen.getByRole('button', { name: 'Practice selected' }))

    expect(onPracticeSelected).toHaveBeenCalledTimes(1)
    // The queue follows the list, not the order the boxes were ticked.
    expect(onPracticeSelected.mock.calls[0][0].map((range: SavedRange) => range.name)).toEqual([
      'BTN 3-bet',
      'SB 3-bet',
    ])
  })

  it('queues only the selections still on screen after a search narrows the list', async () => {
    const user = userEvent.setup()
    const onPracticeSelected = vi.fn()
    saveSavedRange(makeRange('a', 'Keep'))
    saveSavedRange(makeRange('b', 'Hide me'))
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={onPracticeSelected} />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(screen.getByRole('button', { name: 'Select visible' }))
    await user.type(screen.getByLabelText('Search ranges by name, tag, notes or a hand'), 'keep')
    await user.click(screen.getByRole('button', { name: 'Practice selected' }))

    expect(onPracticeSelected.mock.calls[0][0].map((range: SavedRange) => range.name)).toEqual([
      'Keep',
    ])
  })
})
