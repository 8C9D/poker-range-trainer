import { describe, it, expect } from 'vitest'
import {
  actionRangePercentage,
  assignedHands,
  correctActionFor,
  handsForAction,
  summarizeActionAccuracy,
} from './actionRange'
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import type { ActionAttempt } from '../types/practice'
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

describe('assignedHands', () => {
  it('returns an empty array when nothing is assigned', () => {
    expect(assignedHands({})).toEqual([])
  })

  it('returns assigned hands in canonical order', () => {
    const handActions: Record<PokerHand, RangeAction> = { KK: 'fold', AA: 'raise' }
    expect(assignedHands(handActions)).toEqual(['AA', 'KK'])
  })
})

describe('correctActionFor', () => {
  it('returns the assigned action for an assigned hand', () => {
    expect(correctActionFor({ AA: 'raise' }, 'AA')).toBe('raise')
  })

  it('defaults to fold for an unassigned hand', () => {
    expect(correctActionFor({ AA: 'raise' }, 'KK')).toBe('fold')
    expect(correctActionFor({}, 'QQ')).toBe('fold')
  })
})

describe('summarizeActionAccuracy', () => {
  it('returns an empty array for no attempts', () => {
    expect(summarizeActionAccuracy([])).toEqual([])
  })

  it('groups by expected action and counts attempts/correct in canonical order', () => {
    const attempts: ActionAttempt[] = [
      { hand: 'AKs', chosen: 'threeBet', expected: 'threeBet', correct: true },
      { hand: 'AA', chosen: 'call', expected: 'raise', correct: false },
      { hand: 'KK', chosen: 'raise', expected: 'raise', correct: true },
    ]
    // 'raise' precedes 'threeBet' in RANGE_ACTIONS, so it is listed first.
    expect(summarizeActionAccuracy(attempts)).toEqual([
      { action: 'raise', attempts: 2, correct: 1 },
      { action: 'threeBet', attempts: 1, correct: 1 },
    ])
  })

  it('reports an action that was never answered correctly as correct: 0', () => {
    const attempts: ActionAttempt[] = [
      { hand: 'QQ', chosen: 'fold', expected: 'raise', correct: false },
      { hand: 'JJ', chosen: 'call', expected: 'raise', correct: false },
    ]
    expect(summarizeActionAccuracy(attempts)).toEqual([
      { action: 'raise', attempts: 2, correct: 0 },
    ])
  })

  it('omits actions that were never quizzed', () => {
    const attempts: ActionAttempt[] = [
      { hand: 'AA', chosen: 'raise', expected: 'raise', correct: true },
    ]
    expect(summarizeActionAccuracy(attempts).map((stat) => stat.action)).toEqual(['raise'])
  })
})
