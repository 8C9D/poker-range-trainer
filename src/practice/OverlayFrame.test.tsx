import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverlayFrame } from './OverlayFrame'

describe('OverlayFrame dialog behavior', () => {
  it('is a labelled modal dialog', () => {
    render(
      <OverlayFrame title="UTG Open" onClose={() => {}}>
        <p>drill</p>
      </OverlayFrame>,
    )
    const dialog = screen.getByRole('dialog', { name: 'UTG Open' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <OverlayFrame title="UTG Open" onClose={onClose}>
        <p>drill</p>
      </OverlayFrame>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open', () => {
    render(
      <OverlayFrame title="UTG Open" onClose={() => {}}>
        <button type="button">Answer</button>
      </OverlayFrame>,
    )
    // The close button is the first focusable control inside the frame.
    expect(screen.getByRole('button', { name: 'Close practice' })).toHaveFocus()
  })

  it('restores focus to the launching control when it closes', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(trigger).toHaveFocus()

    const { unmount } = render(
      <OverlayFrame title="UTG Open" onClose={() => {}}>
        <button type="button">Answer</button>
      </OverlayFrame>,
    )
    expect(trigger).not.toHaveFocus()

    unmount()
    expect(trigger).toHaveFocus()
    document.body.removeChild(trigger)
  })
})
