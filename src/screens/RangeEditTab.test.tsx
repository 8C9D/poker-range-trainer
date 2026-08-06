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

describe('RangeEditTab summary', () => {
  it('counts a single selected hand in the singular', () => {
    // The first click anyone makes in this app lands here, and read "1 hands
    // selected" for the whole of v1.
    render(<RangeEditTab range={makeRange({ hands: ['AA'] })} onSaved={vi.fn()} />)
    const summary = screen.getByRole('region', { name: 'Range summary' })
    expect(summary).toHaveTextContent('1 hand selected')

    fireEvent.click(screen.getByRole('button', { name: 'KK' }))
    expect(summary).toHaveTextContent('2 hands selected')
  })
})

describe('RangeEditTab archived-feature data', () => {
  const stored = {
    handNotes: { AA: 'note on aces', KK: 'note on kings' },
    mixedStrategies: {
      AA: [{ action: 'raise' as const, frequency: 100 }],
      KK: [{ action: 'call' as const, frequency: 100 }],
    },
    comboSelections: { AA: ['AcAd'], KK: ['KcKd'] },
    handActions: { AA: 'raise' as const },
    tags: ['MTT'],
    source: { kind: 'book' as const, reference: 'Ch. 4' },
  }

  it('carries stored overlays, tags and source through a save untouched', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange(stored)} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.handNotes).toEqual(stored.handNotes)
    expect(saved.mixedStrategies).toEqual(stored.mixedStrategies)
    expect(saved.comboSelections).toEqual(stored.comboSelections)
    expect(saved.handActions).toEqual(stored.handActions)
    expect(saved.tags).toEqual(stored.tags)
    expect(saved.source).toEqual(stored.source)
  })

  it('restores a deselected hand’s overlays when it is re-selected in the session', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange(stored)} onSaved={onSaved} />)

    // A detail-0 click takes the grid's keyboard/assistive toggle path, so this
    // toggles AA without simulating a drag gesture.
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Storage scopes overlays to the range's hands, so the first save dropped
    // AA's entries; the session snapshot brings them back with the hand.
    const saved = onSaved.mock.calls[1][0] as SavedRange
    expect(saved.hands).toEqual(['AA', 'KK'])
    expect(saved.handNotes).toEqual(stored.handNotes)
    expect(saved.mixedStrategies).toEqual(stored.mixedStrategies)
    expect(saved.comboSelections).toEqual(stored.comboSelections)
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

  it('clears the saved status when scenario metadata changes', async () => {
    const user = userEvent.setup()
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved “BTN open”.')

    await user.selectOptions(screen.getByLabelText('Position'), 'btn')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

})

describe('RangeEditTab selection history', () => {
  it('undoes and redoes hand selection changes', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange()} onSaved={onSaved} />)

    const aces = screen.getByRole('button', { name: 'AA' })
    fireEvent.click(aces)
    expect(aces).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(aces).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(aces).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears redo history after a new grid edit', () => {
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'QQ' }))

    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('supports keyboard undo and redo without intercepting text input undo', () => {
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)
    const aces = screen.getByRole('button', { name: 'AA' })

    fireEvent.click(aces)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(aces).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(aces).toHaveAttribute('aria-pressed', 'false')

    fireEvent.keyDown(screen.getByLabelText('Range name'), { key: 'z', ctrlKey: true })
    expect(aces).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('RangeEditTab save failures', () => {
  it('reports a full or unavailable store instead of appearing to do nothing', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange()} onSaved={onSaved} />)

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    spy.mockRestore()

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    // The failed save is never reported as a success.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('clears the failure once a save succeeds', async () => {
    const user = userEvent.setup()
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    spy.mockRestore()

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved “BTN open”.')
  })
})
