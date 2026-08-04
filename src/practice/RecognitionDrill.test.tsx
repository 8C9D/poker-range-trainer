import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { RecognitionDrill } from './RecognitionDrill'
import { DRILL_QUESTION_COUNT, HIT_DWELL_MS } from './drillPacing'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const RANGE: SavedRange = {
  id: 'r1',
  name: 'UTG open',
  hands: ['AA', 'KK'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: { position: 'utg', stackDepthBb: 100, actionType: 'open' },
}

function currentHand() {
  return screen.getByTestId('drill-hand').textContent
}

describe('RecognitionDrill', () => {
  it('shows the scenario line, cards, and fixed action-verb answers', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )
    expect(screen.getByText('You are UTG, 100bb. First to act — open or fold.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
    // A pair deals two cards of the same rank with different suits.
    const cards = screen.getByTestId('playing-cards').querySelectorAll('.playing-card')
    expect(cards).toHaveLength(2)
    expect(currentHand()).toBe('AA')
  })

  it('speaks each deal: named cards in a region that announces the next hand', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )

    // Suits are drawn as glyphs, so each face carries its own name or the
    // reader hears two bare ranks and cannot tell suited from offsuit.
    const named = screen
      .getByTestId('playing-cards')
      .querySelectorAll('[role="img"][aria-label]')
    expect(named).toHaveLength(2)
    expect(named[0].getAttribute('aria-label')).toMatch(/^A of (spades|hearts|diamonds|clubs)$/)

    // Answering announces the feedback; the hand itself has to announce the
    // next question, or the drill goes silent after the first answer.
    expect(screen.getByTestId('drill-hand')).toHaveAttribute('aria-live', 'polite')
  })

  it('runs the weakness variant from an empty history and scores an answer', () => {
    render(
      <RecognitionDrill range={RANGE} variant="weakness" onFinish={vi.fn()} random={() => 0.5} />,
    )
    // With no prior attempts the weighted draw still deals a real hand.
    expect(currentHand()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    // The answer scored: 88 is out of this range, so the miss hands over to Next.
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('holds a miss until the user continues, however long the dwell would have been', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )
    // AA is in range; answering Fold is a miss with an explanation.
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByText('AA is in this range — open it.')).toBeInTheDocument()
    // The answers give way to a single Next; no timer will move this on.
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('AA is in this range — open it.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.queryByText('AA is in this range — open it.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled()
  })

  it('hands back the user’s own note on a missed hand, and nothing on a hit', () => {
    const noted: SavedRange = { ...RANGE, handNotes: { AA: 'Only 4-bet vs a nit.' } }
    render(
      <RecognitionDrill range={noted} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByText('Your note: Only 4-bet vs a nit.')).toBeInTheDocument()

    // Playing it correctly next time needs no reminder.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.queryByText(/Your note:/)).not.toBeInTheDocument()
  })

  it('says nothing about a missed hand the user never noted', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))

    expect(screen.queryByText(/Your note:/)).not.toBeInTheDocument()
  })

  it('continues a held miss on Enter', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.queryByText('AA is in this range — open it.')).not.toBeInTheDocument()
  })

  it('keeps the arrow keys as answers while a miss is held', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))

    // A fast run of answer presses must not blow past the explanation.
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(screen.getByText('AA is in this range — open it.')).toBeInTheDocument()
  })

  it('explains where a missed hand sits in the range, but not after a hit', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(
      screen.getByText(/AA is in: this range plays 2 of 4 premium pairs/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.queryByText(/premium pairs/)).not.toBeInTheDocument()
  })

  it('advances the progress bar and finishes after the question count', () => {
    const onFinish = vi.fn()
    render(
      <RecognitionDrill
        range={RANGE}
        variant="standard"
        handPool={['AA']}
        questionCount={2}
        onFinish={onFinish}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.advanceTimersByTime(HIT_DWELL_MS))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.advanceTimersByTime(HIT_DWELL_MS))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toHaveLength(2)
    expect(onFinish.mock.calls[0][0][0].correct).toBe(true)
  })

  it('reports the answered attempts when closed early', () => {
    const onFinish = vi.fn()
    render(
      <RecognitionDrill
        range={RANGE}
        variant="standard"
        handPool={['AA']}
        onFinish={onFinish}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toHaveLength(1)
  })

  it('answers by swipe like the buttons', () => {
    render(
      <RecognitionDrill range={RANGE} variant="standard" handPool={['AA']} onFinish={vi.fn()} />,
    )
    const area = screen.getByTestId('playing-cards').parentElement!
    fireEvent.pointerDown(area, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 300, clientY: 100 })
    // Swipe right = the action verb (correct for AA).
    expect(screen.getByText('Correct — open AA.')).toBeInTheDocument()
  })

  it('answers with arrow keys and ignores duplicate input during feedback', () => {
    const onFinish = vi.fn()
    render(
      <RecognitionDrill
        range={RANGE}
        variant="standard"
        handPool={['AA']}
        onFinish={onFinish}
      />,
    )

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
    expect(onFinish.mock.calls[0][0]).toHaveLength(1)
    expect(onFinish.mock.calls[0][0][0].userAnsweredInRange).toBe(true)
  })

  it('uses the full question count by default', () => {
    expect(DRILL_QUESTION_COUNT).toBe(20)
  })

  it('ends a timed drill when the clock runs out', () => {
    const onFinish = vi.fn()
    render(
      <RecognitionDrill
        range={RANGE}
        variant="timed"
        durationSeconds={30}
        handPool={['AA']}
        onFinish={onFinish}
      />,
    )
    expect(screen.getByText('30s left')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    act(() => vi.advanceTimersByTime(31_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toHaveLength(1)
  })
})
