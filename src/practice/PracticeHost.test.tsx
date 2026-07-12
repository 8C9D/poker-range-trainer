import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PracticeHost } from './PracticeHost'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadActionAccuracy } from '../storage/actionAccuracyStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

function makeRange(id: string, name: string, extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

describe('PracticeHost mode picker', () => {
  it('lists base modes and hides the conditional quizzes', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Recognize hands')).toBeInTheDocument()
    expect(screen.getByText('Build from memory')).toBeInTheDocument()
    expect(screen.getByText('Timed drill')).toBeInTheDocument()
    expect(screen.getByText('Weakness drill')).toBeInTheDocument()
    expect(screen.getByText('Combo drill')).toBeInTheDocument()
    expect(screen.getByText('Postflop drill')).toBeInTheDocument()
    expect(screen.getByText('Range vs board')).toBeInTheDocument()
    expect(screen.queryByText('Pick the correct action')).not.toBeInTheDocument()
    expect(screen.queryByText('Frequency quiz')).not.toBeInTheDocument()
  })

  it('offers the action and frequency quizzes when the range has the data', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            makeRange('a', 'UTG open', {
              handActions: { AA: 'raise' },
              mixedStrategies: { KK: [{ action: 'raise', frequency: 100 }] },
            }),
          ],
          mode: null,
        }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Pick the correct action')).toBeInTheDocument()
    expect(screen.getByText('Frequency quiz')).toBeInTheDocument()
  })

  it('closes from the picker without recording anything', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadReviewStates()).toEqual({})
  })

  it('starts the recognition drill from the picker', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Recognize hands'))
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
  })

  it('opens build-from-memory inside the overlay', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Build from memory'))
    expect(
      screen.getByRole('dialog', { name: 'UTG open — build from memory' }),
    ).toBeInTheDocument()
  })
})

describe('PracticeHost recognition flow', () => {
  it('records the session and shows the peak-end summary', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={onClose}
      />,
    )
    // Answer one hand correctly, then close early -> summary.
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
    expect(screen.getByText('First session logged — that’s your baseline.')).toBeInTheDocument()
    expect(screen.getByText(/1-day streak/)).toBeInTheDocument()

    const stats = loadPracticeStats()['a']
    expect(stats.totalAttempts).toBe(1)
    expect(stats.correctAttempts).toBe(1)
    expect(loadReviewStates()['a']).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('abandons without recording when closed before any answer', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize' }}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadReviewStates()).toEqual({})
    expect(loadPracticeStats()).toEqual({})
  })

  it('advances a review queue through Next range', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open'), makeRange('b', 'BTN open')],
          mode: 'recognize',
          handPool: ['AA'],
        }}
        onClose={onClose}
      />,
    )
    // Queue position shows in the top bar.
    expect(screen.getByText('UTG open · 1/2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next range' }))

    expect(screen.getByText('BTN open · 2/2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    // Last range: only Done remains.
    expect(screen.queryByRole('button', { name: 'Next range' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(Object.keys(loadReviewStates()).sort()).toEqual(['a', 'b'])
  })

  it('frames a weaker session around the queued misses', () => {
    // Seed a strong previous session, then miss every hand this session.
    localStorage.setItem(
      'poker-range-trainer.session-history.v1',
      JSON.stringify({
        a: [
          {
            rangeId: 'a',
            playedAt: '2026-07-10T10:00:00.000Z',
            totalQuestions: 10,
            correctAnswers: 10,
          },
        ],
      }),
    )
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(
      screen.getByText('1 miss queued for review — they’ll show up more until they stick.'),
    ).toBeInTheDocument()
  })
})

describe('PracticeHost action quiz', () => {
  it('records action accuracy and shows a summary without a delta line', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { handActions: { AA: 'raise', KK: 'call' } })],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )
    // The quiz prompts a hand; answer with any action, then end the quiz.
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))
    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.queryByText(/baseline/)).not.toBeInTheDocument()
    expect(Object.keys(loadActionAccuracy())).toEqual(['a'])
  })
})
