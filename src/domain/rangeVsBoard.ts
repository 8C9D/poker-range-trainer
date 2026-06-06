import type { PokerHand } from './pokerHands'
import { RANKS, SUITS, formatCard, type Card, type Rank } from './cards'
import { HAND_CATEGORIES, categorizeHand, type HandCategory } from './handCategory'

/**
 * Range-vs-board data layer (v4 "range-vs-board visualization").
 *
 * Expands preflop hand classes into concrete combos, removes combos blocked by
 * the board, categorizes each remaining combo against the flop, and tallies
 * combos per {@link HandCategory}. Pure and combo-aware (6 pairs / 4 suited /
 * 12 offsuit), but still hand-class derived — full combo selection is v4.1.
 */

function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value)
}

/** Expand a preflop hand class ("AA", "AKs", "AKo") into its concrete combos. */
export function expandHandClass(hand: PokerHand): Card[][] {
  const r1 = hand[0]
  const r2 = hand[1]
  if (!isRank(r1) || !isRank(r2)) {
    throw new Error(`Invalid hand class: "${hand}".`)
  }
  const combos: Card[][] = []

  if (r1 === r2) {
    // Pocket pair: every unordered pair of distinct suits (6 combos).
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([
          { rank: r1, suit: SUITS[i] },
          { rank: r2, suit: SUITS[j] },
        ])
      }
    }
    return combos
  }

  const suited = hand[2] === 's'
  if (suited) {
    for (const suit of SUITS) {
      combos.push([
        { rank: r1, suit },
        { rank: r2, suit },
      ])
    }
    return combos
  }

  // Offsuit: every ordered suit pair with distinct suits (12 combos).
  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      if (s1 === s2) continue
      combos.push([
        { rank: r1, suit: s1 },
        { rank: r2, suit: s2 },
      ])
    }
  }
  return combos
}

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
