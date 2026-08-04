import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MixedActionQuiz } from './MixedActionQuiz'
import type { SavedRange } from '../types/range'
import type { HandMixedStrategy } from '../domain/mixedStrategy'

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

// AA primary = raise (60 > 40 fold).
const MIX_AA: Record<string, HandMixedStrategy> = {
  AA: [
    { action: 'raise', frequency: 60 },
    { action: 'fold', frequency: 40 },
  ],
}

describe('MixedActionQuiz', () => {
  it('shows an empty state when no hand has a mixed strategy', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<MixedActionQuiz range={makeRange()} onExit={onExit} />)

    expect(screen.getByText(/no mixed frequencies yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledWith([])
  })

  it('hands back every answered attempt when the quiz ends', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(
      <MixedActionQuiz
        range={makeRange({ mixedStrategies: MIX_AA })}
        onExit={onExit}
        random={() => 0}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Fold' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(onExit).toHaveBeenCalledWith([
      { hand: 'AA', chosen: 'fold', expected: 'raise', correct: false },
      { hand: 'AA', chosen: 'raise', expected: 'raise', correct: true },
    ])
  })

  it('quizzes only the hand pool it is given', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const mixed: Record<string, HandMixedStrategy> = {
      ...MIX_AA,
      KK: [
        { action: 'call', frequency: 70 },
        { action: 'fold', frequency: 30 },
      ],
    }
    render(
      <MixedActionQuiz
        range={makeRange({ mixedStrategies: mixed })}
        handPool={['KK']}
        onExit={onExit}
        random={() => 0}
      />,
    )

    expect(screen.getByText('KK')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Call' }))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
  })

  it('scores the primary action as correct', async () => {
    const user = userEvent.setup()
    render(
      <MixedActionQuiz range={makeRange({ mixedStrategies: MIX_AA })} onExit={vi.fn()} random={() => 0} />,
    )

    expect(screen.getByText('What is the primary action?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Raise' }))

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Quiz stats')).getByText('Correct: 1')).toBeInTheDocument()
  })

  it('scores a non-primary action as incorrect', async () => {
    const user = userEvent.setup()
    render(
      <MixedActionQuiz range={makeRange({ mixedStrategies: MIX_AA })} onExit={vi.fn()} random={() => 0} />,
    )

    await user.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Primary action: Raise')).toBeInTheDocument()
  })

  it('answers with mnemonic keys and ignores duplicate input during feedback', () => {
    render(
      <MixedActionQuiz
        range={makeRange({ mixedStrategies: MIX_AA })}
        onExit={vi.fn()}
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
    expect(
      within(screen.getByLabelText('Quiz stats')).getByText('Total questions: 1'),
    ).toBeInTheDocument()
  })

  it('advances from feedback with Enter', () => {
    render(
      <MixedActionQuiz
        range={makeRange({ mixedStrategies: MIX_AA })}
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
})
