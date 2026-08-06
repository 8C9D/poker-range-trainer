import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayScreen } from './TodayScreen'
import { saveSavedRange } from '../storage/rangeStorage'
import { saveReviewState } from '../storage/reviewStateStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
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
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Get started' })
    expect(within(panel).getByRole('link', { name: 'Create a range' })).toHaveAttribute(
      'href',
      '#/library/new',
    )
    expect(within(panel).getByRole('link', { name: 'Open Library' })).toHaveAttribute(
      'href',
      '#/library',
    )
  })

  it('lists due ranges and starts a full review queue', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    const onStartReview = vi.fn()
    render(<TodayScreen onStartReview={onStartReview} onDrillWeakHands={vi.fn()} />)

    // Never-reviewed ranges are due; the CTA counts them.
    expect(screen.getByText(/2 ranges due/)).toBeInTheDocument()
    const dueList = screen.getByRole('region', { name: 'Due now' })
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
    render(<TodayScreen onStartReview={onStartReview} onDrillWeakHands={vi.fn()} />)

    const rows = screen.getAllByRole('button', { name: 'Review' })
    await user.click(rows[1])
    expect(onStartReview.mock.calls[0][0].map((r: SavedRange) => r.id)).toEqual(['b'])
  })

  it('excludes archived ranges from the due queue', () => {
    saveSavedRange({ ...makeRange('a', 'UTG open'), archived: true })
    saveSavedRange(makeRange('b', 'BTN open'))
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    expect(screen.getByText(/1 range due/)).toBeInTheDocument()
  })

  it('offers the next range early when nothing is due and nothing has gone wrong', async () => {
    const user = userEvent.setup()
    const onStartReview = vi.fn()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveReviewState({
      rangeId: 'a',
      ease: 2.5,
      intervalDays: 7,
      dueAt: FUTURE,
      lastReviewedAt: TODAY,
    })
    render(
      <TodayScreen
        onStartReview={onStartReview}
        onDrillWeakHands={vi.fn()}
      />,
    )

    const panel = screen.getByRole('region', { name: 'All caught up' })
    expect(within(panel).getByText(/Get ahead: UTG open comes round next/)).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Review early' }))

    expect(onStartReview.mock.calls[0][0].map((range: SavedRange) => range.id)).toEqual(['a'])
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument()
  })

  it('offers the weak hands when caught up, and drills exactly those', async () => {
    const user = userEvent.setup()
    const onDrillWeakHands = vi.fn()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveReviewState({
      rangeId: 'a',
      ease: 2.5,
      intervalDays: 7,
      dueAt: FUTURE,
      lastReviewedAt: TODAY,
    })
    recordHandAccuracy('a', [
      { hand: 'AA', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ])
    render(
      <TodayScreen
        onStartReview={vi.fn()}
        onDrillWeakHands={onDrillWeakHands}
      />,
    )

    const panel = screen.getByRole('region', { name: 'All caught up' })
    expect(within(panel).getByText(/Sharpen the 1 hand you play worst/)).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Drill weak hands' }))

    const [queue, pools] = onDrillWeakHands.mock.calls[0]
    expect(queue.map((range: SavedRange) => range.id)).toEqual(['a'])
    expect(pools).toEqual({ a: ['AA'] })
  })

  it('falls back to the library shortcut when it has nothing to suggest', () => {
    // A library with no schedule yet is never caught up, so the only way here is
    // a library the suggestion cannot speak for at all.
    saveSavedRange({ ...makeRange('a', 'UTG open'), archived: true })
    render(
      <TodayScreen
        onStartReview={vi.fn()}
        onDrillWeakHands={vi.fn()}
      />,
    )

    const panel = screen.getByRole('region', { name: 'All caught up' })
    expect(within(panel).getByRole('link', { name: 'Free practice' })).toHaveAttribute(
      'href',
      '#/library',
    )
  })

  it('shows the streak chip with grace-day copy once a streak exists', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    const chip = screen.getByTitle(/One rest day is forgiven/)
    expect(chip).toHaveTextContent('1 day')
  })

  it('summarizes the week in three tiles', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, TODAY)
    recordPracticeSessionHistory('b', { totalQuestions: 10, correctAnswers: 9 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    const tiles = screen.getByRole('region', { name: 'This week' })
    expect(within(tiles).getByText('20')).toBeInTheDocument()
    expect(within(tiles).getByText('75%')).toBeInTheDocument()
    expect(within(tiles).getByText('BTN open')).toBeInTheDocument()
  })

  it('does not let a deleted range replace the sharpest live range', () => {
    saveSavedRange(makeRange('live', 'UTG open'))
    recordPracticeSessionHistory('live', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSessionHistory('deleted', { totalQuestions: 10, correctAnswers: 10 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)

    const tiles = screen.getByRole('region', { name: 'This week' })
    expect(within(tiles).getByText('UTG open')).toBeInTheDocument()
  })

  it('tracks the daily goal and persists a change to it', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 12, correctAnswers: 9 }, TODAY)
    saveTrainingGoal(20)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Daily goal' })
    expect(within(card).getByText('12 of 20 hands — 8 to go.')).toBeInTheDocument()
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')

    await user.selectOptions(within(card).getByRole('combobox'), '10')
    expect(within(card).getByText('Goal met — 12 hands today.')).toBeInTheDocument()
    expect(loadTrainingGoal()).toBe(10)
  })

  it('reports a goal change the store refused instead of crashing', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveTrainingGoal(20)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const card = screen.getByRole('region', { name: 'Daily goal' })
    try {
      await user.selectOptions(within(card).getByRole('combobox'), '40')
    } finally {
      spy.mockRestore()
    }

    expect(within(card).getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    // The old target stands: the picker never claims a goal that was not saved.
    expect(within(card).getByText(/of 20 hands/)).toBeInTheDocument()
    expect(loadTrainingGoal()).toBe(20)
  })

  it('hides the progress bar when the goal is switched off', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveTrainingGoal(20)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Daily goal' })
    await user.selectOptions(within(card).getByRole('combobox'), '0')

    expect(within(card).getByText('No daily goal set.')).toBeInTheDocument()
    expect(within(card).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(loadTrainingGoal()).toBe(0)
  })

  it('shows last accuracy and last practiced on due rows once practiced', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    render(<TodayScreen onStartReview={vi.fn()} onDrillWeakHands={vi.fn()} />)
    const dueList = screen.getByRole('region', { name: 'Due now' })
    expect(within(dueList).getByText(/80% last accuracy · practiced today/)).toBeInTheDocument()
  })
})
