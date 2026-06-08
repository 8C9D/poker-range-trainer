import { describe, it, expect } from 'vitest'
import { parseBoard, parseCard } from './cards'
import { comboKey, handClassCombos, rangeCombos, removeDeadCards } from './combos'

describe('handClassCombos', () => {
  it('counts pair / suited / offsuit combos', () => {
    expect(handClassCombos('AA')).toHaveLength(6)
    expect(handClassCombos('AKs')).toHaveLength(4)
    expect(handClassCombos('AKo')).toHaveLength(12)
  })

  it('throws on an invalid hand class', () => {
    expect(() => handClassCombos('XY')).toThrow(/Invalid hand class/)
  })
})

describe('rangeCombos', () => {
  it('concatenates combos across hand classes', () => {
    expect(rangeCombos(['AA', 'AKs'])).toHaveLength(10)
  })
})

describe('comboKey', () => {
  it('is order-independent (higher card first)', () => {
    const a = comboKey([parseCard('Kh'), parseCard('As')])
    const b = comboKey([parseCard('As'), parseCard('Kh')])
    expect(a).toBe(b)
    expect(a).toBe('AsKh')
  })

  it('gives distinct keys to distinct combos', () => {
    const keys = new Set(handClassCombos('AA').map(comboKey))
    expect(keys.size).toBe(6)
  })
})

describe('removeDeadCards', () => {
  it('drops combos that use a dead card', () => {
    // Removing the ace of spades leaves 3 of the 6 AA combos.
    const remaining = removeDeadCards(handClassCombos('AA'), [parseCard('As')])
    expect(remaining).toHaveLength(3)
  })

  it('removes board-blocked combos', () => {
    // AKs has 4 combos; a board with the king of diamonds kills AdKd.
    const remaining = removeDeadCards(handClassCombos('AKs'), parseBoard('Kd7c2h'))
    expect(remaining).toHaveLength(3)
  })
})
