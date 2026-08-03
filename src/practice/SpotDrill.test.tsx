import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { SpotDrill } from './SpotDrill'
import type { RangeMetadata, SavedRange } from '../types/range'

function makeRange(name: string, metadata: RangeMetadata): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata,
  }
}

const btnOpen = makeRange('BTN open', { position: 'btn', actionType: 'open' })
const vsBbThreeBet = makeRange('BTN vs BB 3-bet', {
  position: 'btn',
  actionType: 'fourBet',
  versusPosition: 'bb',
})
const bbDefend = makeRange('BB defend vs CO', {
  position: 'bb',
  actionType: 'defend',
  versusPosition: 'co',
})

function renderDrill(props: Partial<Parameters<typeof SpotDrill>[0]> = {}) {
  const onFinish = vi.fn()
  render(
    <SpotDrill
      ranges={[btnOpen]}
      tableSize="sixMax"
      stackDepthBb={100}
      questionCount={2}
      onFinish={onFinish}
      random={() => 0}
      {...props}
    />,
  )
  return onFinish
}

describe('SpotDrill', () => {
  it('states the dealt spot and labels the answers with the range’s action', () => {
    renderDrill()

    expect(screen.getByText('6-max, 100bb. Folded to you on the BTN.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
  })

  it('holds a missed spot on screen until the user continues', () => {
    vi.useFakeTimers()
    // random 0 deals AA in the BTN open spot, so folding it is a miss.
    renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByText(/from “BTN open”/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText(/from “BTN open”/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.queryByText(/from “BTN open”/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeEnabled()
    vi.useRealTimers()
  })

  it('explains the empty state when the library covers no spot at this format', () => {
    renderDrill({ ranges: [], stackDepthBb: 100 })

    expect(screen.getByText(/None of your saved ranges covers a spot/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fold' })).not.toBeInTheDocument()
  })

  it('names the grading range in the feedback after an answer', () => {
    renderDrill()
    // random() === 0 always deals AA, which the range holds.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByText('Correct — open AA.')).toBeInTheDocument()
    expect(screen.getByText('That spot is your “BTN open”.')).toBeInTheDocument()
  })

  it('explains a miss and names the chart it came from', () => {
    renderDrill()
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))

    expect(screen.getByText(/AA is in this range/)).toBeInTheDocument()
    expect(screen.getByText(/from “BTN open”/)).toBeInTheDocument()
  })

  it('answers with arrow keys and ignores duplicate input during feedback', () => {
    const onFinish = renderDrill()

    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute(
      'aria-keyshortcuts',
      'ArrowRight',
    )
    expect(screen.getByRole('button', { name: 'Fold' })).toHaveAttribute(
      'aria-keyshortcuts',
      'ArrowLeft',
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Correct — open AA.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onFinish.mock.calls[0][0].bySpot).toEqual([
      { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 1, correct: 1 },
    ])
  })

  it('groups the finished attempts by the range that graded them', () => {
    vi.useFakeTimers()
    // The very first draw picks the first covered spot; everything after it picks
    // the last, so the two questions are graded by different ranges.
    let first = true
    const onFinish = renderDrill({
      ranges: [btnOpen, bbDefend],
      random: () => {
        if (first) {
          first = false
          return 0
        }
        return 0.99
      },
    })

    // Both answers are misses, so each holds its explanation until Next.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Defend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
    const { byRange, bySpot } = onFinish.mock.calls[0][0]
    expect(Object.keys(byRange).sort()).toEqual(['BB defend vs CO', 'BTN open'])
    expect(byRange['BTN open']).toHaveLength(1)
    // Both hands were drawn from the far end of the grid, so neither is in range
    // and both "play" answers are misses — one attempt recorded per spot.
    expect(bySpot).toEqual([
      { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 1, correct: 0 },
      { spotKey: 'sixMax|bb|facingOpen|co|100', attempts: 1, correct: 0 },
    ])
    vi.useRealTimers()
  })

  it('reports the attempts answered so far when closed early', () => {
    const onFinish = renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onFinish).toHaveBeenCalledWith({
      byRange: { 'BTN open': [expect.objectContaining({ hand: 'AA' })] },
      bySpot: [{ spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 1, correct: 1 }],
    })
  })

  it('records nothing when closed before answering', () => {
    const onFinish = renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onFinish).toHaveBeenCalledWith({ byRange: {}, bySpot: [] })
  })
})

describe('SpotDrill chained spots', () => {
  it('carries a correctly played hand into the covered follow-up spot', () => {
    vi.useFakeTimers()
    // random() === 0 deals the first covered spot (the BTN open) and AA, which is
    // in the range; the follow-up is the covered BTN-vs-3-bet chart.
    renderDrill({ ranges: [btnOpen, vsBbThreeBet], random: () => 0 })

    expect(screen.getByText('6-max, 100bb. Folded to you on the BTN.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.runAllTimers())

    expect(screen.getByText('Same hand — the action continues.')).toBeInTheDocument()
    expect(
      screen.getByText('6-max, 100bb. You are on the BTN facing a 3-bet from the BB.'),
    ).toBeInTheDocument()
    // Same hand, still AA.
    expect(screen.getByTestId('drill-hand')).toHaveTextContent('AA')
    vi.useRealTimers()
  })

  it('ends the hand on a fold and deals a fresh spot', () => {
    vi.useFakeTimers()
    renderDrill({ ranges: [btnOpen, vsBbThreeBet], random: () => 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    act(() => vi.runAllTimers())

    expect(screen.queryByText('Same hand — the action continues.')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not chain when the library has no range for what comes next', () => {
    vi.useFakeTimers()
    renderDrill({ ranges: [btnOpen], random: () => 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.runAllTimers())

    expect(screen.queryByText('Same hand — the action continues.')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
