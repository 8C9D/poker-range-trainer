import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressScreen } from './ProgressScreen'
import { saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import { recordSpotAccuracy } from '../storage/spotAccuracyStorage'
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
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const tiles = screen.getByRole('region', { name: 'Training overview' })
    expect(within(tiles).getByText('1 day')).toBeInTheDocument()
    expect(within(tiles).getByText(/one rest day is forgiven/i)).toBeInTheDocument()
    expect(within(tiles).getByText('80%')).toBeInTheDocument()
    expect(within(tiles).getByText('10')).toBeInTheDocument()
  })

  it('draws seven bars with today emphasized', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 12, correctAnswers: 9 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const chart = screen.getByRole('region', { name: 'Hands answered this week' })
    const days = within(chart).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[6]).toHaveClass('today')
    expect(days[6]).toHaveAccessibleName(/12 hands/)
    // The count is on the chart, not just in the accessible name: a bare bar
    // gives no scale to read the week against.
    expect(within(days[6]).getByText('12')).toBeInTheDocument()
    // Days with nothing recorded stay unlabelled rather than showing a row of zeros.
    expect(within(days[0]).queryByText('0')).toBeNull()
  })

  it('counts a single hand in the singular on both charts', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 1, correctAnswers: 0 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    // The bars carry no text of their own, so these labels are the whole chart
    // to a screen reader — "1 hands" is the only wording it gets.
    const week = screen.getByRole('region', { name: 'Hands answered this week' })
    expect(within(week).getAllByRole('listitem')[6]).toHaveAccessibleName(/: 1 hand$/)
    const trend = screen.getByRole('region', { name: 'Accuracy by week' })
    expect(within(trend).getAllByRole('listitem')[7]).toHaveAccessibleName(/over 1 hand$/)
  })

  it('explains the weekly chart instead of drawing an empty one', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    // Seven zero-height bars are decoration; every sibling card explains itself
    // when it has nothing to show, and this one now does too.
    const chart = screen.getByRole('region', { name: 'Hands answered this week' })
    expect(within(chart).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(chart).getByText(/Answer some hands/)).toBeInTheDocument()
  })

  it('charts accuracy by week once there is practice to chart', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 7 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const chart = screen.getByRole('region', { name: 'Accuracy by week' })
    const weeks = within(chart).getAllByRole('listitem')
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toHaveClass('today')
    expect(weeks[7]).toHaveAccessibleName(/70% over 10 hands/)
    expect(within(weeks[7]).getByText('70%')).toBeInTheDocument()
    // A week with no practice stays in the series, unlabelled.
    expect(weeks[0]).toHaveAccessibleName(/no practice/)
  })

  it('explains the accuracy trend before there is any practice', () => {
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const chart = screen.getByRole('region', { name: 'Accuracy by week' })
    expect(within(chart).getByText(/your accuracy trend will show up here/)).toBeInTheDocument()
    expect(within(chart).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('summarizes library-wide analytics', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    saveSavedRange(makeRange('b', 'BTN open'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 6 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const analytics = screen.getByRole('region', { name: 'Library analytics' })
    expect(analytics).toHaveTextContent('2 ranges practiced · 14 of 20 correct · 70% overall')
  })

  it('explains the library summary instead of reporting a row of zeros', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const analytics = screen.getByRole('region', { name: 'Library analytics' })
    expect(analytics).not.toHaveTextContent('0 ranges practiced')
    expect(within(analytics).getByText(/how your library is going/)).toBeInTheDocument()
  })

  it('leaves deleted ranges out of library analytics', () => {
    saveSavedRange(makeRange('live', 'UTG open'))
    recordPracticeSession('live', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSession('deleted', { totalQuestions: 20, correctAnswers: 20 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const analytics = screen.getByRole('region', { name: 'Library analytics' })
    expect(analytics).toHaveTextContent('1 range practiced · 8 of 10 correct · 80% overall')
  })

  it('leaves a deleted range out of the volume and accuracy figures too', () => {
    // The analytics tile was already scoped to the live library while the charts
    // were not, so one screen could report 40 hands this week at 38% next to
    // "0 hands answered all-time".
    saveSavedRange(makeRange('live', 'UTG open'))
    recordPracticeSession('live', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSessionHistory('live', { totalQuestions: 10, correctAnswers: 8 }, TODAY)
    recordPracticeSessionHistory('deleted', { totalQuestions: 30, correctAnswers: 3 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const tiles = screen.getByRole('region', { name: 'Training overview' })
    expect(within(tiles).getByText('80%')).toBeInTheDocument()
    expect(within(tiles).getByText('10')).toBeInTheDocument()

    const chart = screen.getByRole('region', { name: 'Hands answered this week' })
    expect(within(chart).getAllByRole('listitem')[6]).toHaveAccessibleName(/10 hands/)

    const trend = screen.getByRole('region', { name: 'Accuracy by week' })
    expect(within(trend).getAllByRole('listitem')[7]).toHaveAccessibleName(/80% over 10 hands/)
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
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} onDrillSpot={vi.fn()} />)

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

  it('keeps a live leak in the table when orphaned records outrank it', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    // Ten weaker records for a range that is gone — enough to fill the report's
    // cap on their own. Scoped after ranking, they would take every slot and the
    // live leak below would vanish from a table that still says "Weakest hands".
    recordHandAccuracy(
      'deleted',
      ['22', '32s', '42s', '52s', '62s', '72s', '82s', '92s', 'T2s', 'J2s'].map((hand) => ({
        hand,
        attempts: 6,
        correct: 0,
        falsePositives: 0,
        falseNegatives: 6,
      })),
    )
    recordHandAccuracy('a', [
      { hand: 'AKs', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const weak = screen.getByRole('region', { name: 'Weakest hands' })
    const rows = within(weak).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('AKs')
    expect(rows[0]).toHaveTextContent('UTG open')
  })

  it('names which way the misses lean and which seats lean hardest', () => {
    saveSavedRange({ ...makeRange('a', 'UTG open'), metadata: { position: 'utg' } })
    saveSavedRange({ ...makeRange('b', 'BB defend'), metadata: { position: 'bb' } })
    recordHandAccuracy('a', [
      { hand: 'T8s', attempts: 8, correct: 0, falsePositives: 7, falseNegatives: 1 },
    ])
    recordHandAccuracy('b', [
      { hand: 'K4o', attempts: 8, correct: 0, falsePositives: 0, falseNegatives: 8 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Which way you miss' })
    // 7 loose to 9 tight overall — under the 60% cutoff, so no direction is claimed.
    expect(within(card).getByText(/split evenly/i)).toBeInTheDocument()
    expect(within(card).getByText('7 played too many · 9 folded too many')).toBeInTheDocument()
    expect(within(card).getByRole('img')).toHaveAccessibleName(
      '7 of 16 misses played a hand the chart folds',
    )
    // Each seat leans decisively even though the library as a whole does not.
    const seats = within(card).getAllByRole('listitem')
    expect(seats[0]).toHaveTextContent('BB folds too many hands (8 of 8 misses)')
    expect(seats[1]).toHaveTextContent('UTG plays too many hands (7 of 8 misses)')
  })

  it('waits for enough misses before calling a direction', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordHandAccuracy('a', [
      { hand: 'AKs', attempts: 4, correct: 1, falsePositives: 3, falseNegatives: 0 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Which way you miss' })
    expect(within(card).getByText(/practice a little more/i)).toBeInTheDocument()
    // The counts are the claim; showing them under "not enough yet" contradicts it.
    expect(within(card).queryByText(/played too many/)).toBeNull()
  })

  it('leaves a deleted range out of the lean', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    recordHandAccuracy('deleted', [
      { hand: '72o', attempts: 9, correct: 0, falsePositives: 9, falseNegatives: 0 },
    ])
    recordHandAccuracy('a', [
      { hand: 'AKs', attempts: 6, correct: 0, falsePositives: 0, falseNegatives: 6 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Which way you miss' })
    expect(within(card).getByText(/lean tight/i)).toBeInTheDocument()
    expect(within(card).getByText(/0 played too many · 6 folded too many/)).toBeInTheDocument()
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
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} onDrillSpot={vi.fn()} />)

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
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const leaks = screen.getByRole('region', { name: 'Leaks by hand type' })
    expect(within(leaks).queryByText(/Suited connectors/)).not.toBeInTheDocument()
    expect(within(leaks).getByText(/hand types you miss most/)).toBeInTheDocument()
  })

  it('shows an empty state without recorded misses', () => {
    saveSavedRange(makeRange('a', 'UTG open'))
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)
    expect(screen.getByText(/No recorded misses yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drill these' })).not.toBeInTheDocument()
  })
})

describe('ProgressScreen leak breakdown', () => {
  function seedRange(id: string, name: string, metadata: SavedRange['metadata']) {
    saveSavedRange({ ...makeRange(id, name), metadata })
  }

  it('explains the empty state when no range records a seat or action', () => {
    saveSavedRange(makeRange('a', 'Unlabelled'))
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 5 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Accuracy by seat and action' })
    expect(within(card).getByText(/which seats/i)).toBeInTheDocument()
  })

  it('ranks the weakest seat and action first', () => {
    seedRange('a', 'BTN open', { position: 'btn', actionType: 'open' })
    seedRange('b', 'BB defend', { position: 'bb', actionType: 'defend' })
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 9 }, TODAY)
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 3 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Accuracy by seat and action' })
    const rows = within(card).getAllByRole('listitem')
    // Two columns: seats (BB 30%, BTN 90%) then actions (Defend 30%, Open 90%).
    expect(rows.map((row) => row.textContent)).toEqual([
      'BB30%Drill',
      'BTN90%Drill',
      'Defend30%Drill',
      'Open90%Drill',
    ])
  })

  it('drills the charts behind a weak seat, each in full', async () => {
    const user = userEvent.setup()
    const onDrillWeakHands = vi.fn()
    seedRange('a', 'BB defend vs BTN', { position: 'bb', actionType: 'defend' })
    seedRange('b', 'BB defend vs CO', { position: 'bb', actionType: 'defend' })
    seedRange('c', 'BTN open', { position: 'btn', actionType: 'open' })
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 3 }, TODAY)
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 4 }, TODAY)
    recordPracticeSession('c', { totalQuestions: 10, correctAnswers: 9 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Accuracy by seat and action' })
    await user.click(within(card).getByRole('button', { name: 'Drill BB' }))

    const [queue, pools] = onDrillWeakHands.mock.calls[0]
    expect(queue.map((range: SavedRange) => range.id)).toEqual(['a', 'b'])
    // No pools: the situation is what is weak, so each chart is drilled whole.
    expect(pools).toEqual({})
  })

  it('drills by action independently of the seat cut', async () => {
    const user = userEvent.setup()
    const onDrillWeakHands = vi.fn()
    seedRange('a', 'BB defend', { position: 'bb', actionType: 'defend' })
    seedRange('b', 'BTN open', { position: 'btn', actionType: 'open' })
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 3 }, TODAY)
    recordPracticeSession('b', { totalQuestions: 10, correctAnswers: 9 }, TODAY)
    render(<ProgressScreen onDrillWeakHands={onDrillWeakHands} onDrillSpot={vi.fn()} />)

    const card = screen.getByRole('region', { name: 'Accuracy by seat and action' })
    await user.click(within(card).getByRole('button', { name: 'Drill Open' }))

    const [queue] = onDrillWeakHands.mock.calls[0]
    expect(queue.map((range: SavedRange) => range.id)).toEqual(['b'])
  })
})

describe('ProgressScreen weakest spots', () => {
  const BB_VS_CO = 'sixMax|bb|facingOpen|co|100'

  it('is hidden until a spot has enough recorded answers', () => {
    recordSpotAccuracy([{ spotKey: BB_VS_CO, attempts: 4, correct: 1 }])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    expect(screen.queryByRole('region', { name: 'Weakest spots' })).toBeNull()
  })

  it('describes the weakest spots and drills one', async () => {
    const user = userEvent.setup()
    const onDrillSpot = vi.fn()
    saveSavedRange({
      ...makeRange('bb', 'BB defend'),
      metadata: { position: 'bb', actionType: 'defend', versusPosition: 'co' },
    })
    saveSavedRange({
      ...makeRange('btn', 'BTN open'),
      metadata: { position: 'btn', actionType: 'open' },
    })
    recordSpotAccuracy([
      { spotKey: BB_VS_CO, attempts: 10, correct: 3 },
      { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 10, correct: 9 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={onDrillSpot} />)

    const card = screen.getByRole('region', { name: 'Weakest spots' })
    const rows = within(card).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('6-max, 100bb. You are in the BB facing an open from the CO.')
    expect(rows[0]).toHaveTextContent('3/10 · 30%')

    await user.click(within(rows[0]).getByRole('button', { name: /^Drill/ }))
    expect(onDrillSpot).toHaveBeenCalledWith({
      tableSize: 'sixMax',
      position: 'bb',
      situation: 'facingOpen',
      versusPosition: 'co',
      stackDepthBb: 100,
    })
  })

  it('hides a recorded spot after its covering range is deleted', () => {
    recordSpotAccuracy([{ spotKey: BB_VS_CO, attempts: 10, correct: 2 }])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    expect(screen.queryByRole('region', { name: 'Weakest spots' })).toBeNull()
  })
})
