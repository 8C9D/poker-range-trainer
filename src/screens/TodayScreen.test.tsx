import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayScreen } from './TodayScreen'
import { saveSavedRange } from '../storage/rangeStorage'
import { saveReviewState } from '../storage/reviewStateStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import { recordWorkoutCompletion } from '../storage/workoutStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

function makeRange(id: string, name: string, hands: string[] = ['AA', 'KK']): SavedRange {
  return {
    id,
    name,
    hands,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString()
const TODAY = new Date().toISOString()

describe('TodayScreen', () => {
  it('shows the onboarding panel when there are no ranges', () => {
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Get started' })
    expect(within(panel).getByRole('link', { name: 'Open Library' })).toHaveAttribute(
      'href',
      '#/library',
    )
  })

  it('lists due ranges with thumbnails and starts a full review queue', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    const onStartReview = vi.fn()
    render(<TodayScreen onStartReview={onStartReview} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    // Never-reviewed ranges are due; the CTA counts them.
    expect(screen.getByText(/2 ranges due/)).toBeInTheDocument()
    const dueList = screen.getByRole('region', { name: 'Due now' })
    expect(within(dueList).getAllByTestId('range-thumbnail')).toHaveLength(2)
    expect(within(dueList).getAllByText('New — never practiced')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Start review' }))
    expect(onStartReview).toHaveBeenCalledTimes(1)
    expect(onStartReview.mock.calls[0][0].map((r: SavedRange) => r.id)).toEqual(['a', 'b'])
  })

  it('reviews a single range from its row button', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    const onStartReview = vi.fn()
    render(<TodayScreen onStartReview={onStartReview} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const rows = screen.getAllByRole('button', { name: 'Review' })
    await user.click(rows[1])
    expect(onStartReview.mock.calls[0][0].map((r: SavedRange) => r.id)).toEqual(['b'])
  })

  it('excludes archived ranges from the due queue', () => {
    saveSavedRange({ ...makeRange('a', 'UTG open'), archived: true })
    saveSavedRange(makeRange('b', 'BTN open'))
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    expect(screen.getByText(/1 range due/)).toBeInTheDocument()
  })

  it('shows all caught up with a free-practice shortcut when nothing is due', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveReviewState({
      rangeId: 'a',
      ease: 2.5,
      intervalDays: 7,
      dueAt: FUTURE,
      lastReviewedAt: TODAY,
    })
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'All caught up' })
    expect(within(panel).getByRole('link', { name: 'Free practice' })).toHaveAttribute(
      'href',
      '#/library',
    )
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument()
  })

  it('shows the streak chip with grace-day copy once a streak exists', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    const chip = screen.getByTitle(/One rest day is forgiven/)
    expect(chip).toHaveTextContent('1 day')
  })

  it('summarizes the week in three tiles', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, TODAY)
    recordPracticeSessionHistory('b', { totalQuestions: 10, correctAnswers: 9 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    const tiles = screen.getByRole('region', { name: 'This week' })
    expect(within(tiles).getByText('20')).toBeInTheDocument()
    expect(within(tiles).getByText('75%')).toBeInTheDocument()
    expect(within(tiles).getByText('BTN open')).toBeInTheDocument()
  })

  it('does not let a deleted range replace the sharpest live range', () => {
    saveSavedRange(makeRange('live', 'UTG open'))
    recordPracticeSessionHistory('live', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSessionHistory('deleted', { totalQuestions: 10, correctAnswers: 10 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const tiles = screen.getByRole('region', { name: 'This week' })
    expect(within(tiles).getByText('UTG open')).toBeInTheDocument()
  })

  it('tracks the daily goal and persists a change to it', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 12, correctAnswers: 9 }, TODAY)
    saveTrainingGoal(20)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Daily goal' })
    expect(within(card).getByText('12 of 20 hands — 8 to go.')).toBeInTheDocument()
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')

    await user.selectOptions(within(card).getByRole('combobox'), '10')
    expect(within(card).getByText('Goal met — 12 hands today.')).toBeInTheDocument()
    expect(loadTrainingGoal()).toBe(10)
  })

  it('hides the progress bar when the goal is switched off', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveTrainingGoal(20)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Daily goal' })
    await user.selectOptions(within(card).getByRole('combobox'), '0')

    expect(within(card).getByText('No daily goal set.')).toBeInTheDocument()
    expect(within(card).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(loadTrainingGoal()).toBe(0)
  })

  it('shows last accuracy and last practiced on due rows once practiced', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    const dueList = screen.getByRole('region', { name: 'Due now' })
    expect(within(dueList).getByText(/80% last accuracy · practiced today/)).toBeInTheDocument()
  })
})

describe('TodayScreen spot drill entry', () => {
  it('is hidden while no range describes a situation', () => {
    saveSavedRange(makeRange('a', 'Unlabelled'))
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    expect(screen.queryByRole('region', { name: 'Play the spot' })).toBeNull()
  })

  it('offers the drill at the format the library is written for', async () => {
    const user = userEvent.setup()
    const onPlaySpots = vi.fn()
    saveSavedRange({
      ...makeRange('a', 'BTN open'),
      metadata: { position: 'btn', actionType: 'open', tableSize: 'sixMax', stackDepthBb: 40 },
    })
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={onPlaySpots} onStartWorkout={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Play the spot' })
    expect(within(card).getByText(/1 of 65 spots covered/)).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Play' }))

    expect(onPlaySpots).toHaveBeenCalledWith({ tableSize: 'sixMax', stackDepthBb: 40 })
  })
})

describe('TodayScreen daily workout', () => {
  it('offers the composed workout and starts it', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange({
      ...makeRange('b', 'BTN open'),
      metadata: { position: 'btn', actionType: 'open' },
    })
    const onStartWorkout = vi.fn()
    render(
      <TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={onStartWorkout} />,
    )

    const card = screen.getByRole('region', { name: 'Daily workout' })
    expect(within(card).getByText(/\d+ hands · 2 reviews · free play · ~\d+ min/)).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Start workout' }))

    expect(onStartWorkout).toHaveBeenCalledTimes(1)
    const workout = onStartWorkout.mock.calls[0][0]
    expect(workout.segments.map((segment: { kind: string }) => segment.kind)).toEqual([
      'review',
      'freshSpots',
    ])
  })

  it('is hidden when there is nothing to plan', () => {
    saveSavedRange(makeRange('a', 'Unlabelled'))
    saveReviewState({
      rangeId: 'a',
      ease: 2.5,
      intervalDays: 7,
      dueAt: FUTURE,
      lastReviewedAt: TODAY,
    })
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    expect(screen.queryByRole('region', { name: 'Daily workout' })).toBeNull()
  })

  it('leads with the workout and demotes the plain review button', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Start workout' })).toHaveClass('primary')
    expect(screen.getByRole('button', { name: 'Start review' })).not.toHaveClass('primary')
  })
})

describe('TodayScreen workout done state', () => {
  it('flips the card to done for the rest of the day', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveTrainingGoal(20)
    recordWorkoutCompletion(TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Daily workout' })
    expect(within(card).getByText(/Done for today\. 0 of 20 hands/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull()
    // With the workout done, plain review is the primary action again.
    expect(screen.getByRole('button', { name: 'Start review' })).toHaveClass('primary')
  })

  it('re-offers the plan when the completion is from an earlier day', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordWorkoutCompletion('2026-01-05T09:00:00.000Z')
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument()
  })
})
