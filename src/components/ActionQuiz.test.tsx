import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionQuiz } from './ActionQuiz'
import type { RangeAction, SavedRange } from '../types/range'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test Range',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const RAISE_AA: Record<string, RangeAction> = { AA: 'raise' }

function stats() {
  return screen.getByLabelText('Quiz stats')
}

describe('ActionQuiz', () => {
  it('shows a no-actions message when the range has no assignments', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<ActionQuiz range={makeRange()} onExit={onExit} />)

    expect(screen.getByText(/no actions assigned yet/)).toBeInTheDocument()
    expect(screen.queryByText('What is the correct action?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('prompts a hand from the action chart with colored answer buttons', () => {
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={vi.fn()} random={() => 0} />)

    expect(screen.getByText('What is the correct action?')).toBeInTheDocument()
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Raise' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
  })

  it('scores a correct action answer', async () => {
    const user = userEvent.setup()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={vi.fn()} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'Raise' }))

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(/Correct action: Raise/)).toBeInTheDocument()
    expect(within(stats()).getByText('Total questions: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
  })

  it('marks a wrong answer and shows the correct action', async () => {
    const user = userEvent.setup()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={vi.fn()} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'Fold' }))

    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText(/Correct action: Raise/)).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 0')).toBeInTheDocument()
  })

  it('advances to the next hand and clears feedback', async () => {
    const user = userEvent.setup()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={vi.fn()} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))

    expect(screen.queryByText('Correct!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Raise' })).toBeInTheDocument()
  })

  it('calls onExit from "End quiz"', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={onExit} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'End quiz' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
