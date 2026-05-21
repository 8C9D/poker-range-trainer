import { describe, it, expect } from 'vitest'
import { handsForAction } from './actionRange'
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
