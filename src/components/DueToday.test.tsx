import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DueToday } from './DueToday'
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

describe('DueToday', () => {
  it('shows an empty state when nothing is due', () => {
    render(<DueToday dueRanges={[]} streak={0} onPractice={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(/Nothing due for review/)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows the review streak', () => {
    render(<DueToday dueRanges={[]} streak={3} onPractice={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Review streak: 3 days')).toBeInTheDocument()
  })

  it('renders the streak in the singular for one day', () => {
    render(<DueToday dueRanges={[]} streak={1} onPractice={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Review streak: 1 day')).toBeInTheDocument()
  })

  it('lists each due range with a Practice button', () => {
    render(
      <DueToday
        dueRanges={[makeRange({ id: 'a', name: 'BTN Open' }), makeRange({ id: 'b', name: 'CO Open' })]}
        streak={0}
        onPractice={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('BTN Open')).toBeInTheDocument()
    expect(screen.getByText('CO Open')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice range BTN Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice range CO Open' })).toBeInTheDocument()
  })

  it('calls onPractice with the chosen range', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    const range = makeRange({ id: 'a', name: 'BTN Open' })
    render(<DueToday dueRanges={[range]} streak={0} onPractice={onPractice} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Practice range BTN Open' }))

    expect(onPractice).toHaveBeenCalledExactlyOnceWith(range)
  })

  it('calls onClose from "Back to library"', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DueToday dueRanges={[]} streak={0} onPractice={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
