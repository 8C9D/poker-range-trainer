import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PracticeSession } from './PracticeSession'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test Range',
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * A deterministic stand-in for Math.random that yields each value in turn,
 * repeating the last one once exhausted. getRandomPracticeHand maps these to
 * specific hands: 0 -> the first hand ("AA"), 0.999 -> the last hand ("22").
 */
function sequenceRandom(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

function stats() {
  return screen.getByLabelText('Session stats')
}

describe('PracticeSession', () => {
  it('shows the active range name, the current hand, and both answer buttons', () => {
    render(
      <PracticeSession
        range={makeRange({ name: 'Pairs' })}
        onExit={vi.fn()}
        random={sequenceRandom([0])}
      />,
    )

    expect(screen.getByRole('heading', { name: /Practicing: Pairs/ })).toBeInTheDocument()
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
  })

  it('records a correct answer when an in-range hand is answered "In range"', async () => {
    const user = userEvent.setup()
    // random() -> 0 selects "AA", which is in the range.
    render(<PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'In range' }))

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(/Expected answer: In range/)).toBeInTheDocument()
    expect(within(stats()).getByText('Total questions: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Accuracy: 100%')).toBeInTheDocument()
  })

  it('records a correct answer when an out-of-range hand is answered "Out of range"', async () => {
    const user = userEvent.setup()
    // random() -> 0.999 selects "22", which is not in the range.
    render(
      <PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0.999])} />,
    )

    expect(screen.getByText('22')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Out of range' }))

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(/Expected answer: Out of range/)).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
  })

  it('shows incorrect feedback and the expected answer when the answer is wrong', async () => {
    const user = userEvent.setup()
    // "AA" is in range; answering "Out of range" is incorrect.
    render(<PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'Out of range' }))

    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText(/Expected answer: In range/)).toBeInTheDocument()
    expect(within(stats()).getByText('Total questions: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 0')).toBeInTheDocument()
    expect(within(stats()).getByText('Accuracy: 0%')).toBeInTheDocument()
  })

  it('updates totals, correct count, and accuracy across multiple answers', async () => {
    const user = userEvent.setup()
    // First hand "AA" (in range), then "22" (out of range) after Next.
    render(
      <PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0, 0.999])} />,
    )

    // Answer the first hand correctly.
    await user.click(screen.getByRole('button', { name: 'In range' }))
    expect(within(stats()).getByText('Accuracy: 100%')).toBeInTheDocument()

    // Move on and answer the second hand incorrectly.
    await user.click(screen.getByRole('button', { name: 'Next hand' }))
    await user.click(screen.getByRole('button', { name: 'In range' }))

    expect(within(stats()).getByText('Total questions: 2')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Accuracy: 50%')).toBeInTheDocument()
  })

  it('prevents answering the same hand twice', async () => {
    const user = userEvent.setup()
    render(<PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'In range' }))

    // The answer buttons are replaced by feedback, so the hand cannot be re-answered.
    expect(screen.queryByRole('button', { name: 'In range' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Out of range' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next hand' })).toBeInTheDocument()
    expect(within(stats()).getByText('Total questions: 1')).toBeInTheDocument()
  })

  it('advances to a different hand on Next hand', async () => {
    const user = userEvent.setup()
    render(
      <PracticeSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0, 0.999])} />,
    )

    expect(screen.getByText('AA')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))

    expect(screen.queryByText('AA')).not.toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    // A fresh prompt is unanswered: answer buttons are back, feedback is gone.
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument()
  })

  it('lists missed and wrongly-included hands in the end-of-session review', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    // First hand "AA" (in range), then "22" (out of range) after Next.
    render(
      <PracticeSession range={makeRange()} onExit={onExit} random={sequenceRandom([0, 0.999])} />,
    )

    // "AA" is in range; answering "Out of range" forgets it (a miss).
    await user.click(screen.getByRole('button', { name: 'Out of range' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))
    // "22" is out of range; answering "In range" wrongly includes it.
    await user.click(screen.getByRole('button', { name: 'In range' }))

    await user.click(screen.getByRole('button', { name: 'End Practice' }))

    // Each mistaken hand appears under the right heading in the review.
    expect(
      within(screen.getByRole('list', { name: 'Hands you missed' })).getByText('AA'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Hands you wrongly included' })).getByText('22'),
    ).toBeInTheDocument()

    // The summary is reported only once the review is dismissed.
    expect(onExit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledOnce()
    // The raw attempts are reported so the parent can derive summary + per-hand accuracy.
    const reported = onExit.mock.calls[0][0] as PracticeAttempt[]
    expect(reported.map((attempt) => attempt.hand)).toEqual(['AA', '22'])
    expect(reported.every((attempt) => !attempt.correct)).toBe(true)
  })

  it('shows a no-mistakes review, then reports the attempts when dismissed', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    // random() -> 0 selects "AA", which is in the range; answer it correctly.
    render(<PracticeSession range={makeRange()} onExit={onExit} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'End Practice' }))

    // No mistakes: the positive message shows and no hands are listed.
    expect(screen.getByText(/No mistakes/)).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)

    // onExit fires only after dismissing the review.
    expect(onExit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledOnce()
    const reported = onExit.mock.calls[0][0]
    expect(reported).toHaveLength(1)
    expect(reported[0]).toMatchObject({ hand: 'AA', correct: true })
  })

  it('reports an empty attempts list when ending without answering', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<PracticeSession range={makeRange()} onExit={onExit} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    // Nothing was answered, so there are no mistakes to review.
    expect(screen.getByText(/No mistakes/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledOnce()
    expect(onExit).toHaveBeenCalledWith([])
  })

  it('draws prompts only from handPool when one is provided', async () => {
    const user = userEvent.setup()
    // From the pool: random 0 -> "AA" (pool[0]), random 0.999 -> "KK" (pool[1]).
    render(
      <PracticeSession
        range={makeRange()}
        onExit={vi.fn()}
        random={sequenceRandom([0, 0.999])}
        handPool={['AA', 'KK']}
      />,
    )

    expect(screen.getByText('AA')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))
    expect(screen.getByText('KK')).toBeInTheDocument()
  })
})
