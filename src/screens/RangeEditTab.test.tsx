import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
