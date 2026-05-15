import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeaknessFocusedDrill } from './WeaknessFocusedDrill'
import { buildWeaknessPool } from '../domain/weaknessDrill'
import type { PracticeAttempt } from '../types/practice'
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

/** Deterministic stand-in for Math.random: yields each value in turn, repeating the last. */
function sequenceRandom(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

function missed(hand: string): PracticeAttempt {
  return { hand, expectedInRange: true, userAnsweredInRange: false, correct: false, timestamp: 'T' }
}

function stats() {
  return screen.getByLabelText('Session stats')
}

describe('WeaknessFocusedDrill', () => {
  it('shows the range name, the first prompt, and both answer buttons', () => {
    // No attempts yet -> uniform draw, so random()=0 yields the first hand "AA".
    render(
      <WeaknessFocusedDrill range={makeRange({ name: 'BTN' })} onExit={vi.fn()} random={sequenceRandom([0])} />,
    )

    expect(screen.getByRole('heading', { name: /Weakness drill: BTN/ })).toBeInTheDocument()
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
  })

  it('scores an answer and shows feedback with the expected answer', async () => {
    const user = userEvent.setup()
    render(<WeaknessFocusedDrill range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'In range' }))

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(/Expected answer: In range/)).toBeInTheDocument()
    expect(within(stats()).getByText('Total questions: 1')).toBeInTheDocument()
    expect(within(stats()).getByText('Correct: 1')).toBeInTheDocument()
  })

  it('advances to a new prompt and clears feedback on "Next hand"', async () => {
    const user = userEvent.setup()
    // First prompt "AA" (random 0), next prompt "22" (random 0.999, no mistakes yet).
    render(
      <WeaknessFocusedDrill range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0, 0.999])} />,
    )

    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'Next hand' }))

    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
  })

  it('weights a missed hand up so it resurfaces on the next draw', async () => {
    const user = userEvent.setup()
    // Force the first prompt to KK (uniform pool), then miss it (KK is in range).
    const uniform = buildWeaknessPool([])
    const firstR = (uniform.indexOf('KK') + 0.5) / uniform.length

    // After the miss, KK has extra copies. Choose an r landing on one of those
    // extra copies — a slot that is NOT KK in the uniform pool — proving the bias.
    const weighted = buildWeaknessPool([missed('KK')])
    const secondR = (weighted.lastIndexOf('KK') + 0.5) / weighted.length
    expect(uniform[Math.floor(secondR * uniform.length)]).not.toBe('KK')

    render(
      <WeaknessFocusedDrill
        range={makeRange()}
        onExit={vi.fn()}
        random={sequenceRandom([firstR, secondR])}
      />,
    )

    expect(screen.getByText('KK')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Out of range' })) // miss KK
    await user.click(screen.getByRole('button', { name: 'Next hand' }))

    // The weighting resurfaced KK where a uniform draw would have shown another hand.
    expect(screen.getByText('KK')).toBeInTheDocument()
  })

  it('reports the session attempts on "End practice"', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<WeaknessFocusedDrill range={makeRange()} onExit={onExit} random={sequenceRandom([0])} />)

    await user.click(screen.getByRole('button', { name: 'In range' })) // answer "AA" correctly
    await user.click(screen.getByRole('button', { name: 'End practice' }))

    const reported = onExit.mock.calls[0][0]
    expect(reported).toHaveLength(1)
    expect(reported[0]).toMatchObject({ hand: 'AA', correct: true })
  })
})
