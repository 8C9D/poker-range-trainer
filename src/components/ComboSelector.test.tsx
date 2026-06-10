import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComboSelector } from './ComboSelector'
import { allCombosForHand, toggleCombo } from '../domain/comboSelection'
import { comboKey } from '../domain/combos'

describe('ComboSelector', () => {
  it('renders one button per combo of the hand class (AKs = 4)', () => {
    render(<ComboSelector hand="AKs" selection={allCombosForHand('AKs')} onToggle={vi.fn()} />)
    expect(screen.getByLabelText('Combos for AKs').querySelectorAll('button')).toHaveLength(4)
    expect(screen.getByText('4/4 combos')).toBeInTheDocument()
  })

  it('reflects selection state via aria-pressed', () => {
    // Deselect AhKh, keep the rest on.
    const full = allCombosForHand('AKs')
    const ahkh = ['Ah', 'Kh'].map((c) => ({ rank: c[0], suit: c[1] }) as never)
    const selection = toggleCombo(full, ahkh)
    render(<ComboSelector hand="AKs" selection={selection} onToggle={vi.fn()} />)

    expect(screen.getByRole('button', { name: comboKey(ahkh) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('3/4 combos')).toBeInTheDocument()
  })

  it('fires onToggle with the clicked combo', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<ComboSelector hand="AKs" selection={allCombosForHand('AKs')} onToggle={onToggle} />)

    const ahkh = ['Ah', 'Kh'].map((c) => ({ rank: c[0], suit: c[1] }) as never)
    await user.click(screen.getByRole('button', { name: comboKey(ahkh) }))

    expect(onToggle).toHaveBeenCalledOnce()
    expect(comboKey(onToggle.mock.calls[0][0])).toBe(comboKey(ahkh))
  })
})
