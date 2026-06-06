import type { Card } from './cards'
import { rankValue } from './cards'

/**
 * How a 2-card hand relates to a 3-card flop (v4 "hand categories").
 *
 * A hand can carry several tags (e.g. top pair + flush draw). Made-hand logic is
 * at the hand-class / 2-card level — full combo precision is later v4.1 work.
 * `categorizeHand` returns the applicable tags in `HAND_CATEGORIES` order.
 */
export const HAND_CATEGORIES = [
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

  const made = madeTag(holeValues, boardValues, maxBoard, distinctBoardDesc, flopCount)
  if (made) tags.add(made)

  if (hasFlushDraw(hand, flop)) tags.add('flushDraw')
  if (hasStraightDraw(holeValues, boardValues)) tags.add('straightDraw')

  if (tags.size === 0) tags.add('air')

  return HAND_CATEGORIES.filter((tag) => tags.has(tag))
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

/** Four to a flush across the five cards (exactly four of one suit). */
function hasFlushDraw(hand: Card[], flop: Card[]): boolean {
  const counts = new Map<string, number>()
  for (const card of [...hand, ...flop]) {
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1)
  }
  return [...counts.values()].some((n) => n === 4)
}

/** Four to a straight (open-ended or gutshot), counting the ace high and low. */
function hasStraightDraw(holeValues: number[], boardValues: number[]): boolean {
  const present = new Set([...holeValues, ...boardValues])
  // Ace also plays low for wheel draws.
  if (present.has(14)) present.add(1)
  for (let start = 1; start <= 10; start++) {
    let count = 0
    for (let r = start; r < start + 5; r++) {
      if (present.has(r)) count++
    }
    // Exactly four of a five-rank window = a draw (five would be a made straight).
    if (count === 4) return true
  }
  return false
}
