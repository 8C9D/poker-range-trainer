import type { PokerHand } from './pokerHands'
import { RANKS, SUITS, formatCard, rankValue, type Card, type Rank } from './cards'

/**
 * Combo-level enumeration (v4.1 "combo-level precision").
 *
 * Expands preflop hand classes into concrete 2-card combos and supports
 * dead-card (board/blocker) removal. Pure and dependency-free; the foundation
 * for combo selection and blocker-aware practice.
 */

function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value)
}

/** The concrete combos for a hand class ("AA" → 6, "AKs" → 4, "AKo" → 12). */
export function handClassCombos(hand: PokerHand): Card[][] {
  const r1 = hand[0]
  const r2 = hand[1]
  if (!isRank(r1) || !isRank(r2)) {
    throw new Error(`Invalid hand class: "${hand}".`)
  }
  const combos: Card[][] = []

  if (r1 === r2) {
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

  if (hand[2] === 's') {
    for (const suit of SUITS) {
      combos.push([
        { rank: r1, suit },
        { rank: r2, suit },
      ])
    }
    return combos
  }

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

/** All concrete combos for a range of hand classes. */
export function rangeCombos(hands: PokerHand[]): Card[][] {
  return hands.flatMap(handClassCombos)
}

/**
 * A canonical, order-independent id for a combo: the two cards sorted with the
 * higher rank first (suit breaks ties), so each physical combo has ONE key.
 */
export function comboKey(combo: Card[]): string {
  const sorted = [...combo].sort((a, b) => {
    const byRank = rankValue(b.rank) - rankValue(a.rank)
    if (byRank !== 0) return byRank
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })
  return sorted.map(formatCard).join('')
}

/** Drop combos that use any of the given dead (board/blocker) cards. */
export function removeDeadCards(combos: Card[][], dead: Card[]): Card[][] {
  const deadKeys = new Set(dead.map(formatCard))
  return combos.filter((combo) => !combo.some((card) => deadKeys.has(formatCard(card))))
}
