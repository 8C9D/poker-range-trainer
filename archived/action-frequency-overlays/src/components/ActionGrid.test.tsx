import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionGrid } from './ActionGrid'
import { ALL_HANDS, type PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'

// Most cases are about the grid itself, so they hand it a range that holds
// every hand; the out-of-range behaviour has its own case at the end.
const everyHand = ALL_HANDS

describe('ActionGrid', () => {
  it('names the grid and says how to move through it', () => {
    render(<ActionGrid handActions={{}} rangeHands={everyHand} onAssign={vi.fn()} />)

    // Tab lands on one cell out of 169 inside an unnamed box: without a name
    // there is nothing to say what was entered, and without the description
    // nothing to say the arrow keys are what moves within it.
    const grid = screen.getByRole('group', { name: 'Starting hand action grid' })
    expect(grid).toHaveAccessibleDescription(/arrow keys to move between hands/i)
  })

  it('renders all 169 hands, unassigned by default', () => {
    render(<ActionGrid handActions={{}} rangeHands={everyHand} onAssign={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(169)
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('none')
    expect(screen.getByText('22').getAttribute('data-action')).toBe('none')
  })

  it('exposes each cell\'s assigned action via data-action', () => {
    const handActions: Record<PokerHand, RangeAction> = { AA: 'raise', KK: 'fold' }
    render(<ActionGrid handActions={handActions} rangeHands={everyHand} onAssign={vi.fn()} />)

    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')
    expect(screen.getByText('KK').getAttribute('data-action')).toBe('fold')
    expect(screen.getByText('QQ').getAttribute('data-action')).toBe('none')
  })

  it('calls onAssign with the clicked hand', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<ActionGrid handActions={{}} rangeHands={everyHand} onAssign={onAssign} />)

    await user.click(screen.getByText('AKs'))

    expect(onAssign).toHaveBeenCalledExactlyOnceWith('AKs')
  })

  it('names each cell with its hand and action for assistive tech', () => {
    render(<ActionGrid handActions={{ AA: 'raise' }} rangeHands={everyHand} onAssign={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'AA: Raise' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKs: unassigned' })).toBeInTheDocument()
  })

  it('shows a hand outside the range as out, and refuses to assign it', async () => {
    // `hands` is the membership list, so an action on a hand the range does not
    // hold is inert: the quiz skips it and the export does not colour it. The
    // grid used to paint it anyway, promising something no drill honoured.
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(
      <ActionGrid
        handActions={{ AA: 'raise', QQ: 'threeBet' }}
        rangeHands={['AA', 'KK']}
        onAssign={onAssign}
      />,
    )

    expect(screen.getByRole('button', { name: 'QQ: not in this range' })).toBeDisabled()
    expect(screen.getByText('QQ').getAttribute('data-action')).toBe('none')
    expect(screen.getByRole('button', { name: 'AA: Raise' })).toBeEnabled()

    await user.click(screen.getByText('QQ'))
    expect(onAssign).not.toHaveBeenCalled()
  })

  it('holds one tab stop and moves it with the arrow keys', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<ActionGrid handActions={{}} rangeHands={everyHand} onAssign={onAssign} />)

    expect(screen.getAllByRole('button').filter((cell) => cell.tabIndex === 0)).toHaveLength(1)

    screen.getByText('AA').focus()
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}')

    expect(screen.getByText('KK')).toHaveFocus()
    expect(onAssign).toHaveBeenCalledExactlyOnceWith('KK')
  })
})
