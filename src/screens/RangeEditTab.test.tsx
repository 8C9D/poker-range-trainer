import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SavedRange } from '../types/range'
import { RangeEditTab } from './RangeEditTab'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'BTN open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('RangeEditTab per-hand notes', () => {
  it('drops a note for a hand that is deselected before saving', () => {
    const onSaved = vi.fn()
    render(
      <RangeEditTab
        range={makeRange({ handNotes: { AA: 'note on aces', KK: 'note on kings' } })}
        onSaved={onSaved}
      />,
    )

    // A detail-0 click takes the grid's keyboard/assistive toggle path, so this
    // deselects AA without simulating a drag gesture.
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onSaved).toHaveBeenCalledTimes(1)
    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.hands).toEqual(['KK'])
    expect(saved.handNotes).toEqual({ KK: 'note on kings' })
    expect(saved.handNotes).not.toHaveProperty('AA')
  })

  it('saves tags added in the editor', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange()} onSaved={onSaved} />)

    await user.type(screen.getByLabelText('Add a tag'), 'MTT{Enter}')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.tags).toEqual(['MTT'])
  })

  it('keeps notes for hands that remain selected', () => {
    const onSaved = vi.fn()
    render(
      <RangeEditTab
        range={makeRange({ handNotes: { AA: 'note on aces', KK: 'note on kings' } })}
        onSaved={onSaved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.handNotes).toEqual({ AA: 'note on aces', KK: 'note on kings' })
  })
})

describe('RangeEditTab save accessibility', () => {
  it('associates the disabled save button with the reason it is blocked', () => {
    render(<RangeEditTab range={null} onSaved={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save Range' })
    expect(save).toBeDisabled()
    expect(save).toHaveAttribute('aria-describedby', 'range-edit-save-hint')
    expect(document.getElementById('range-edit-save-hint')).toHaveTextContent(
      /select at least one hand/i,
    )
  })

  it('explains an invalid stack depth next to the save button', async () => {
    const user = userEvent.setup()
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)
    // A filled name and selected hands, but an invalid stack depth blocks saving.
    await user.type(screen.getByLabelText('Stack depth'), '-5')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    expect(document.getElementById('range-edit-save-hint')).toHaveTextContent(
      /fix the stack depth/i,
    )
  })
})
