import type { Card } from './cards'
import { rankValue } from './cards'

/**
 * Flop texture tags (v4). A flop can carry several tags; `tagFlopTexture`
 * returns them in this canonical order. `dry`/`wet` is a coarse summary derived
 * from the structural tags (a flop with a flush or straight texture is "wet").
 */
export const FLOP_TEXTURE_TAGS = [
  'aceHigh',
  'paired',
  'monotone',
  'twoTone',
  'rainbow',
  'connected',
  'wet',
  'dry',
] as const

export type FlopTextureTag = (typeof FLOP_TEXTURE_TAGS)[number]

/**
 * Tag a three-card flop. Throws when the board is not exactly three cards.
 *
 * - aceHigh: an ace is present
 * - paired: two cards share a rank
 * - monotone / twoTone / rainbow: 1 / 2 / 3 distinct suits
 * - connected: the (non-paired) ranks fit within a 5-card straight window
 *   (ace counted high or low)
 * - wet / dry: wet when there is a flush (monotone/twoTone) or straight
 *   (connected) texture; dry otherwise
 */
export function tagFlopTexture(board: Card[]): FlopTextureTag[] {
  if (board.length !== 3) {
    throw new Error('A flop must have exactly three cards.')
  }
  const tags = new Set<FlopTextureTag>()

  if (board.some((c) => c.rank === 'A')) tags.add('aceHigh')

  const ranks = board.map((c) => c.rank)
  const distinctRanks = new Set(ranks)
  const paired = distinctRanks.size < 3
  if (paired) tags.add('paired')

  const distinctSuits = new Set(board.map((c) => c.suit)).size
  if (distinctSuits === 1) tags.add('monotone')
  else if (distinctSuits === 2) tags.add('twoTone')
  else tags.add('rainbow')

  if (!paired && isConnected(board)) tags.add('connected')

  const wet = tags.has('monotone') || tags.has('twoTone') || tags.has('connected')
  tags.add(wet ? 'wet' : 'dry')

  return FLOP_TEXTURE_TAGS.filter((tag) => tags.has(tag))
}

/** True when three distinct ranks fit inside a 5-rank straight window. */
function isConnected(board: Card[]): boolean {
  const high = board.map((c) => rankValue(c.rank))
  // Ace can also play low (value 1) for wheel-type connectedness.
  const low = high.map((v) => (v === 14 ? 1 : v))
  return spanWithinStraight(high) || spanWithinStraight(low)
}

function spanWithinStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length - 1] - sorted[0] <= 4
}
