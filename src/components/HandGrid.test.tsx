import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandGrid } from './HandGrid'
import App from '../App'
import type { PokerHand } from '../domain/pokerHands'

describe('HandGrid', () => {
  it('renders all 169 starting hands as buttons', () => {
    render(<HandGrid selected={new Set<PokerHand>()} onToggle={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(169)
  })

  it('shows pairs, suited, and offsuit hands in standard notation', () => {
    render(<HandGrid selected={new Set<PokerHand>()} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'AA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22' })).toBeInTheDocument()
  })

  it('marks only the hands in the selected set as pressed', () => {
    render(<HandGrid selected={new Set<PokerHand>(['AA'])} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'KK' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle with the clicked hand', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<HandGrid selected={new Set<PokerHand>()} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: 'AKs' }))

    expect(onToggle).toHaveBeenCalledExactlyOnceWith('AKs')
  })
})

describe('App range summary', () => {
  it('starts with an empty selection', () => {
    render(<App />)
    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    expect(screen.getByText('0 combos')).toBeInTheDocument()
    expect(screen.getByText('0.0% of all hands')).toBeInTheDocument()
  })

  it('toggles a hand selected and unselected on repeated clicks', async () => {
    const user = userEvent.setup()
    render(<App />)
    const aa = screen.getByRole('button', { name: 'AA' })

    expect(aa).toHaveAttribute('aria-pressed', 'false')
    await user.click(aa)
    expect(aa).toHaveAttribute('aria-pressed', 'true')
    await user.click(aa)
    expect(aa).toHaveAttribute('aria-pressed', 'false')
  })

  it('updates the combo count across pair, suited, and offsuit selections', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' })) // pair: +6
    expect(screen.getByText('6 combos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'AKs' })) // suited: +4
    expect(screen.getByText('10 combos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'AKo' })) // offsuit: +12
    expect(screen.getByText('22 combos')).toBeInTheDocument()
  })

  it('updates the range percentage after selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('0.0% of all hands')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'AA' }))

    // 6 of 1326 combos -> 0.5%
    const expected = ((6 / 1326) * 100).toFixed(1)
    expect(screen.getByText(`${expected}% of all hands`)).toBeInTheDocument()
  })
})
