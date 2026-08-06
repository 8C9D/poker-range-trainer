import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiActionEditor } from './MultiActionEditor'
import { ALL_HANDS, type PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'

/** Stateful wrapper mirroring how a parent would own `handActions`. */
function Harness({ initial = {} }: { initial?: Record<PokerHand, RangeAction> }) {
  const [handActions, setHandActions] = useState<Record<PokerHand, RangeAction>>(initial)
  return (
    <MultiActionEditor
      handActions={handActions}
      rangeHands={ALL_HANDS}
      onSetHandAction={(hand, action) =>
        setHandActions((prev) => ({ ...prev, [hand]: action }))
      }
    />
  )
}

describe('MultiActionEditor', () => {
  it('renders the action palette and the grid', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Raise' })).toBeInTheDocument() // palette
    expect(screen.getByText('AA')).toBeInTheDocument() // grid cell
  })

  it('paints the selected action onto a clicked cell', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Default active action is Raise.
    await user.click(screen.getByText('AA'))
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')

    // Switch the active action to Fold and assign another hand.
    await user.click(screen.getByRole('button', { name: 'Fold' }))
    await user.click(screen.getByText('KK'))
    expect(screen.getByText('KK').getAttribute('data-action')).toBe('fold')
    // AA keeps its earlier assignment.
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')
  })

  it('shows per-action percentages for actions in use', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByText('AA')) // raise
    await user.click(screen.getByText('KK')) // raise

    const summary = within(screen.getByLabelText('Per-action percentages'))
    // 2 pairs -> 12 combos of 1326 -> 0.9%.
    expect(summary.getByText(/Raise: 0\.9%/)).toBeInTheDocument()
  })
})
