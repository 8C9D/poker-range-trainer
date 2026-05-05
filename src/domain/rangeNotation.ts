import { RANKS, classifyHand, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'

/**
 * Pure helpers for converting between poker range notation and PokerHand[].
 *
 * This first slice supports the common, unambiguous token forms only:
 *
 * - Exact hands: "AA", "77", "AKs", "AKo", "QJs"
 * - Pair plus: "22+", "77+", "TT+" (the pair and every higher pair)
 * - Suited plus, fixed high card: "A2s+", "KTs+" (kicker up to one below the high card)
 * - Offsuit plus, fixed high card: "ATo+", "KJo+"
 * - Comma-separated lists of the above: "77+, AJs+, KQo"
 *
 * Tokens must use canonical casing (uppercase ranks, lowercase "s"/"o" suffix),
 * matching the 169 hands in {@link isValidHand}. Dash ranges ("A5s-A2s"),
 * weighted/mixed frequencies, and action notation are intentionally not
 * supported yet and throw a clear error.
 */

/** Index of a rank within RANKS (0 = 'A' … 12 = '2'); -1 if it is not a rank. */
function rankIndex(rank: string): number {
  return (RANKS as readonly string[]).indexOf(rank)
}

/** Every pocket pair from `baseRank` up through aces, e.g. "7" -> 77,88,…,AA. */
function expandPairPlus(baseRank: string): PokerHand[] {
  const hands: PokerHand[] = []
  for (let i = rankIndex(baseRank); i >= 0; i -= 1) {
    hands.push(`${RANKS[i]}${RANKS[i]}`)
  }
  return hands
}

/**
 * Every non-pair hand sharing `highRank`, with the kicker ranging from
 * `kickerRank` up to one rank below the high card. For example
 * `("A", "5", "s")` yields A5s, A6s, …, AKs.
 */
function expandHighCardPlus(
  highRank: string,
  kickerRank: string,
  suffix: 's' | 'o',
): PokerHand[] {
  const highIndex = rankIndex(highRank)
  const hands: PokerHand[] = []
  for (let k = rankIndex(kickerRank); k > highIndex; k -= 1) {
    hands.push(`${highRank}${RANKS[k]}${suffix}`)
  }
  return hands
}

/** Expand one already-trimmed, non-empty notation token into its hands. */
function expandToken(token: string): PokerHand[] {
  if (token.includes('-')) {
    throw new Error(
      `Dash/range notation is not supported yet: "${token}". ` +
        `Use "+" or list hands individually (e.g. "A2s+").`,
    )
  }
  if (token.includes(':') || token.includes('@')) {
    throw new Error(
      `Weighted, mixed-frequency, or action notation is not supported yet: "${token}".`,
    )
  }

  const hasPlus = token.endsWith('+')
  const base = hasPlus ? token.slice(0, -1) : token

  if (!isValidHand(base)) {
    throw new Error(`Invalid range token: "${token}".`)
  }
  if (!hasPlus) {
    return [base]
  }

  const category = classifyHand(base)
  if (category === 'pair') {
    return expandPairPlus(base[0])
  }
  return expandHighCardPlus(base[0], base[1], category === 'suited' ? 's' : 'o')
}

/**
 * Parse comma-separated range notation into unique, valid hands in canonical
 * 13x13 (row-major) order.
 *
 * Whitespace around tokens is ignored and empty input returns an empty array.
 * Throws a clear error on any unrecognized token, invalid hand, or
 * not-yet-supported notation form.
 */
export function parseRangeNotation(input: string): PokerHand[] {
  const hands = input
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .flatMap(expandToken)
  return normalizeRangeHands(hands)
}

/**
 * Format hands as a deterministic, comma-separated list of canonical hands in
 * 13x13 (row-major) order. Input is validated, deduped, and sorted; an empty
 * input returns an empty string. Throws if any hand is invalid.
 *
 * Kept intentionally simple for this slice: no compact "77+"/"A2s+" output yet.
 */
export function formatRangeNotation(hands: PokerHand[]): string {
  return normalizeRangeHands(hands).join(', ')
}
