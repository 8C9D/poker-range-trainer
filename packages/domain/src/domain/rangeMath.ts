import { ALL_HANDS, comboCount, isValidHand, type PokerHand } from './pokerHands.js'

/** Total number of distinct two-card starting combinations in Texas Hold'em (52 choose 2). */
export const TOTAL_HOLDEM_COMBOS = 1326

/** Position of each canonical hand in standard 13x13 (row-major) order, for stable sorting. */
const HAND_ORDER = new Map<PokerHand, number>(ALL_HANDS.map((hand, index) => [hand, index]))

/** Throw if any entry is not one of the 169 canonical starting hands. */
function assertValidHands(hands: PokerHand[]): void {
  const invalid = hands.filter((hand) => !isValidHand(hand))
  if (invalid.length > 0) {
    throw new Error(`Invalid poker hand(s): ${invalid.join(', ')}`)
  }
}

/**
 * Unique, valid hands sorted into the standard 13x13 (row-major) order.
 * Throws if any hand is not a canonical starting hand.
 */
export function normalizeRangeHands(hands: PokerHand[]): PokerHand[] {
  assertValidHands(hands)
  return Array.from(new Set(hands)).sort(
    (a, b) => HAND_ORDER.get(a)! - HAND_ORDER.get(b)!,
  )
}

/**
 * Total specific card combinations covered by the selected hands.
 * Duplicate hands are counted once. Throws if any hand is invalid.
 */
export function countSelectedCombos(hands: PokerHand[]): number {
  assertValidHands(hands)
  let total = 0
  for (const hand of new Set(hands)) {
    total += comboCount(hand)
  }
  return total
}

/**
 * Percentage (0–100) of all 1326 Hold'em combos the selection covers.
 * Throws if any hand is invalid.
 */
export function calculateRangePercentage(hands: PokerHand[]): number {
  return (countSelectedCombos(hands) / TOTAL_HOLDEM_COMBOS) * 100
}
