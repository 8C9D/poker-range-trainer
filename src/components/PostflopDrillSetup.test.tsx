import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostflopDrillSetup } from './PostflopDrillSetup'
import { formatCard } from '../domain/cards'
import { isFacingAggression, POSTFLOP_FACINGS } from '../domain/postflopScenario'

async function fillValidScenario(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Your hand'), 'AsKh')
  await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
}

describe('PostflopDrillSetup', () => {
  it('builds a scenario from the form and hands it over', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<PostflopDrillSetup onStart={onStart} onExit={vi.fn()} />)

    await fillValidScenario(user)
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    const scenario = onStart.mock.calls[0][0]
    expect(scenario.heroHand.map(formatCard)).toEqual(['As', 'Kh'])
    expect(scenario.flop.map(formatCard)).toEqual(['Kd', '7c', '2h'])
    expect(scenario.potSize).toBe(10)
    expect(scenario.stackDepth).toBe(100)
  })

  it('reports a malformed hand instead of starting', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<PostflopDrillSetup onStart={onStart} onExit={vi.fn()} />)

    await user.type(screen.getByLabelText('Your hand'), 'As')
    await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/two cards/)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('reports a card used twice across hand and board', async () => {
    const user = userEvent.setup()
    render(<PostflopDrillSetup onStart={vi.fn()} onExit={vi.fn()} />)

    await user.type(screen.getByLabelText('Your hand'), 'KdKh')
    await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Duplicate card/)
  })

  it('clears the error once a corrected scenario starts', async () => {
    const user = userEvent.setup()
    render(<PostflopDrillSetup onStart={vi.fn()} onExit={vi.fn()} />)

    await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your hand'), 'AsKh')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers the actions the drill can read, not a free-text box', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<PostflopDrillSetup onStart={onStart} onExit={vi.fn()} />)

    // Typed prose the heuristic cannot parse would silently flip its advice, so
    // the only phrasings on offer are ones it reads back correctly.
    const facing = screen.getByLabelText('Facing')
    expect(facing.tagName).toBe('SELECT')
    for (const option of POSTFLOP_FACINGS) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    }

    await fillValidScenario(user)
    await user.selectOptions(facing, 'villain c-bets')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    const scenario = onStart.mock.calls[0][0]
    expect(scenario.facing).toBe('villain c-bets')
    expect(isFacingAggression(scenario)).toBe(true)
  })

  it('leaves the setup on request', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<PostflopDrillSetup onStart={vi.fn()} onExit={onExit} />)

    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
