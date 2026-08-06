import type { PokerHand } from './pokerHands'
import { formatCard, type Card } from './cards'
import { HAND_CATEGORIES, categorizeHand, type HandCategory } from './handCategory'
import { handClassCombos } from './combos'

/**
 * Range-vs-board data layer (v4 "range-vs-board visualization").
 *
 * Expands preflop hand classes into concrete combos, removes combos blocked by
 * the board, categorizes each remaining combo against the flop, and tallies
 * combos per {@link HandCategory}. Combo enumeration lives in `combos.ts`.
 */

/** Expand a preflop hand class into its concrete combos (see `handClassCombos`). */
export const expandHandClass = handClassCombos

function emptyTally(): Record<HandCategory, number> {
  return Object.fromEntries(HAND_CATEGORIES.map((c) => [c, 0])) as Record<HandCategory, number>
}

/**
 * Bucket a preflop range against a flop. Each hand class is expanded to combos;
 * combos sharing a card with the board are dropped (blocker removal); every
 * remaining combo is categorized and increments EACH category tag it carries
 * (so a top-pair + flush-draw combo counts toward both). Returns combo counts
 * per category.
 */
export function bucketRangeOnBoard(
  hands: PokerHand[],
  flop: Card[],
): Record<HandCategory, number> {
  const tally = emptyTally()
  const boardKeys = new Set(flop.map(formatCard))

  for (const hand of hands) {
    for (const combo of expandHandClass(hand)) {
      if (combo.some((card) => boardKeys.has(formatCard(card)))) continue
      for (const tag of categorizeHand(combo, flop)) {
        tally[tag]++
      }
    }
  }
  return tally
}
