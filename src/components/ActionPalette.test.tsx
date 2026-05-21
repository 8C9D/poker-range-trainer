import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionPalette } from './ActionPalette'

describe('ActionPalette', () => {
  it('renders a swatch for every action', () => {
    render(<ActionPalette selected="raise" onSelect={vi.fn()} />)
    for (const label of ['Fold', 'Call', 'Raise', '3-bet', '4-bet', 'Jam', 'Mixed']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the selected action as pressed and the rest unpressed', () => {
    render(<ActionPalette selected="raise" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Raise' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Fold' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelect with the chosen action', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ActionPalette selected="raise" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '3-bet' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('threeBet')
  })
})
