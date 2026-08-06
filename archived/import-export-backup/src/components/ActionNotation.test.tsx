import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionNotation } from './ActionNotation'
import type { PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'

function currentActions() {
  return screen.getByLabelText('Current actions')
}

function notationInput() {
  return screen.getByLabelText('Paste or type action notation')
}

function applyButton() {
  return screen.getByRole('button', { name: 'Apply Action Notation' })
}

describe('ActionNotation', () => {
  it('shows the current action chart as grouped notation', () => {
    const handActions: Record<PokerHand, RangeAction> = {
      AA: 'raise',
      KK: 'raise',
      AKs: 'threeBet',
    }
    render(<ActionNotation handActions={handActions} onReplaceActions={vi.fn()} />)

    expect(currentActions()).toHaveValue('Raise: AA, KK\n3-bet: AKs')
  })

  it('applies valid action notation and reports the parsed map', async () => {
    const user = userEvent.setup()
    const onReplaceActions = vi.fn()
    render(<ActionNotation handActions={{}} onReplaceActions={onReplaceActions} />)

    await user.type(notationInput(), 'Raise: AA, KK')
    await user.click(applyButton())

    expect(onReplaceActions).toHaveBeenCalledWith({ AA: 'raise', KK: 'raise' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error and does not replace actions for invalid notation', async () => {
    const user = userEvent.setup()
    const onReplaceActions = vi.fn()
    render(<ActionNotation handActions={{}} onReplaceActions={onReplaceActions} />)

    await user.type(notationInput(), 'Limp: AA')
    await user.click(applyButton())

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onReplaceActions).not.toHaveBeenCalled()
  })
})
