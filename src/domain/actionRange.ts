import { ALL_HANDS, type PokerHand } from './pokerHands'
import { calculateRangePercentage } from './rangeMath'
import type { RangeAction } from '../types/range'

/**
 * Pure helpers for v2.3 multi-action ranges, where each hand maps to a single
 * `RangeAction` (`Record<PokerHand, RangeAction>`). Selection and counts run over
 * `ALL_HANDS` so results are always in canonical 13×13 order. Pure — inputs are
 * never mutated.
 */

/** The hands assigned `action`, in canonical 13×13 order. */
export function handsForAction(
  handActions: Record<PokerHand, RangeAction>,
  action: RangeAction,
): PokerHand[] {
  return ALL_HANDS.filter((hand) => handActions[hand] === action)
}

/**
 * Percentage (0–100) of all 1326 Hold'em combos covered by the hands assigned
 * `action`. An action with no hands is 0.
 */
export function actionRangePercentage(
  handActions: Record<PokerHand, RangeAction>,
  action: RangeAction,
): number {
  return calculateRangePercentage(handsForAction(handActions, action))
}
