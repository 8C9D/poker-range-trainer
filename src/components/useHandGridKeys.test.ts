import { describe, expect, it } from 'vitest'
import { nextHandGridIndex } from './useHandGridKeys'

// Index 0 is AA (top-left), 12 is A2s (end of the top row), 156 is A2o (start of
// the bottom row), 168 is 22 (bottom-right). 84 is the middle cell (row 6, col 6).
const MIDDLE = 84

describe('nextHandGridIndex', () => {
  it('ignores keys that do not navigate', () => {
    for (const key of ['a', 'Enter', ' ', 'Tab', 'Escape']) {
      expect(nextHandGridIndex(key, MIDDLE)).toBeNull()
    }
  })

  it('moves one cell per arrow press', () => {
    expect(nextHandGridIndex('ArrowLeft', MIDDLE)).toBe(83)
    expect(nextHandGridIndex('ArrowRight', MIDDLE)).toBe(85)
    expect(nextHandGridIndex('ArrowUp', MIDDLE)).toBe(71)
    expect(nextHandGridIndex('ArrowDown', MIDDLE)).toBe(97)
  })

  it('clamps at every edge instead of wrapping into the next row', () => {
    expect(nextHandGridIndex('ArrowLeft', 13)).toBe(13)
    expect(nextHandGridIndex('ArrowRight', 12)).toBe(12)
    expect(nextHandGridIndex('ArrowUp', 6)).toBe(6)
    expect(nextHandGridIndex('ArrowDown', 162)).toBe(162)
  })

  it('jumps to the ends of the current row with Home and End', () => {
    expect(nextHandGridIndex('Home', MIDDLE)).toBe(78)
    expect(nextHandGridIndex('End', MIDDLE)).toBe(90)
  })

  it('jumps to the corners of the grid when Home/End are modified', () => {
    expect(nextHandGridIndex('Home', MIDDLE, { ctrlKey: true })).toBe(0)
    expect(nextHandGridIndex('End', MIDDLE, { ctrlKey: true })).toBe(168)
    expect(nextHandGridIndex('Home', MIDDLE, { metaKey: true })).toBe(0)
    expect(nextHandGridIndex('End', MIDDLE, { metaKey: true })).toBe(168)
  })

  it('jumps to the ends of the current column with PageUp and PageDown', () => {
    expect(nextHandGridIndex('PageUp', MIDDLE)).toBe(6)
    expect(nextHandGridIndex('PageDown', MIDDLE)).toBe(162)
    expect(nextHandGridIndex('PageUp', 0)).toBe(0)
    expect(nextHandGridIndex('PageDown', 168)).toBe(168)
  })
})
