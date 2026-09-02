import { RANKS, classifyHand, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'

/**
 * Pure helpers that build common preflop range selections.
 *
 * Every helper returns a fresh array of unique, valid {@link PokerHand} values
 * in the standard 13x13 row-major order — the same canonical order produced by
 * {@link normalizeRangeHands}, which each helper delegates to for
 * deduplication, validation, and sorting. Helpers never mutate their inputs.
 */

/** Broadway ranks — ten and higher, highest first (the first five canonical ranks). */
const BROADWAY_RANKS = RANKS.slice(0, RANKS.indexOf('T') + 1)

/** Build the pair notation for a rank, e.g. "A" -> "AA". */
function pairOf(rank: string): PokerHand {
  return `${rank}${rank}`
}

/**
 * Build the broadway non-pair hands (both ranks ten or higher) for a suit type.
 * Iterating high-to-low with the higher rank first yields canonical notation
 * such as "AKs" / "AKo".
 */
function broadwayNonPairs(suffix: 's' | 'o'): PokerHand[] {
  const hands: PokerHand[] = []
  for (let i = 0; i < BROADWAY_RANKS.length; i += 1) {
    for (let j = i + 1; j < BROADWAY_RANKS.length; j += 1) {
      hands.push(`${BROADWAY_RANKS[i]}${BROADWAY_RANKS[j]}${suffix}`)
    }
  }
  return hands
}

/** Throw a clear error unless `hand` is a pocket pair such as "AA" or "77". */
function assertPair(hand: PokerHand): void {
  if (!isValidHand(hand) || classifyHand(hand) !== 'pair') {
    throw new Error(`Expected a pocket pair such as "AA" or "77", but received "${hand}".`)
  }
}

/** All 13 pocket pairs (AA through 22) in canonical order. */
export function selectAllPairs(): PokerHand[] {
  return normalizeRangeHands(RANKS.map(pairOf))
}

/**
 * Every pocket pair at or above `minPair`, in canonical order.
 *
 * For example `selectPairsAtOrAbove('77')` covers 77, 88, 99, TT, JJ, QQ, KK,
 * and AA. Throws if `minPair` is not a pocket pair.
 */
export function selectPairsAtOrAbove(minPair: PokerHand): PokerHand[] {
  assertPair(minPair)
  const minIndex = RANKS.findIndex((rank) => rank === minPair[0])
  const pairs = RANKS.filter((_, index) => index <= minIndex).map(pairOf)
  return normalizeRangeHands(pairs)
}

/**
 * Suited hands where both ranks are ten or higher, excluding pairs
 * (AKs, AQs, AJs, ATs, KQs, KJs, KTs, QJs, QTs, JTs), in canonical order.
 */
export function selectSuitedBroadways(): PokerHand[] {
  return normalizeRangeHands(broadwayNonPairs('s'))
}

/**
 * Offsuit hands where both ranks are ten or higher, excluding pairs
 * (AKo, AQo, AJo, ATo, KQo, KJo, KTo, QJo, QTo, JTo), in canonical order.
 */
export function selectOffsuitBroadways(): PokerHand[] {
  return normalizeRangeHands(broadwayNonPairs('o'))
}

/**
 * All Broadway hands: suited Broadways, offsuit Broadways, and the Broadway
 * pocket pairs (TT, JJ, QQ, KK, AA), in canonical order.
 */
export function selectAllBroadways(): PokerHand[] {
  return normalizeRangeHands([
    ...broadwayNonPairs('s'),
    ...broadwayNonPairs('o'),
    ...BROADWAY_RANKS.map(pairOf),
  ])
}

/**
 * Merge `shortcutHands` into `existingHands`, returning unique, valid hands in
 * canonical order. Neither input is mutated.
 */
export function mergeShortcutHands(
  existingHands: PokerHand[],
  shortcutHands: PokerHand[],
): PokerHand[] {
  return normalizeRangeHands([...existingHands, ...shortcutHands])
}

/**
 * Remove `shortcutHands` from `existingHands`, returning the remaining unique,
 * valid hands in canonical order. Neither input is mutated.
 */
export function removeShortcutHands(
  existingHands: PokerHand[],
  shortcutHands: PokerHand[],
): PokerHand[] {
  const toRemove = new Set(shortcutHands)
  return normalizeRangeHands(existingHands.filter((hand) => !toRemove.has(hand)))
}
