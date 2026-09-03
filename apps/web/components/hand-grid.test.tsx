import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HandGrid, handMatrix } from './hand-grid'

let elementFromPoint: ReturnType<typeof vi.fn>

function GridHarness() {
  const [hands, setHands] = useState<Set<string>>(new Set())
  return <HandGrid selectedHands={hands} onChange={setHands} />
}

function cell(hand: string, pressed: boolean) {
  return screen.getByRole('button', { name: hand, pressed })
}

describe('HandGrid', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    HTMLElement.prototype.setPointerCapture = vi.fn()
    elementFromPoint = vi.fn()
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the canonical 13 by 13 pairs, suited, and offsuit layout with accessible state', () => {
    render(<GridHarness />)
    expect(handMatrix).toHaveLength(169)
    expect(handMatrix[0]).toBe('AA')
    expect(handMatrix[1]).toBe('AKs')
    expect(handMatrix[13]).toBe('AKo')
    expect(handMatrix.at(-1)).toBe('22')
    expect(screen.getByRole('group', { name: 'Starting hand grid' })).toBeInTheDocument()
    expect(cell('AKs', false)).toHaveClass('hand-cell-suited')
    expect(cell('AKo', false)).toHaveClass('hand-cell-offsuit')
    expect(cell('AA', false)).toHaveClass('hand-cell-pair')
    expect(screen.getByText(/Drag to paint/i)).toBeInTheDocument()
  })

  it('paints one gesture with its initial selection mode', () => {
    render(<GridHarness />)
    const aa = cell('AA', false)
    const aks = cell('AKs', false)
    elementFromPoint.mockReturnValueOnce(aa).mockReturnValueOnce(aks)

    fireEvent.pointerDown(aa, { clientX: 1, clientY: 1, pointerId: 1 })
    fireEvent.pointerMove(aa.parentElement!, { clientX: 2, clientY: 2, pointerId: 1 })
    fireEvent.pointerUp(aa.parentElement!, { pointerId: 1 })

    expect(cell('AA', true)).toHaveAttribute('aria-pressed', 'true')
    expect(cell('AKs', true)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 of 169 hand classes selected')).toBeInTheDocument()
  })

  it('uses a bounded roving tab stop and keyboard toggle controls', () => {
    render(<GridHarness />)
    const aa = cell('AA', false)
    aa.focus()
    fireEvent.keyDown(aa, { key: 'ArrowLeft' })
    expect(aa).toHaveFocus()
    expect(aa).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(aa, { key: 'ArrowRight' })
    expect(cell('AKs', false)).toHaveFocus()
    expect(aa).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(cell('22', false)).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(cell('22', false)).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: ' ' })
    expect(cell('22', true)).toHaveAttribute('aria-pressed', 'true')
  })
})
