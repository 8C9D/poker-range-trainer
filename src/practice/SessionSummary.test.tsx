import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionSummary, type SessionSummaryData } from './SessionSummary'

/**
 * The screen every session ends on. Its Enter shortcut is the part worth
 * pinning: it has to reach the primary action from the page, and it has to keep
 * its hands off a focused button, or tabbing to "Done" and pressing Enter would
 * fire "Next range" instead and drag the user into another drill.
 */
const BASE: SessionSummaryData = {
  totalQuestions: 20,
  correctAnswers: 17,
  accuracy: 85,
  deltaLine: null,
  streakLine: null,
}

describe('SessionSummary', () => {
  it('reports the score and omits the lines it has nothing to say about', () => {
    render(<SessionSummary data={BASE} hasNext={false} onNext={vi.fn()} onDone={vi.fn()} />)

    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('17 of 20 correct')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Session summary' })).toBeInTheDocument()
  })

  it('shows the delta, goal and streak lines when the run has them', () => {
    render(
      <SessionSummary
        data={{
          ...BASE,
          deltaLine: '+8 points on last time.',
          goalLine: '20 of 20 hands today.',
          streakLine: '4-day streak.',
        }}
        hasNext={false}
        onNext={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('+8 points on last time.')).toBeInTheDocument()
    expect(screen.getByText('20 of 20 hands today.')).toBeInTheDocument()
    expect(screen.getByText('4-day streak.')).toBeInTheDocument()
  })

  it('announces a failed save rather than leaving the run looking recorded', () => {
    render(
      <SessionSummary
        data={{ ...BASE, saveError: 'Could not save: storage is full.' }}
        hasNext={false}
        onNext={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save: storage is full.')
  })

  it('offers only Done when no range is queued behind this one', () => {
    render(<SessionSummary data={BASE} hasNext={false} onNext={vi.fn()} onDone={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next range' })).not.toBeInTheDocument()
  })

  it('takes Enter for the primary action from the page', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onDone = vi.fn()
    render(<SessionSummary data={BASE} hasNext onNext={onNext} onDone={onDone} />)

    await user.keyboard('{Enter}')

    expect(onNext).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('ends the session on Enter when nothing is queued', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<SessionSummary data={BASE} hasNext={false} onNext={vi.fn()} onDone={onDone} />)

    await user.keyboard('{Enter}')

    expect(onDone).toHaveBeenCalledOnce()
  })

  it('leaves a focused button its own Enter', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onDone = vi.fn()
    render(<SessionSummary data={BASE} hasNext onNext={onNext} onDone={onDone} />)

    screen.getByRole('button', { name: 'Done' }).focus()
    await user.keyboard('{Enter}')

    expect(onDone).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('draws the ring empty at 0% and full at 100%', () => {
    const { rerender, container } = render(
      <SessionSummary
        data={{ ...BASE, correctAnswers: 0, accuracy: 0 }}
        hasNext={false}
        onNext={vi.fn()}
        onDone={vi.fn()}
      />,
    )
    const arc = () => container.querySelector('.session-summary-ring-value')!
    const circumference = Number(arc().getAttribute('stroke-dasharray'))
    expect(circumference).toBeGreaterThan(0)
    // The ring animates up from empty, so a 0% run and the first frame of any
    // run both sit at a full offset — nothing of the arc is drawn.
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference)

    rerender(
      <SessionSummary
        data={{ ...BASE, correctAnswers: 20, accuracy: 100 }}
        hasNext={false}
        onNext={vi.fn()}
        onDone={vi.fn()}
      />,
    )
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
