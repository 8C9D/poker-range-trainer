import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandGrid } from './HandGrid'
import App from '../App'
import type { PokerHand } from '../domain/pokerHands'

// The App-level cases exercise the editor through the new-range page.
beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/library/new'
})

/**
 * Stateful wrapper so gestures are reflected back through `selected` and become
 * visible as `aria-pressed`, mirroring how App owns the selection set.
 */
function Harness({ initial = [] }: { initial?: PokerHand[] }) {
  const [selected, setSelected] = useState<Set<PokerHand>>(() => new Set(initial))

  function onSetSelected(hand: PokerHand, shouldSelect: boolean) {
    setSelected((prev) => {
      if (prev.has(hand) === shouldSelect) return prev
      const next = new Set(prev)
      if (shouldSelect) {
        next.add(hand)
      } else {
        next.delete(hand)
      }
      return next
    })
  }

  return <HandGrid selected={selected} onSetSelected={onSetSelected} />
}

describe('HandGrid rendering', () => {
  it('renders all 169 starting hands as buttons', () => {
    render(<HandGrid selected={new Set<PokerHand>()} onSetSelected={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(169)
  })

  it('shows pairs, suited, and offsuit hands in standard notation', () => {
    render(<HandGrid selected={new Set<PokerHand>()} onSetSelected={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'AA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22' })).toBeInTheDocument()
  })

  it('marks only the hands in the selected set as pressed', () => {
    render(<HandGrid selected={new Set<PokerHand>(['AA'])} onSetSelected={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'KK' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('HandGrid keyboard navigation', () => {
  it('holds a single tab stop that follows focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const cells = screen.getAllByRole('button')

    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([
      screen.getByRole('button', { name: 'AA' }),
    ])

    await user.click(screen.getByRole('button', { name: 'JTs' }))

    expect(screen.getAllByRole('button').filter((cell) => cell.tabIndex === 0)).toEqual([
      screen.getByRole('button', { name: 'JTs' }),
    ])
  })

  it('moves focus one hand at a time with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'AA' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'AKs' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'KK' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'AKo' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveFocus()
  })

  it('stops at the edge rather than wrapping onto the next row', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'AA' }).focus()

    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveFocus()
  })

  it('jumps across the row with Home and End, and to the corners with Ctrl', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'KQs' }).focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('button', { name: 'K2s' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('button', { name: 'AKo' })).toHaveFocus()
    await user.keyboard('{Control>}{End}{/Control}')
    expect(screen.getByRole('button', { name: '22' })).toHaveFocus()
    await user.keyboard('{Control>}{Home}{/Control}')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveFocus()
  })

  it('keeps moving when a held arrow key outruns a re-render', () => {
    render(<Harness />)
    screen.getByRole('button', { name: 'AA' }).focus()

    // One act block, so React flushes only at the end: both presses land before
    // the roving tab stop re-renders, the way key autorepeat behaves.
    act(() => {
      for (let press = 0; press < 2; press += 1) {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        )
      }
    })

    expect(screen.getByRole('button', { name: 'AQs' })).toHaveFocus()
  })

  it('still toggles the hand the arrows landed on', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'AA' }).focus()

    await user.keyboard('{ArrowDown}{ArrowRight}{Enter}')

    expect(screen.getByRole('button', { name: 'KK' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('HandGrid selection gestures', () => {
  it('toggles a single hand on click', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const aks = screen.getByRole('button', { name: 'AKs' })

    expect(aks).toHaveAttribute('aria-pressed', 'false')
    await user.click(aks)
    expect(aks).toHaveAttribute('aria-pressed', 'true')
    await user.click(aks)
    expect(aks).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a hand via keyboard activation', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const aks = screen.getByRole('button', { name: 'AKs' })

    aks.focus()
    await user.keyboard('{Enter}')
    expect(aks).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard(' ')
    expect(aks).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects every hand crossed when dragging from an unselected hand', () => {
    render(<Harness />)
    const aa = screen.getByRole('button', { name: 'AA' })
    const aks = screen.getByRole('button', { name: 'AKs' })
    const aqs = screen.getByRole('button', { name: 'AQs' })

    fireEvent.mouseDown(aa) // press an unselected hand -> paint "select"
    fireEvent.mouseEnter(aks, { buttons: 1 })
    fireEvent.mouseEnter(aqs, { buttons: 1 })
    fireEvent.mouseUp(document)

    expect(aa).toHaveAttribute('aria-pressed', 'true')
    expect(aks).toHaveAttribute('aria-pressed', 'true')
    expect(aqs).toHaveAttribute('aria-pressed', 'true')
  })

  it('deselects every hand crossed when dragging from a selected hand', () => {
    render(<Harness initial={['AA', 'AKs', 'AQs']} />)
    const aa = screen.getByRole('button', { name: 'AA' })
    const aks = screen.getByRole('button', { name: 'AKs' })
    const aqs = screen.getByRole('button', { name: 'AQs' })

    fireEvent.mouseDown(aa) // press a selected hand -> paint "deselect"
    fireEvent.mouseEnter(aks, { buttons: 1 })
    fireEvent.mouseEnter(aqs, { buttons: 1 })
    fireEvent.mouseUp(document)

    expect(aa).toHaveAttribute('aria-pressed', 'false')
    expect(aks).toHaveAttribute('aria-pressed', 'false')
    expect(aqs).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not flip a hand when the pointer re-enters it during one drag', () => {
    render(<Harness />)
    const aa = screen.getByRole('button', { name: 'AA' })
    const aks = screen.getByRole('button', { name: 'AKs' })

    fireEvent.mouseDown(aa) // start selecting at AA
    fireEvent.mouseEnter(aks, { buttons: 1 })
    fireEvent.mouseEnter(aa, { buttons: 1 }) // re-enter the origin
    fireEvent.mouseUp(document)

    // Re-entering AA re-applies "select" instead of toggling it back off.
    expect(aa).toHaveAttribute('aria-pressed', 'true')
    expect(aks).toHaveAttribute('aria-pressed', 'true')
  })

  it('stops painting once the drag ends', () => {
    render(<Harness />)
    const aa = screen.getByRole('button', { name: 'AA' })
    const aks = screen.getByRole('button', { name: 'AKs' })

    fireEvent.mouseDown(aa)
    fireEvent.mouseUp(document)
    // Moving over another hand after release must not select it.
    fireEvent.mouseEnter(aks, { buttons: 1 })

    expect(aa).toHaveAttribute('aria-pressed', 'true')
    expect(aks).toHaveAttribute('aria-pressed', 'false')
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
