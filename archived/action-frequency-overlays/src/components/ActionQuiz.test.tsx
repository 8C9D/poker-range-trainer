import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(onExit).toHaveBeenCalledWith([])
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
    expect(within(stats()).getByText('Answered: 1 of 20')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
  })

  it('ends itself at the drill length instead of looping forever', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(
      <ActionQuiz
        range={makeRange({ handActions: RAISE_AA })}
        onExit={onExit}
        questionCount={2}
        random={() => 0}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Raise' }))
    expect(screen.getByRole('button', { name: 'Next hand' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next hand' }))

    await user.click(screen.getByRole('button', { name: 'Raise' }))
    // The run counts toward the day and the schedule, so its length is stated
    // rather than left to the user to decide.
    expect(within(stats()).getByText('Answered: 2 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See results' }))

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit.mock.calls[0][0]).toHaveLength(2)
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

  it('reports the answered attempts to onExit on "End quiz"', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={onExit} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledWith([
      { hand: 'AA', chosen: 'raise', expected: 'raise', correct: true },
    ])
  })

  it('reports an empty attempt array when ending before answering', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<ActionQuiz range={makeRange({ handActions: RAISE_AA })} onExit={onExit} random={() => 0} />)

    await user.click(screen.getByRole('button', { name: 'End quiz' }))
    expect(onExit).toHaveBeenCalledWith([])
  })

  it('answers with mnemonic keys and ignores duplicate input during feedback', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(
      <ActionQuiz
        range={makeRange({ handActions: RAISE_AA })}
        onExit={onExit}
        random={() => 0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Raise' })).toHaveAttribute(
      'aria-keyshortcuts',
      'R',
    )
    fireEvent.keyDown(window, { key: 'r' })
    fireEvent.keyDown(window, { key: 'f' })
    expect(screen.getByText('Correct!')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'End quiz' }))
    expect(onExit.mock.calls[0][0]).toEqual([
      { hand: 'AA', chosen: 'raise', expected: 'raise', correct: true },
    ])
  })

  it('advances from feedback with Enter', () => {
    render(
      <ActionQuiz
        range={makeRange({ handActions: RAISE_AA })}
        onExit={vi.fn()}
        random={() => 0}
      />,
    )

    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('button', { name: 'Next hand' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Enter',
    )
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.queryByText('Correct!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Raise' })).toBeInTheDocument()
  })

  it('hands back the user’s own note on a wrong action, but not on a right one', () => {
    render(
      <ActionQuiz
        range={makeRange({ handActions: RAISE_AA, handNotes: { AA: 'Slow-play it 4-handed.' } })}
        onExit={vi.fn()}
        random={() => 0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByText('Your note: Slow-play it 4-handed.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next hand' }))
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    expect(screen.queryByText(/Your note:/)).not.toBeInTheDocument()
  })
})
