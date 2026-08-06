import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildPostflopScenario } from '../domain/postflopScenario'
import { PostflopPractice } from './PostflopPractice'

// AsKh on Kd7c2h facing a bet = top pair → heuristic suggests Raise.
function scenario(facing = 'villain bets pot') {
  return buildPostflopScenario({
    heroHand: 'AsKh',
    flop: 'Kd7c2h',
    potSize: 10,
    stackDepth: 100,
    facing,
  })
}

describe('PostflopPractice', () => {
  it('renders the hero hand, context, and decision buttons', () => {
    render(<PostflopPractice scenario={scenario()} onExit={vi.fn()} />)
    expect(screen.getByText(/As Kh/)).toBeInTheDocument()
    expect(screen.getByText(/villain bets pot/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Raise' })).toBeInTheDocument()
  })

  it('reports a match when choosing the suggested decision', async () => {
    render(<PostflopPractice scenario={scenario()} onExit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Raise' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Matches the heuristic/)
  })

  it('reports the suggestion and rationale when choosing another decision', async () => {
    render(<PostflopPractice scenario={scenario()} onExit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fold' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Differs from the heuristic/)
    expect(status).toHaveTextContent(/suggests/i)
    expect(status).toHaveTextContent(/value/i)
  })

  it('calls onExit from the back button', async () => {
    const onExit = vi.fn()
    render(<PostflopPractice scenario={scenario()} onExit={onExit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
