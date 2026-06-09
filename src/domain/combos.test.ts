import { describe, it, expect } from 'vitest'
import { parseBoard, parseCard } from './cards'
import {
  availableComboCount,
  comboCountByHandClass,
  comboKey,
  handClassCombos,
  rangeCombos,
  removeDeadCards,
} from './combos'

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

describe('availableComboCount', () => {
  it('matches the classic counts with no dead cards', () => {
    // AA (6) + AKs (4) + AKo (12) = 22.
    expect(availableComboCount(['AA', 'AKs', 'AKo'])).toBe(22)
  })

  it('reduces when board cards are dead', () => {
    // Board Kd kills AdKd from AKs (4 → 3); AA unaffected → 6 + 3 = 9.
    expect(availableComboCount(['AA', 'AKs'], parseBoard('Kd7c2h'))).toBe(9)
  })
})

describe('comboCountByHandClass', () => {
  it('reports per-class remaining combos after removal', () => {
    const counts = comboCountByHandClass(['AA', 'AKs'], parseBoard('Kd7c2h'))
    expect(counts).toEqual({ AA: 6, AKs: 3 })
  })
})
