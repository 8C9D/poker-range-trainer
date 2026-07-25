import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressScreen } from './ProgressScreen'
import { saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

const TODAY = new Date().toISOString()

function makeRange(id: string, name: string): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('ProgressScreen', () => {
  it('renders the three overview tiles with grace-day streak copy', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} />)

    const tiles = screen.getByRole('region', { name: 'Training overview' })
    expect(within(tiles).getByText('1 day')).toBeInTheDocument()
    expect(within(tiles).getByText(/one rest day is forgiven/i)).toBeInTheDocument()
    expect(within(tiles).getByText('80%')).toBeInTheDocument()
    expect(within(tiles).getByText('10')).toBeInTheDocument()
  })

  it('draws seven bars with today emphasized', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 12, correctAnswers: 9 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} />)

    const chart = screen.getByRole('region', { name: 'Hands answered this week' })
    const days = within(chart).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[6]).toHaveClass('today')
    expect(days[6]).toHaveAccessibleName(/12 hands/)
  })

  it('summarizes library-wide analytics', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 6 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} />)

    const analytics = screen.getByRole('region', { name: 'Library analytics' })
    expect(analytics).toHaveTextContent('2 ranges practiced · 14 of 20 correct · 70% overall')
  })

  it('lists the weakest hands across ranges and drills them per range', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordHandAccuracy('a', [
      { hand: 'AKs', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ])
    recordHandAccuracy('b', [
      { hand: 'KK', attempts: 4, correct: 3, falsePositives: 1, falseNegatives: 0 },
    ])
    const onDrillWeakHands = vi.fn()
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} />)

    const weak = screen.getByRole('region', { name: 'Weakest hands' })
    const rows = within(weak).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('AKs')
    expect(rows[0]).toHaveTextContent('UTG open')
    expect(rows[0]).toHaveTextContent('25%')
    expect(rows[1]).toHaveTextContent('KK')

    await user.click(within(weak).getByRole('button', { name: 'Drill these' }))
    expect(onDrillWeakHands).toHaveBeenCalledTimes(1)
    const [queue, pools] = onDrillWeakHands.mock.calls[0]
    expect(queue.map((range: SavedRange) => range.id)).toEqual(['a', 'b'])
    expect(pools).toEqual({ a: ['AKs'], b: ['KK'] })
  })

  it('ranks leaks by hand type and drills a whole class', async () => {
    const user = userEvent.setup()
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordHandAccuracy('a', [
      { hand: '98s', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
      { hand: 'AA', attempts: 4, correct: 3, falsePositives: 1, falseNegatives: 0 },
    ])
    recordHandAccuracy('b', [
      { hand: '76s', attempts: 2, correct: 0, falsePositives: 0, falseNegatives: 2 },
    ])
    const onDrillWeakHands = vi.fn()
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} />)

    const leaks = screen.getByRole('region', { name: 'Leaks by hand type' })
    const rows = within(leaks).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Suited connectors')
    expect(rows[0]).toHaveTextContent('1/6 · 17%')
    expect(rows[0]).toHaveTextContent('98s, 76s')
    expect(rows[1]).toHaveTextContent('Premium pairs')

    await user.click(within(leaks).getByRole('button', { name: 'Drill Suited connectors' }))
    const [queue, pools] = onDrillWeakHands.mock.calls[0]
    expect(queue.map((range: SavedRange) => range.id)).toEqual(['a', 'b'])
    expect(pools).toEqual({ a: ['98s'], b: ['76s'] })
  })

  it('leaves out leaks whose range was deleted', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordHandAccuracy('gone', [
      { hand: '98s', attempts: 4, correct: 0, falsePositives: 0, falseNegatives: 4 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} />)

    const leaks = screen.getByRole('region', { name: 'Leaks by hand type' })
    expect(within(leaks).queryByText(/Suited connectors/)).not.toBeInTheDocument()
    expect(within(leaks).getByText(/hand types you miss most/)).toBeInTheDocument()
  })

  it('shows an empty state without recorded misses', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<ProgressScreen onDrillWeakHands={vi.fn()} />)
    expect(screen.getByText(/No recorded misses yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drill these' })).not.toBeInTheDocument()
  })
})
