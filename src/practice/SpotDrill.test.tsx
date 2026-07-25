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

    expect(screen.getByText('6-max, 100bb. Folded to you in the BTN.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.runAllTimers())
    fireEvent.click(screen.getByRole('button', { name: 'Defend' }))
    act(() => vi.runAllTimers())

    expect(onFinish).toHaveBeenCalledTimes(1)
    const grouped = onFinish.mock.calls[0][0]
    expect(Object.keys(grouped).sort()).toEqual(['BB defend vs CO', 'BTN open'])
    expect(grouped['BTN open']).toHaveLength(1)
    vi.useRealTimers()
  })

  it('reports the attempts answered so far when closed early', () => {
    const onFinish = renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onFinish).toHaveBeenCalledWith({ 'BTN open': [expect.objectContaining({ hand: 'AA' })] })
  })

  it('records nothing when closed before answering', () => {
    const onFinish = renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onFinish).toHaveBeenCalledWith({})
  })
})

describe('SpotDrill chained spots', () => {
  it('carries a correctly played hand into the covered follow-up spot', () => {
    vi.useFakeTimers()
    // random() === 0 deals the first covered spot (the BTN open) and AA, which is
    // in the range; the follow-up is the covered BTN-vs-3-bet chart.
    renderDrill({ ranges: [btnOpen, vsBbThreeBet], random: () => 0 })

    expect(screen.getByText('6-max, 100bb. Folded to you in the BTN.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.runAllTimers())

    expect(screen.getByText('Same hand — the action continues.')).toBeInTheDocument()
    expect(
      screen.getByText('6-max, 100bb. You are in the BTN facing a 3-bet from the BB.'),
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
