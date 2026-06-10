import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComboBlockerDrill } from './ComboBlockerDrill'

describe('ComboBlockerDrill', () => {
  it('shows the remaining count for a valid board', () => {
    // AKs has 4 combos; the Ks blocks AsKs → 3 remain.
    render(<ComboBlockerDrill hands={['AKs']} board="KsQh2d" onExit={vi.fn()} />)
    expect(screen.getByText('3 combos available')).toBeInTheDocument()
  })

  it('deals a combo not blocked by the board', async () => {
    const user = userEvent.setup()
    render(<ComboBlockerDrill hands={['AKs']} board="KsQh2d" onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Deal a combo' }))

    const combo = screen.getByLabelText('Dealt combo')
    expect(combo).toBeInTheDocument()
    // The board's Ks must not appear in the dealt combo.
    expect(combo.textContent).not.toContain('Ks')
  })

  it('shows an empty message when every combo is blocked', () => {
    render(<ComboBlockerDrill hands={['AA']} board="AsAhAdAc" onExit={vi.fn()} />)
    expect(screen.getByText(/every combo is blocked/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deal a combo' })).not.toBeInTheDocument()
  })

  it('shows an inline error for an invalid board', () => {
    render(<ComboBlockerDrill hands={['AKs']} board="ZZ" onExit={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
