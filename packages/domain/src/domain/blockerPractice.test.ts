import { describe, it, expect } from 'vitest'
import { parseCard } from './cards'
import { comboKey, handClassCombos } from './combos'
import { allCombosForHand, toggleCombo } from './comboSelection'
import { availablePracticeCombos, drawPracticeCombo } from './blockerPractice'

describe('availablePracticeCombos', () => {
  it('returns all combos when no dead cards or selection', () => {
    expect(availablePracticeCombos(['AKs'])).toHaveLength(4)
    expect(availablePracticeCombos(['AA', 'AKo'])).toHaveLength(6 + 12)
  })

  it('removes combos that use a dead card', () => {
    // The Ks blocks AsKs only among AKs's 4 suited combos.
    const pool = availablePracticeCombos(['AKs'], [parseCard('Ks')])
    expect(pool).toHaveLength(3)
    expect(pool.map(comboKey)).not.toContain('AsKs')
  })

  it('restricts to a ComboSelection when given', () => {
    const ahkh = [parseCard('Ah'), parseCard('Kh')]
    const selection = toggleCombo(allCombosForHand('AKs'), ahkh) // AhKh off
    const pool = availablePracticeCombos(['AKs'], [], selection)
    expect(pool).toHaveLength(3)
    expect(pool.map(comboKey)).not.toContain(comboKey(ahkh))
  })
})

describe('drawPracticeCombo', () => {
  it('draws a combo within the live pool (seeded random)', () => {
    const combo = drawPracticeCombo(['AKs'], [], undefined, () => 0)
    expect(comboKey(combo)).toBe(comboKey(handClassCombos('AKs')[0]))
  })

  it('clamps an injected random() of exactly 1 to the last live combo', () => {
    // Math.floor(1 * pool.length) would index out of bounds; the clamp pins it
    // to the final combo instead of returning undefined.
    const combos = handClassCombos('AKs')
    const combo = drawPracticeCombo(['AKs'], [], undefined, () => 1)
    expect(comboKey(combo)).toBe(comboKey(combos[combos.length - 1]))
  })

  it('throws when every combo is blocked', () => {
    const dead = [parseCard('As'), parseCard('Ah'), parseCard('Ad'), parseCard('Ac')]
    expect(() => drawPracticeCombo(['AA'], dead)).toThrow(/No combos available/)
  })
})
