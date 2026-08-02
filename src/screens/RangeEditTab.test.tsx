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

describe('RangeEditTab per-hand overlays', () => {
  const overlays = {
    mixedStrategies: {
      AA: [{ action: 'raise' as const, frequency: 100 }],
      KK: [{ action: 'call' as const, frequency: 100 }],
    },
    comboSelections: { AA: ['AhAs'], KK: ['KhKs'] },
  }

  it('drops the mixed strategy and combo selection of a deselected hand', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange(overlays)} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.hands).toEqual(['KK'])
    // Otherwise the frequency quiz keeps drilling AA, which the Frequencies tab
    // can no longer show or clear because it lists only the range's hands.
    expect(saved.mixedStrategies).toEqual({ KK: overlays.mixedStrategies.KK })
    expect(saved.comboSelections).toEqual({ KK: overlays.comboSelections.KK })
  })

  it('keeps the overlays of hands that remain selected', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange(overlays)} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.mixedStrategies).toEqual(overlays.mixedStrategies)
    expect(saved.comboSelections).toEqual(overlays.comboSelections)
  })

  it('restores a deselected hand’s overlays when it is re-selected in the same session', () => {
    const onSaved = vi.fn()
    render(<RangeEditTab range={makeRange(overlays)} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved.mixedStrategies).toEqual(overlays.mixedStrategies)
    expect(saved.comboSelections).toEqual(overlays.comboSelections)
  })

  it('drops the fields entirely when no selected hand has an overlay', () => {
    const onSaved = vi.fn()
    render(
      <RangeEditTab
        range={makeRange({ mixedStrategies: { AA: [{ action: 'raise', frequency: 100 }] } })}
        onSaved={onSaved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    const saved = onSaved.mock.calls[0][0] as SavedRange
    expect(saved).not.toHaveProperty('mixedStrategies')
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

  it('clears the saved status when a per-hand note changes', async () => {
    const user = userEvent.setup()
    render(<RangeEditTab range={makeRange()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Note for AA'), 'Never fold')
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

describe('RangeEditTab scenario pre-fill', () => {
  it('starts a new range from the supplied scenario metadata', () => {
    render(
      <RangeEditTab
        range={null}
        prefill={{
          position: 'bb',
          actionType: 'defend',
          versusPosition: 'co',
          tableSize: 'sixMax',
          stackDepthBb: 40,
        }}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Position')).toHaveValue('bb')
    expect(screen.getByLabelText('Action type')).toHaveValue('defend')
    expect(screen.getByLabelText('Versus position')).toHaveValue('co')
    expect(screen.getByLabelText('Table size')).toHaveValue('sixMax')
    expect(screen.getByLabelText('Stack depth')).toHaveValue(40)
  })

  it('ignores a pre-fill when an existing range is being edited', () => {
    render(
      <RangeEditTab
        range={makeRange({ metadata: { position: 'btn', actionType: 'open' } })}
        prefill={{ position: 'bb', actionType: 'defend' }}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Position')).toHaveValue('btn')
    expect(screen.getByLabelText('Action type')).toHaveValue('open')
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
