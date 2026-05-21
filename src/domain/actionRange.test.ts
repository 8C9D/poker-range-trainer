import { describe, it, expect } from 'vitest'
import { actionRangePercentage, handsForAction } from './actionRange'
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import type { PokerHand } from './pokerHands'

describe('range action vocabulary', () => {
  it('has a label for every action', () => {
    expect(RANGE_ACTIONS).toHaveLength(7)
    for (const action of RANGE_ACTIONS) {
      expect(RANGE_ACTION_LABELS[action]).toBeTruthy()
    }
  })

  it('includes the expected actions', () => {
    expect([...RANGE_ACTIONS]).toEqual([
      'fold',
      'call',
      'raise',
      'threeBet',
      'fourBet',
      'jam',
      'mixed',
    ])
  })
})

describe('handsForAction', () => {
  it('returns an empty array for an empty map', () => {
    expect(handsForAction({}, 'raise')).toEqual([])
  })

  it('returns the hands for the requested action in canonical order', () => {
    const handActions: Record<PokerHand, RangeAction> = {
      AKs: 'raise',
      AA: 'raise',
      KK: 'fold',
    }
    expect(handsForAction(handActions, 'raise')).toEqual(['AA', 'AKs'])
  })

  it('returns only the requested action and empty for one with no hands', () => {
    const handActions: Record<PokerHand, RangeAction> = {
      AA: 'raise',
      KK: 'fold',
      QQ: 'call',
    }
    expect(handsForAction(handActions, 'fold')).toEqual(['KK'])
    expect(handsForAction(handActions, 'jam')).toEqual([])
  })
})

describe('actionRangePercentage', () => {
  it('is 0 for an action with no hands', () => {
    expect(actionRangePercentage({}, 'raise')).toBe(0)
    expect(actionRangePercentage({ AA: 'fold' }, 'raise')).toBe(0)
  })

  it('counts only the requested action\'s combos', () => {
    const handActions: Record<PokerHand, RangeAction> = {
      AA: 'raise', // pair: 6 combos
      KK: 'raise', // pair: 6 combos
      QQ: 'fold', // excluded
    }
    // 2 pairs -> 12 combos of 1326.
    expect(actionRangePercentage(handActions, 'raise')).toBeCloseTo((12 / 1326) * 100)
    expect(actionRangePercentage(handActions, 'fold')).toBeCloseTo((6 / 1326) * 100)
  })
})
