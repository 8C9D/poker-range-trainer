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
      />,
    )
    expect(screen.getByText(/no saved ranges/i)).toBeInTheDocument()
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
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Load range Pairs' }))

    expect(onLoad).toHaveBeenCalledExactlyOnceWith(range)
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
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Duplicate range Pairs' }))

    expect(onDuplicate).toHaveBeenCalledExactlyOnceWith(range)
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
      />,
    )
    expect(screen.getByText(`${'x'.repeat(80)}…`)).toBeInTheDocument()
    expect(screen.queryByText(longNotes)).not.toBeInTheDocument()
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
})
