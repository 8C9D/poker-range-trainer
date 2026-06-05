import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeLibrary } from './RangeLibrary'
import type { SavedRange } from '../types/range'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test Range',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('RangeLibrary', () => {
  it('shows an empty message when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText(/no saved ranges/i)).toBeInTheDocument()
  })

  it('shows the cloud "Publish link" action only when publishing is available', async () => {
    const onPublishRange = vi.fn()
    const { rerender } = render(
      <RangeLibrary
        ranges={[makeRange()]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        onPublishRange={onPublishRange}
        canPublishToCloud={false}
      />,
    )
    expect(screen.queryByLabelText(/Publish range .* as a cloud link/i)).not.toBeInTheDocument()

    rerender(
      <RangeLibrary
        ranges={[makeRange()]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        onPublishRange={onPublishRange}
        canPublishToCloud
      />,
    )
    const button = screen.getByLabelText(/Publish range .* as a cloud link/i)
    await userEvent.click(button)
    expect(onPublishRange).toHaveBeenCalledTimes(1)
  })

  it('shows "Unpublish link" only for ranges published this session', async () => {
    const onUnpublishRange = vi.fn()
    const props = {
      ranges: [makeRange({ id: 'r1' })],
      activeId: null,
      onLoad: vi.fn(),
      onDelete: vi.fn(),
      onPractice: vi.fn(),
      onDuplicate: vi.fn(),
      onArchive: vi.fn(),
      onFavorite: vi.fn(),
      onViewPerformance: vi.fn(),
      onEditActions: vi.fn(),
      onUnpublishRange,
      canPublishToCloud: true,
    }
    const { rerender } = render(<RangeLibrary {...props} publishedRangeIds={{}} />)
    expect(screen.queryByLabelText(/Unpublish shared link/i)).not.toBeInTheDocument()

    rerender(<RangeLibrary {...props} publishedRangeIds={{ r1: 'share-1' }} />)
    await userEvent.click(screen.getByLabelText(/Unpublish shared link/i))
    expect(onUnpublishRange).toHaveBeenCalledTimes(1)
  })

  it('renders each range with its name and derived summary stats', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Pairs', hands: ['AA', 'KK'] })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText('Pairs')).toBeInTheDocument()
    // 2 hands, 12 combos, 12/1326 -> 0.9%
    expect(screen.getByText(/2 hands.*12 combos.*0\.9%/)).toBeInTheDocument()
  })

  it('calls onLoad with the range when Load is clicked', async () => {
    const user = userEvent.setup()
    const onLoad = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={onLoad}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Load range Pairs' }))

    expect(onLoad).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('calls onViewPerformance with the range when Stats is clicked', async () => {
    const user = userEvent.setup()
    const onViewPerformance = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={onViewPerformance}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View stats for Pairs' }))

    expect(onViewPerformance).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('calls onEditActions with the range when Actions is clicked', async () => {
    const user = userEvent.setup()
    const onEditActions = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={onEditActions}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))

    expect(onEditActions).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('calls onExportRange with the range when Export JSON is clicked', async () => {
    const user = userEvent.setup()
    const onExportRange = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        onExportRange={onExportRange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Export range Pairs to JSON' }))

    expect(onExportRange).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('calls onDelete with the range id when Delete is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <RangeLibrary
        ranges={[makeRange({ id: 'r1', name: 'Pairs' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={onDelete}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete range Pairs' }))

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('r1')
  })

  it('exposes a Practice action that calls onPractice with the range', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={onPractice}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    expect(onPractice).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('exposes a Duplicate action that calls onDuplicate with the range', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={onDuplicate}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Duplicate range Pairs' }))

    expect(onDuplicate).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('exposes an Archive action that calls onArchive with the range', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={onArchive}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Archive range Pairs' }))

    expect(onArchive).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('shows no Archived badge and an Archive button for an active range', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Pairs' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    expect(screen.queryByText('Archived')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive range Pairs' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Unarchive range Pairs' }),
    ).not.toBeInTheDocument()
  })

  it('shows an Archived badge and an Unarchive action for an archived range', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()
    const range = makeRange({ name: 'Pairs', archived: true })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={onArchive}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Archived ranges are hidden by default; reveal them before asserting.
    await user.click(screen.getByRole('checkbox', { name: /show archived/i }))

    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Archive range Pairs' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unarchive range Pairs' }))

    expect(onArchive).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('hides archived ranges by default while listing active ones', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Active range' }),
          makeRange({ id: 'r2', name: 'Archived range', archived: true }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    expect(screen.getByText('Active range')).toBeInTheDocument()
    expect(screen.queryByText('Archived range')).not.toBeInTheDocument()
  })

  it('reveals archived ranges, with badge and Unarchive action, when Show archived is on', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Active range' }),
          makeRange({ id: 'r2', name: 'Archived range', archived: true }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /show archived/i }))

    // The active range stays listed; the archived range now appears with its
    // badge and Unarchive action.
    expect(screen.getByText('Active range')).toBeInTheDocument()
    expect(screen.getByText('Archived range')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Unarchive range Archived range' }),
    ).toBeInTheDocument()
  })

  it('shows the no-match empty state when every range is archived and Show archived is off', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Archived one', archived: true }),
          makeRange({ id: 'r2', name: 'Archived two', archived: true }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    expect(screen.queryByText('Archived one')).not.toBeInTheDocument()
    expect(screen.queryByText('Archived two')).not.toBeInTheDocument()
    expect(screen.getByText('No ranges match the selected filters.')).toBeInTheDocument()
  })

  it('exposes a Favorite action that calls onFavorite with the range', async () => {
    const user = userEvent.setup()
    const onFavorite = vi.fn()
    const range = makeRange({ name: 'Pairs' })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={onFavorite}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Favorite range Pairs' }))

    expect(onFavorite).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('shows no Favorite badge and a Favorite button for a non-favorited range', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Pairs' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // The button text is also "Favorite", so scope the badge check to the badge span.
    expect(
      screen.queryByText('Favorite', { selector: '.range-item-badge' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Favorite range Pairs' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Unfavorite range Pairs' }),
    ).not.toBeInTheDocument()
  })

  it('shows a Favorite badge and an Unfavorite action for a favorited range', async () => {
    const user = userEvent.setup()
    const onFavorite = vi.fn()
    const range = makeRange({ name: 'Pairs', favorite: true })
    render(
      <RangeLibrary
        ranges={[range]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={onFavorite}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    expect(screen.getByText('Favorite', { selector: '.range-item-badge' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Favorite range Pairs' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unfavorite range Pairs' }))

    expect(onFavorite).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('lists both favorited and non-favorited ranges by default', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Favorited range', favorite: true }),
          makeRange({ id: 'r2', name: 'Plain range' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    expect(screen.getByText('Favorited range')).toBeInTheDocument()
    expect(screen.getByText('Plain range')).toBeInTheDocument()
  })

  it('narrows to favorited ranges only when Favorites only is on, and restores when off', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Favorited range', favorite: true }),
          makeRange({ id: 'r2', name: 'Plain range' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('checkbox', { name: /favorites only/i })
    await user.click(toggle)

    // Only the favorited range remains; the non-favorited one drops out.
    expect(screen.getByText('Favorited range')).toBeInTheDocument()
    expect(screen.queryByText('Plain range')).not.toBeInTheDocument()

    // Toggling it back off restores the full list.
    await user.click(toggle)
    expect(screen.getByText('Favorited range')).toBeInTheDocument()
    expect(screen.getByText('Plain range')).toBeInTheDocument()
  })

  it('shows the no-match empty state when every range is non-favorited and Favorites only is on', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Plain one' }),
          makeRange({ id: 'r2', name: 'Plain two' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /favorites only/i }))

    expect(screen.queryByText('Plain one')).not.toBeInTheDocument()
    expect(screen.queryByText('Plain two')).not.toBeInTheDocument()
    expect(screen.getByText('No ranges match the selected filters.')).toBeInTheDocument()
  })

  it('marks the active range as current', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Active One' }),
          makeRange({ id: 'r2', name: 'Other' }),
        ]}
        activeId="r1"
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText('Active One').closest('li')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Other').closest('li')).not.toHaveAttribute('aria-current')
  })

  it('shows position, action type, and notes when metadata is present', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({
            metadata: { position: 'btn', actionType: 'open', notes: 'Standard button open' },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText('BTN · Open')).toBeInTheDocument()
    expect(screen.getByText('Standard button open')).toBeInTheDocument()
  })

  it('shows game type, table size, stack depth, and versus position as one scenario line', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({
            metadata: {
              gameType: 'cash',
              tableSize: 'sixMax',
              stackDepthBb: 100,
              position: 'btn',
              versusPosition: 'co',
              actionType: 'open',
            },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText('Cash · 6-max · 100bb · BTN vs CO · Open')).toBeInTheDocument()
  })

  it('formats stack depth with a bb suffix', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ metadata: { stackDepthBb: 40 } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    // Scope to the scenario span so the matching "40bb" option in the
    // stack-depth filter select does not also match.
    expect(screen.getByText('40bb', { selector: '.range-item-scenario' })).toBeInTheDocument()
  })

  it('combines hero and versus position with vs', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ metadata: { position: 'sb', versusPosition: 'btn', actionType: 'threeBet' } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText('SB vs BTN · 3-bet')).toBeInTheDocument()
  })

  it('shows only the metadata fields that are set', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ metadata: { position: 'co' } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    // Position alone renders as exactly "CO" (no separator); no action label appears.
    // Scope to the scenario span so the "CO" position option and "Open" action
    // option in the filter selects do not match.
    expect(screen.getByText('CO', { selector: '.range-item-scenario' })).toBeInTheDocument()
    expect(
      screen.queryByText('Open', { selector: '.range-item-scenario' }),
    ).not.toBeInTheDocument()
  })

  it('renders no metadata elements when metadata is absent', () => {
    const { container } = render(
      <RangeLibrary
        ranges={[makeRange()]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    // No empty scenario/notes labels are emitted for a metadata-less range.
    expect(container.querySelector('.range-item-scenario')).toBeNull()
    expect(container.querySelector('.range-item-notes')).toBeNull()
  })

  it('truncates long notes to a compact preview', () => {
    const longNotes = 'x'.repeat(120)
    render(
      <RangeLibrary
        ranges={[makeRange({ metadata: { notes: longNotes } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.getByText(`${'x'.repeat(80)}…`)).toBeInTheDocument()
    expect(screen.queryByText(longNotes)).not.toBeInTheDocument()
  })

  it('shows a practice-stats line for a range with recorded practice stats', () => {
    render(
      <RangeLibrary
        ranges={[makeRange({ id: 'r1', name: 'Pairs' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        practiceStats={{
          r1: {
            rangeId: 'r1',
            totalAttempts: 4,
            correctAttempts: 3,
            lastPracticedAt: '2026-06-01T00:00:00.000Z',
          },
        }}
      />,
    )

    // 3/4 -> 75% accuracy; the ".*" spans the "·" separators, and the
    // locale-formatted date is left unasserted.
    expect(
      screen.getByText(/Practiced 4.*75% accuracy/, { selector: '.range-item-practice' }),
    ).toBeInTheDocument()
  })

  it('renders no practice-stats line for a range without recorded stats', () => {
    const { container } = render(
      <RangeLibrary
        ranges={[makeRange({ id: 'r1', name: 'Pairs' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // The default-empty practiceStats map has no entry for this range.
    expect(container.querySelector('.range-item-practice')).toBeNull()
  })

  it('narrows the listed ranges by name as the user types in the search box', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open' }),
          makeRange({ id: 'r2', name: 'BB defend' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Both are listed before searching.
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('BB defend')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: /search ranges/i }), 'defend')

    expect(screen.queryByText('Button open')).not.toBeInTheDocument()
    expect(screen.getByText('BB defend')).toBeInTheDocument()
  })

  it('matches range names case-insensitively', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Button open' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('searchbox'), 'BUTTON')

    expect(screen.getByText('Button open')).toBeInTheDocument()
  })

  it('shows a no-match empty state when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Button open' })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.queryByText('Button open')).not.toBeInTheDocument()
    expect(screen.getByText(/no ranges match/i)).toBeInTheDocument()
  })

  it('restores the full list when the search query is cleared', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open' }),
          makeRange({ id: 'r2', name: 'BB defend' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const search = screen.getByRole('searchbox')
    await user.type(search, 'defend')
    expect(screen.queryByText('Button open')).not.toBeInTheDocument()

    await user.clear(search)
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('BB defend')).toBeInTheDocument()
  })

  it('does not render the search box when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('narrows the listed ranges to the chosen position', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open', metadata: { position: 'btn' } }),
          makeRange({ id: 'r2', name: 'Cutoff open', metadata: { position: 'co' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Both are listed before filtering.
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('Cutoff open')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('Cutoff open')).not.toBeInTheDocument()
  })

  it('excludes ranges without a position while a position is selected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Has BTN', metadata: { position: 'btn' } }),
          makeRange({ id: 'r2', name: 'No metadata' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )

    expect(screen.getByText('Has BTN')).toBeInTheDocument()
    expect(screen.queryByText('No metadata')).not.toBeInTheDocument()
  })

  it('restores every range when All positions is reselected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open', metadata: { position: 'btn' } }),
          makeRange({ id: 'r2', name: 'Cutoff open', metadata: { position: 'co' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const filter = screen.getByRole('combobox', { name: /filter ranges by position/i })
    await user.selectOptions(filter, 'btn')
    expect(screen.queryByText('Cutoff open')).not.toBeInTheDocument()

    await user.selectOptions(filter, '')
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('Cutoff open')).toBeInTheDocument()
  })

  it('applies the position filter and name search together', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open', metadata: { position: 'btn' } }),
          makeRange({ id: 'r2', name: 'Button 3-bet', metadata: { position: 'co' } }),
          makeRange({ id: 'r3', name: 'Blind defend', metadata: { position: 'btn' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Name search keeps the two "Button" ranges; position then keeps only the BTN one.
    await user.type(screen.getByRole('searchbox'), 'button')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('Button 3-bet')).not.toBeInTheDocument()
    expect(screen.queryByText('Blind defend')).not.toBeInTheDocument()
  })

  it('shows the no-match empty state when the position filter matches nothing', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Button open', metadata: { position: 'btn' } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'co',
    )

    expect(screen.queryByText('Button open')).not.toBeInTheDocument()
    expect(screen.getByText(/no ranges match/i)).toBeInTheDocument()
  })

  it('does not render the position filter when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('combobox', { name: /filter ranges by position/i }),
    ).not.toBeInTheDocument()
  })

  it('narrows the listed ranges to the chosen action type', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open', metadata: { actionType: 'open' } }),
          makeRange({ id: 'r2', name: 'SB 3-bet', metadata: { actionType: 'threeBet' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Both are listed before filtering.
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('SB 3-bet')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'open',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('SB 3-bet')).not.toBeInTheDocument()
  })

  it('excludes ranges without an action type while an action is selected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Has open', metadata: { actionType: 'open' } }),
          makeRange({ id: 'r2', name: 'No metadata' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'open',
    )

    expect(screen.getByText('Has open')).toBeInTheDocument()
    expect(screen.queryByText('No metadata')).not.toBeInTheDocument()
  })

  it('restores every range when All actions is reselected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Button open', metadata: { actionType: 'open' } }),
          makeRange({ id: 'r2', name: 'SB 3-bet', metadata: { actionType: 'threeBet' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const filter = screen.getByRole('combobox', { name: /filter ranges by action type/i })
    await user.selectOptions(filter, 'open')
    expect(screen.queryByText('SB 3-bet')).not.toBeInTheDocument()

    await user.selectOptions(filter, '')
    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.getByText('SB 3-bet')).toBeInTheDocument()
  })

  it('applies the action-type filter together with the name search and position filter', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({
            id: 'r1',
            name: 'Button open',
            metadata: { position: 'btn', actionType: 'open' },
          }),
          makeRange({
            id: 'r2',
            name: 'Button 3-bet',
            metadata: { position: 'btn', actionType: 'threeBet' },
          }),
          makeRange({
            id: 'r3',
            name: 'Cutoff open',
            metadata: { position: 'co', actionType: 'open' },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Name keeps the two "Button" ranges, position keeps the BTN ones, action
    // keeps only the open: just "Button open" survives all three filters.
    await user.type(screen.getByRole('searchbox'), 'button')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'open',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('Button 3-bet')).not.toBeInTheDocument()
    expect(screen.queryByText('Cutoff open')).not.toBeInTheDocument()
  })

  it('shows the no-match empty state when the action-type filter matches nothing', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[makeRange({ name: 'Button open', metadata: { actionType: 'open' } })]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'threeBet',
    )

    expect(screen.queryByText('Button open')).not.toBeInTheDocument()
    expect(screen.getByText(/no ranges match/i)).toBeInTheDocument()
  })

  it('does not render the action-type filter when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('combobox', { name: /filter ranges by action type/i }),
    ).not.toBeInTheDocument()
  })

  it('lists each distinct saved stack depth once as an option, sorted ascending', () => {
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Deep A', metadata: { stackDepthBb: 100 } }),
          makeRange({ id: 'r2', name: 'Deep B', metadata: { stackDepthBb: 100 } }),
          makeRange({ id: 'r3', name: 'Short', metadata: { stackDepthBb: 20 } }),
          makeRange({ id: 'r4', name: 'No depth' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const filter = screen.getByRole('combobox', { name: /filter ranges by stack depth/i })
    // Two 100bb ranges collapse to one option; the depth-less range adds none.
    const options = within(filter)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['All stack depths', '20bb', '100bb'])
  })

  it('narrows the listed ranges to the chosen stack depth', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Deep', metadata: { stackDepthBb: 100 } }),
          makeRange({ id: 'r2', name: 'Short', metadata: { stackDepthBb: 20 } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Both are listed before filtering.
    expect(screen.getByText('Deep')).toBeInTheDocument()
    expect(screen.getByText('Short')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by stack depth/i }),
      '100',
    )

    expect(screen.getByText('Deep')).toBeInTheDocument()
    expect(screen.queryByText('Short')).not.toBeInTheDocument()
  })

  it('excludes ranges without a stack depth while a depth is selected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Has depth', metadata: { stackDepthBb: 100 } }),
          makeRange({ id: 'r2', name: 'No metadata' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by stack depth/i }),
      '100',
    )

    expect(screen.getByText('Has depth')).toBeInTheDocument()
    expect(screen.queryByText('No metadata')).not.toBeInTheDocument()
  })

  it('restores every range when All stack depths is reselected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Deep', metadata: { stackDepthBb: 100 } }),
          makeRange({ id: 'r2', name: 'Short', metadata: { stackDepthBb: 20 } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const filter = screen.getByRole('combobox', { name: /filter ranges by stack depth/i })
    await user.selectOptions(filter, '100')
    expect(screen.queryByText('Short')).not.toBeInTheDocument()

    await user.selectOptions(filter, '')
    expect(screen.getByText('Deep')).toBeInTheDocument()
    expect(screen.getByText('Short')).toBeInTheDocument()
  })

  it('applies the stack-depth filter together with the name, position, and action-type filters', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({
            id: 'r1',
            name: 'Button open',
            metadata: { position: 'btn', actionType: 'open', stackDepthBb: 100 },
          }),
          makeRange({
            id: 'r2',
            name: 'Button open short',
            metadata: { position: 'btn', actionType: 'open', stackDepthBb: 20 },
          }),
          makeRange({
            id: 'r3',
            name: 'Cutoff open',
            metadata: { position: 'co', actionType: 'open', stackDepthBb: 100 },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Name keeps the two "Button" ranges, position keeps the BTN ones, action
    // keeps the opens, and 100bb keeps only "Button open" through all four.
    await user.type(screen.getByRole('searchbox'), 'button')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'open',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by stack depth/i }),
      '100',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('Button open short')).not.toBeInTheDocument()
    expect(screen.queryByText('Cutoff open')).not.toBeInTheDocument()
  })

  it('shows the no-match empty state when the combined filters match nothing', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'BTN deep', metadata: { position: 'btn', stackDepthBb: 100 } }),
          makeRange({ id: 'r2', name: 'CO short', metadata: { position: 'co', stackDepthBb: 20 } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // BTN exists only at 100bb, so BTN + 20bb matches nothing.
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by stack depth/i }),
      '20',
    )

    expect(screen.queryByText('BTN deep')).not.toBeInTheDocument()
    expect(screen.queryByText('CO short')).not.toBeInTheDocument()
    expect(screen.getByText('No ranges match the selected filters.')).toBeInTheDocument()
  })

  it('does not render the stack-depth filter when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('combobox', { name: /filter ranges by stack depth/i }),
    ).not.toBeInTheDocument()
  })

  it('narrows the listed ranges to the chosen game type', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cash range', metadata: { gameType: 'cash' } }),
          makeRange({ id: 'r2', name: 'MTT range', metadata: { gameType: 'tournament' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Both are listed before filtering.
    expect(screen.getByText('Cash range')).toBeInTheDocument()
    expect(screen.getByText('MTT range')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by game type/i }),
      'cash',
    )

    expect(screen.getByText('Cash range')).toBeInTheDocument()
    expect(screen.queryByText('MTT range')).not.toBeInTheDocument()
  })

  it('excludes ranges without a game type while a game type is selected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Has game', metadata: { gameType: 'cash' } }),
          makeRange({ id: 'r2', name: 'No metadata' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by game type/i }),
      'cash',
    )

    expect(screen.getByText('Has game')).toBeInTheDocument()
    expect(screen.queryByText('No metadata')).not.toBeInTheDocument()
  })

  it('restores every range when All game types is reselected', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cash range', metadata: { gameType: 'cash' } }),
          makeRange({ id: 'r2', name: 'MTT range', metadata: { gameType: 'tournament' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    const filter = screen.getByRole('combobox', { name: /filter ranges by game type/i })
    await user.selectOptions(filter, 'cash')
    expect(screen.queryByText('MTT range')).not.toBeInTheDocument()

    await user.selectOptions(filter, '')
    expect(screen.getByText('Cash range')).toBeInTheDocument()
    expect(screen.getByText('MTT range')).toBeInTheDocument()
  })

  it('applies the game-type filter together with the name, position, action-type, and stack-depth filters', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({
            id: 'r1',
            name: 'Button open',
            metadata: { position: 'btn', actionType: 'open', stackDepthBb: 100, gameType: 'cash' },
          }),
          makeRange({
            id: 'r2',
            name: 'Button open mtt',
            metadata: {
              position: 'btn',
              actionType: 'open',
              stackDepthBb: 100,
              gameType: 'tournament',
            },
          }),
          makeRange({
            id: 'r3',
            name: 'Cutoff open',
            metadata: { position: 'co', actionType: 'open', stackDepthBb: 100, gameType: 'cash' },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Name keeps the two "Button" ranges, position keeps the BTN ones, action
    // keeps the opens, 100bb keeps them, and cash keeps only "Button open"
    // through all five filters.
    await user.type(screen.getByRole('searchbox'), 'button')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by action type/i }),
      'open',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by stack depth/i }),
      '100',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by game type/i }),
      'cash',
    )

    expect(screen.getByText('Button open')).toBeInTheDocument()
    expect(screen.queryByText('Button open mtt')).not.toBeInTheDocument()
    expect(screen.queryByText('Cutoff open')).not.toBeInTheDocument()
  })

  it('shows the no-match empty state when the game-type filter combination matches nothing', async () => {
    const user = userEvent.setup()
    render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cash spot', metadata: { position: 'btn', gameType: 'cash' } }),
          makeRange({
            id: 'r2',
            name: 'MTT spot',
            metadata: { position: 'co', gameType: 'tournament' },
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // BTN exists only as a cash range, so BTN + tournament matches nothing.
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by game type/i }),
      'tournament',
    )

    expect(screen.queryByText('Cash spot')).not.toBeInTheDocument()
    expect(screen.queryByText('MTT spot')).not.toBeInTheDocument()
    expect(screen.getByText('No ranges match the selected filters.')).toBeInTheDocument()
  })

  it('does not render the game-type filter when there are no saved ranges', () => {
    render(
      <RangeLibrary
        ranges={[]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('combobox', { name: /filter ranges by game type/i }),
    ).not.toBeInTheDocument()
  })

  it('renders ranges in their given order while sort is at Default order', () => {
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cutoff open' }),
          makeRange({ id: 'r2', name: 'Button open' }),
          makeRange({ id: 'r3', name: 'Hijack open' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    // Read names in document order; getByText is order-insensitive.
    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['Cutoff open', 'Button open', 'Hijack open'])
  })

  it('reorders the visible ranges alphabetically when Name (A–Z) is selected', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cutoff open' }),
          makeRange({ id: 'r2', name: 'Button open' }),
          makeRange({ id: 'r3', name: 'Hijack open' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'name')

    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['Button open', 'Cutoff open', 'Hijack open'])
  })

  it('sorts by name on top of an active filter', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Cutoff open', metadata: { position: 'btn' } }),
          makeRange({ id: 'r2', name: 'Button open', metadata: { position: 'btn' } }),
          makeRange({ id: 'r3', name: 'Away CO', metadata: { position: 'co' } }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'name')

    // The CO range is filtered out (it would sort first if present), and the two
    // remaining BTN ranges are ordered alphabetically.
    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['Button open', 'Cutoff open'])
    expect(screen.queryByText('Away CO')).not.toBeInTheDocument()
  })

  it('reorders the visible ranges by most recently edited when Recently edited is selected', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Edited middle', updatedAt: '2026-02-01T00:00:00.000Z' }),
          makeRange({ id: 'r2', name: 'Edited newest', updatedAt: '2026-03-01T00:00:00.000Z' }),
          makeRange({ id: 'r3', name: 'Edited oldest', updatedAt: '2026-01-01T00:00:00.000Z' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'recent')

    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['Edited newest', 'Edited middle', 'Edited oldest'])
  })

  it('sorts by recently edited on top of an active filter', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({
            id: 'r1',
            name: 'BTN older',
            metadata: { position: 'btn' },
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
          makeRange({
            id: 'r2',
            name: 'BTN newer',
            metadata: { position: 'btn' },
            updatedAt: '2026-03-01T00:00:00.000Z',
          }),
          makeRange({
            id: 'r3',
            name: 'CO newest',
            metadata: { position: 'co' },
            updatedAt: '2026-06-01T00:00:00.000Z',
          }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter ranges by position/i }),
      'btn',
    )
    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'recent')

    // The CO range is filtered out (it would sort first by recency if present),
    // and the two remaining BTN ranges are ordered newest-edited first.
    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['BTN newer', 'BTN older'])
    expect(screen.queryByText('CO newest')).not.toBeInTheDocument()
  })

  it('reorders the visible ranges by most recently practiced when Recently practiced is selected', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Practiced middle' }),
          makeRange({ id: 'r2', name: 'Practiced newest' }),
          makeRange({ id: 'r3', name: 'Never practiced' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        practiceStats={{
          r1: {
            rangeId: 'r1',
            totalAttempts: 2,
            correctAttempts: 1,
            lastPracticedAt: '2026-02-01T00:00:00.000Z',
          },
          r2: {
            rangeId: 'r2',
            totalAttempts: 2,
            correctAttempts: 2,
            lastPracticedAt: '2026-03-01T00:00:00.000Z',
          },
        }}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'practiced')

    // The two practiced ranges sort newest-practiced first; the never-practiced
    // range (no stats entry) sorts last.
    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['Practiced newest', 'Practiced middle', 'Never practiced'])
  })

  it('reorders the visible ranges by accuracy, highest first, when Accuracy is selected', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <RangeLibrary
        ranges={[
          makeRange({ id: 'r1', name: 'Mid accuracy' }),
          makeRange({ id: 'r2', name: 'High accuracy' }),
          makeRange({ id: 'r3', name: 'Never practiced' }),
        ]}
        activeId={null}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onPractice={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onFavorite={vi.fn()}
        onViewPerformance={vi.fn()}
        onEditActions={vi.fn()}
        practiceStats={{
          r1: {
            rangeId: 'r1',
            totalAttempts: 4,
            correctAttempts: 2, // 50%
            lastPracticedAt: '2026-02-01T00:00:00.000Z',
          },
          r2: {
            rangeId: 'r2',
            totalAttempts: 4,
            correctAttempts: 3, // 75%
            lastPracticedAt: '2026-01-01T00:00:00.000Z',
          },
        }}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /sort ranges/i }), 'accuracy')

    // The two practiced ranges sort highest-accuracy first; the never-practiced
    // range (no stats entry) sorts last.
    const names = [...container.querySelectorAll('.range-item-name')].map((el) => el.textContent)
    expect(names).toEqual(['High accuracy', 'Mid accuracy', 'Never practiced'])
  })
})
