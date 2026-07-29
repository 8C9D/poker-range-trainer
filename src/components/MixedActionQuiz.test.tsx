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
    expect(onExit).toHaveBeenCalled()
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
})
