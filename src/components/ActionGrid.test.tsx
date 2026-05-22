import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionGrid } from './ActionGrid'
import type { PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'

describe('ActionGrid', () => {
  it('renders all 169 hands, unassigned by default', () => {
    render(<ActionGrid handActions={{}} onAssign={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(169)
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('none')
    expect(screen.getByText('22').getAttribute('data-action')).toBe('none')
  })

  it('exposes each cell\'s assigned action via data-action', () => {
    const handActions: Record<PokerHand, RangeAction> = { AA: 'raise', KK: 'fold' }
    render(<ActionGrid handActions={handActions} onAssign={vi.fn()} />)

    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')
    expect(screen.getByText('KK').getAttribute('data-action')).toBe('fold')
    expect(screen.getByText('QQ').getAttribute('data-action')).toBe('none')
  })

  it('calls onAssign with the clicked hand', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<ActionGrid handActions={{}} onAssign={onAssign} />)

    await user.click(screen.getByRole('button', { name: 'AKs' }))

    expect(onAssign).toHaveBeenCalledExactlyOnceWith('AKs')
  })
})
