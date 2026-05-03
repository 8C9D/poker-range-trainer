import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    expect(onPractice).toHaveBeenCalledExactlyOnceWith(range)
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
      />,
    )
    expect(screen.getByText('Active One').closest('li')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Other').closest('li')).not.toHaveAttribute('aria-current')
  })
})
