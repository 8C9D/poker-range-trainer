import type { Card } from './cards'
import { rankValue } from './cards'

/**
 * How a 2-card hand relates to a 3-card flop (v4 "hand categories").
 *
 * A hand can carry several tags (e.g. top pair + flush draw). Made-hand logic is
 * at the hand-class / 2-card level — full combo precision is later v4.1 work.
 * `categorizeHand` returns the applicable tags in `HAND_CATEGORIES` order, which
 * runs strongest to weakest — so `flush` leads, ahead of `straight`.
 */
export const HAND_CATEGORIES = [
  'quads',
  'fullHouse',
  'flush',
  'straight',
  'set',
  'trips',
  'twoPair',
  'overpair',
  'topPair',
  'middlePair',
  'bottomPair',
  'pair',
  'flushDraw',
  'straightDraw',
  'air',
] as const

export type HandCategory = (typeof HAND_CATEGORIES)[number]

export function categorizeHand(hand: Card[], flop: Card[]): HandCategory[] {
  if (hand.length !== 2) throw new Error('A hand must have exactly two cards.')
  if (flop.length !== 3) throw new Error('A flop must have exactly three cards.')

  const tags = new Set<HandCategory>()
  const holeValues = hand.map((c) => rankValue(c.rank))
  const boardValues = flop.map((c) => rankValue(c.rank))
  const maxBoard = Math.max(...boardValues)
  const distinctBoardDesc = [...new Set(boardValues)].sort((a, b) => b - a)
  const flopCount = (v: number) => boardValues.filter((b) => b === v).length

  // Quads and a full house are the same rank structure as a set or trips, only
  // better, so the boat REPLACES the pair-tier tag rather than joining it — a
  // combo must not be counted under two names for the one thing it is. (Flushes
  // and straights are a different structure, so those do stack with a pair.)
  const boat = boatTag([...holeValues, ...boardValues])
  const made = boat ?? madeTag(holeValues, boardValues, maxBoard, distinctBoardDesc, flopCount)
  if (made) tags.add(made)

  // A completed straight fills a whole five-rank window; four of a window is a
  // draw. Take the best fill so a made straight is never also tagged as a draw.
  const straightFill = bestStraightFill(holeValues, boardValues)
  if (straightFill >= 5) tags.add('straight')

  // Five of a suit across the five cards is a made flush; four is a draw. Taken
  // in that order for the same reason as the straight above — the made hand must
  // never also read as a draw for it.
  const suited = longestSuit(hand, flop)
  if (suited >= 5) tags.add('flush')
  else if (suited === 4) tags.add('flushDraw')
  if (straightFill === 4) tags.add('straightDraw')

  if (tags.size === 0) tags.add('air')

  return HAND_CATEGORIES.filter((tag) => tags.has(tag))
}

/**
 * `quads` or `fullHouse` across the five cards, else null.
 *
 * No "did the hand help" check is needed: a three-card flop holds at most three
 * of a rank, so a fourth, and any three-plus-two split, can only come from the
 * hole cards. Untagged, both fell back to the pair tiers — quads read as a set,
 * and a pocket pair filling a trips board read as a bare `pair`, which the
 * postflop heuristic then played for a cheap showdown.
 */
function boatTag(values: number[]): HandCategory | null {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const sizes = [...counts.values()]
  if (sizes.includes(4)) return 'quads'
  if (sizes.includes(3) && sizes.includes(2)) return 'fullHouse'
  return null
}

function madeTag(
  holeValues: number[],
  boardValues: number[],
  maxBoard: number,
  distinctBoardDesc: number[],
  flopCount: (v: number) => number,
): HandCategory | null {
  const pocket = holeValues[0] === holeValues[1]
  if (pocket) {
    const pv = holeValues[0]
    if (flopCount(pv) >= 1) return 'set'
    if (pv > maxBoard) return 'overpair'
    return 'pair'
  }

  const matched = [...new Set(holeValues.filter((v) => boardValues.includes(v)))]
  if (matched.length === 0) return null
  if (matched.some((v) => flopCount(v) >= 2)) return 'trips'
  if (matched.length >= 2) return 'twoPair'

  const v = matched[0]
  const idx = distinctBoardDesc.indexOf(v)
  if (idx === 0) return 'topPair'
  if (idx === distinctBoardDesc.length - 1) return 'bottomPair'
  return 'middlePair'
}

/** How many cards the most-represented suit holds across the five cards (0-5). */
function longestSuit(hand: Card[], flop: Card[]): number {
  const counts = new Map<string, number>()
  for (const card of [...hand, ...flop]) {
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1)
  }
  return Math.max(0, ...counts.values())
}

/**
 * Best "N to a straight" across any five-rank window (0-5), counting the ace
 * high and low. Five means a completed straight; four is a draw (open-ended or
 * gutshot). Returning the maximum fill keeps a made straight from also reading
 * as a draw, since a completed straight always leaves an adjacent four-window.
 */
function bestStraightFill(holeValues: number[], boardValues: number[]): number {
  const present = new Set([...holeValues, ...boardValues])
  // Ace also plays low for wheel straights.
  if (present.has(14)) present.add(1)
  let best = 0
  for (let start = 1; start <= 10; start++) {
    let count = 0
    for (let r = start; r < start + 5; r++) {
      if (present.has(r)) count++
    }
    if (count > best) best = count
  }
  return best
}
