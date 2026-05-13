import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { TimedDrillSession } from './TimedDrillSession'
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

/**
 * Deterministic stand-in for Math.random: yields each value in turn, repeating
 * the last once exhausted. getRandomPracticeHand maps 0 -> "AA", 0.999 -> "22".
 */
function sequenceRandom(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

// The drill drives its countdown off a real interval + Date.now(); fake timers
// make both deterministic. Clicks use fireEvent (synchronous) rather than
// userEvent, which deadlocks against fake timers.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TimedDrillSession', () => {
  it('offers the duration choices and the range name in config', () => {
    render(<TimedDrillSession range={makeRange({ name: 'BTN Open' })} onExit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /Timed drill: BTN Open/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30s' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '60s' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '120s' })).toBeInTheDocument()
    // No prompt until a drill starts.
    expect(screen.queryByRole('button', { name: 'In range' })).not.toBeInTheDocument()
  })

  it('exits config with a zero summary', () => {
    const onExit = vi.fn()
    render(<TimedDrillSession range={makeRange()} onExit={onExit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledWith(expect.objectContaining({ totalQuestions: 0 }))
  })

  it('starts a drill and shows the countdown and answer buttons', () => {
    render(<TimedDrillSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    fireEvent.click(screen.getByRole('button', { name: '60s' }))

    expect(
      within(screen.getByLabelText('Drill progress')).getByText('Time left: 60s'),
    ).toBeInTheDocument()
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
  })

  it('scores an answer and advances to the next hand', () => {
    // 0 -> "AA" (in range) on start, 0.999 -> "22" (out) for the next prompt.
    render(
      <TimedDrillSession
        range={makeRange()}
        onExit={vi.fn()}
        random={sequenceRandom([0, 0.999])}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '60s' }))
    expect(screen.getByText('AA')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'In range' }))

    const progress = within(screen.getByLabelText('Drill progress'))
    expect(progress.getByText('Answered: 1')).toBeInTheDocument()
    expect(progress.getByText('Correct: 1')).toBeInTheDocument()
    // The prompt advanced to the next drawn hand.
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('ends the drill and shows the summary once time expires', async () => {
    render(<TimedDrillSession range={makeRange()} onExit={vi.fn()} random={sequenceRandom([0])} />)

    fireEvent.click(screen.getByRole('button', { name: '60s' }))
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })

    // Time's up: the prompt and answer buttons are gone, the summary is shown.
    expect(screen.queryByRole('button', { name: 'In range' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Drill stats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New drill' })).toBeInTheDocument()
  })

  it('reports the accumulated summary when leaving the results view', async () => {
    const onExit = vi.fn()
    render(
      <TimedDrillSession range={makeRange()} onExit={onExit} random={sequenceRandom([0])} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '60s' }))
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onExit).toHaveBeenCalledWith(
      expect.objectContaining({ totalQuestions: 1, correctAnswers: 1 }),
    )
  })
})
