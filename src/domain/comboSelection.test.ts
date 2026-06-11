import { describe, it, expect } from 'vitest'
import { parseCard } from './cards'
import {
  allCombosForHand,
  allCombosSelected,
  deserializeComboSelection,
  isComboSelected,
  selectedComboCount,
  selectionForRange,
  serializeComboSelection,
  toggleCombo,
} from './comboSelection'
import { comboKey } from './combos'

const ahkh = [parseCard('Ah'), parseCard('Kh')]
const ackc = [parseCard('Ac'), parseCard('Kc')]

describe('allCombosSelected', () => {
  it('turns on every combo of the given hand classes', () => {
    expect(selectedComboCount(allCombosSelected(['AKs']))).toBe(4)
    expect(selectedComboCount(allCombosSelected(['AA', 'AKo']))).toBe(6 + 12)
  })

  it('selects all combos of a single hand class', () => {
    const selection = allCombosForHand('AKs')
    expect(isComboSelected(selection, ahkh)).toBe(true)
    expect(isComboSelected(selection, ackc)).toBe(true)
  })
})

describe('toggleCombo', () => {
  it('turns a combo off then on without mutating the input', () => {
    const start = allCombosForHand('AKs')
    const off = toggleCombo(start, ahkh)
    expect(isComboSelected(off, ahkh)).toBe(false)
    expect(isComboSelected(start, ahkh)).toBe(true) // input unchanged
    expect(selectedComboCount(off)).toBe(3)

    const back = toggleCombo(off, ahkh)
    expect(isComboSelected(back, ahkh)).toBe(true)
    expect(selectedComboCount(back)).toBe(4)
  })

  it('is order-independent via comboKey (AhKh === KhAh)', () => {
    const selection = allCombosForHand('AKs')
    const khah = [parseCard('Kh'), parseCard('Ah')]
    const off = toggleCombo(selection, khah)
    expect(isComboSelected(off, ahkh)).toBe(false)
    expect(selectedComboCount(off)).toBe(3)
  })
})

describe('selectionForRange', () => {
  it('defaults hand classes without a stored entry to all-on', () => {
    const selection = selectionForRange(['AKs', 'AA'])
    expect(selectedComboCount(selection)).toBe(4 + 6)
    expect(isComboSelected(selection, ahkh)).toBe(true)
  })

  it('restricts hand classes that have a stored entry', () => {
    const selection = selectionForRange(['AKs', 'AA'], { AKs: ['AhKh'] })
    // AKs restricted to 1 combo; AA defaults to all 6.
    expect(selectedComboCount(selection)).toBe(1 + 6)
    expect(selection.has(comboKey(ahkh))).toBe(true)
    expect(isComboSelected(selection, ackc)).toBe(false)
  })
})

describe('serialize/deserialize', () => {
  it('round-trips a selection through plain keys', () => {
    const selection = toggleCombo(allCombosForHand('AKs'), ahkh)
    const keys = serializeComboSelection(selection)
    expect(Array.isArray(keys)).toBe(true)
    const restored = deserializeComboSelection(keys)
    expect(selectedComboCount(restored)).toBe(selectedComboCount(selection))
    expect(isComboSelected(restored, ahkh)).toBe(false)
    expect(isComboSelected(restored, ackc)).toBe(true)
  })
})
