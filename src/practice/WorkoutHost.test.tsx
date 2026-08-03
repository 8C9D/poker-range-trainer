import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { WorkoutHost } from './WorkoutHost'
import { HIT_DWELL_MS } from './drillPacing'
import type { DailyWorkout } from '../domain/dailyWorkout'
import { ALL_HANDS } from '../domain/pokerHands'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSpotAccuracy } from '../storage/spotAccuracyStorage'
import { saveTrainingGoal } from '../storage/trainingGoalStorage'
import { loadWorkoutCompletion } from '../storage/workoutStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// Playing every hand makes "In range" always correct, so tests can answer
// deterministically without stubbing the random hand draw.
const everyHand: SavedRange = {
  id: 'a',
  name: 'Everything',
  hands: [...ALL_HANDS],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const btnOpen: SavedRange = {
  id: 'b',
  name: 'BTN open',
  hands: [...ALL_HANDS],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: { position: 'btn', actionType: 'open' },
}

function makeWorkout(overrides: Partial<DailyWorkout> = {}): DailyWorkout {
  return {
    segments: [
      {
        kind: 'review',
        ranges: [everyHand],
        questionsPerRange: 1,
        reason: '1 range due for review.',
      },
      {
        kind: 'freshSpots',
        format: { tableSize: 'sixMax', stackDepthBb: 100 },
        spotKeys: ['sixMax|btn|foldedToYou|-|100'],
        questionCount: 1,
        reason: 'Free play across the 1 spot your library covers.',
      },
    ],
    totalQuestions: 2,
    estimatedMinutes: 1,
    ...overrides,
  }
}

describe('WorkoutHost', () => {
  it('opens on a hand-off naming the part and its reason', () => {
    render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={vi.fn()} />,
    )

    expect(screen.getByText('Daily workout · Part 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByText('1 range due for review.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText('Everything')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
  })

  it('starts the segment from the hand-off with Enter', () => {
    render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
  })

  it('abandons without recording when closed before any answer', () => {
    const onClose = vi.fn()
    render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={onClose} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadPracticeStats()).toEqual({})
    expect(loadReviewStates()).toEqual({})
  })

  it('carries a failed segment save through to the end-of-run summary', () => {
    render(
      <WorkoutHost
        workout={makeWorkout({
          segments: [
            {
              kind: 'review',
              ranges: [everyHand],
              questionsPerRange: 5,
              reason: '1 range due for review.',
            },
          ],
        })}
        ranges={[everyHand, btnOpen]}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    // A workout records segment by segment, so the failure has to outlive the
    // handler it happened in rather than tearing the run down where it occurs.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'In range' }))
      fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

      expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
      expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    } finally {
      spy.mockRestore()
    }
  })

  it('keeps what was answered and jumps to the summary on an early close', () => {
    vi.useFakeTimers()
    render(
      <WorkoutHost
        workout={makeWorkout({
          segments: [
            {
              kind: 'review',
              ranges: [everyHand],
              questionsPerRange: 5,
              reason: '1 range due for review.',
            },
          ],
        })}
        ranges={[everyHand, btnOpen]}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
    expect(screen.getByText('Stopped early · Review 1/1')).toBeInTheDocument()
    expect(loadPracticeStats().a.totalAttempts).toBe(1)
    // An early exit is not a completed workout: the card keeps offering the plan.
    expect(loadWorkoutCompletion()).toBeNull()
  })

  it('runs the segments back-to-back and sums them in one summary', () => {
    vi.useFakeTimers()
    saveTrainingGoal(20)
    const onClose = vi.fn()
    render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={onClose} />,
    )

    // Part 1: the one-question review session.
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    act(() => vi.advanceTimersByTime(HIT_DWELL_MS))

    // The hand-off to part 2, then the spot drill.
    expect(screen.getByText('Daily workout · Part 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Free play' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('6-max, 100bb. Folded to you on the BTN.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.advanceTimersByTime(HIT_DWELL_MS))

    // One combined summary: both answers, both contributions, both recorded.
    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 correct')).toBeInTheDocument()
    expect(screen.getByText('Review 1/1 · Free play 1/1')).toBeInTheDocument()
    expect(loadPracticeStats().a.totalAttempts).toBe(1)
    expect(loadPracticeStats().b.totalAttempts).toBe(1)
    expect(loadSpotAccuracy()['sixMax|btn|foldedToYou|-|100']).toMatchObject({
      attempts: 1,
      correct: 1,
    })
    // A full run completes the workout for the day and reports goal progress.
    expect(loadWorkoutCompletion()).not.toBeNull()
    expect(screen.getByText('2 of 20 hands — 18 to go.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('drills only the listed spots in a weak-spot segment', () => {
    render(
      <WorkoutHost
        workout={makeWorkout({
          segments: [
            {
              kind: 'weakSpots',
              leaks: [],
              spotKeys: ['sixMax|btn|foldedToYou|-|100'],
              format: { tableSize: 'sixMax', stackDepthBb: 100 },
              questionCount: 1,
              reason: 'Your weakest spot.',
            },
          ],
        })}
        ranges={[everyHand, btnOpen]}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    // The BTN-open library covers several spots; the restriction deals just this one.
    expect(screen.getByText('6-max, 100bb. Folded to you on the BTN.')).toBeInTheDocument()
  })
})
