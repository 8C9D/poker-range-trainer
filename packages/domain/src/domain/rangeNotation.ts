import { RANKS, classifyHand, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'

/**
 * Pure helpers for converting between poker range notation and PokerHand[].
 *
 * Supported token forms:
 *
 * - Exact hands: "AA", "77", "AKs", "AKo", "QJs"
 * - Pair plus: "22+", "77+", "TT+" (the pair and every higher pair)
 * - Suited plus, fixed high card: "A2s+", "KTs+" (kicker up to one below the high card)
 * - Offsuit plus, fixed high card: "ATo+", "KJo+"
 * - Pair dash ranges: "77-TT", "22-66" (every pair between the endpoints)
 * - Suited/offsuit dash ranges, fixed high card: "A5s-A2s", "AJo-ATo"
 *   (the kicker varies between the endpoints; the high card stays fixed)
 * - Comma-separated lists of any of the above: "77+, A5s-A2s, KQo"
 *
 * Tokens must use canonical casing (uppercase ranks, lowercase "s"/"o" suffix),
 * matching the 169 hands in {@link isValidHand}. Dash endpoints may be given in
 * either order ("77-TT" === "TT-77") and tolerate surrounding whitespace
 * ("A5s - A2s"). Weighted/mixed frequencies and action notation are
 * intentionally not supported yet and throw a clear error.
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

/** Every pocket pair between two pair ranks, inclusive and order-independent. */
function expandPairDash(fromRank: string, toRank: string): PokerHand[] {
  const lo = Math.min(rankIndex(fromRank), rankIndex(toRank))
  const hi = Math.max(rankIndex(fromRank), rankIndex(toRank))
  const hands: PokerHand[] = []
  for (let i = lo; i <= hi; i += 1) {
    hands.push(`${RANKS[i]}${RANKS[i]}`)
  }
  return hands
}

/**
 * Every non-pair hand sharing `highRank`, with the kicker ranging between the
 * two kicker ranks, inclusive and order-independent. For example
 * `("A", "5", "2", "s")` yields A5s, A4s, A3s, A2s.
 */
function expandHighCardDash(
  highRank: string,
  fromKicker: string,
  toKicker: string,
  suffix: 's' | 'o',
): PokerHand[] {
  const lo = Math.min(rankIndex(fromKicker), rankIndex(toKicker))
  const hi = Math.max(rankIndex(fromKicker), rankIndex(toKicker))
  const hands: PokerHand[] = []
  for (let k = lo; k <= hi; k += 1) {
    hands.push(`${highRank}${RANKS[k]}${suffix}`)
  }
  return hands
}

/**
 * Expand a dash range token ("77-TT", "A5s-A2s", "AJo-ATo") into its hands.
 *
 * Both endpoints must be valid hands of the same category. Non-pair endpoints
 * must additionally share the same high card, so only the kicker varies.
 * Endpoints may be listed in either order and may carry surrounding whitespace.
 */
function expandDashRange(token: string): PokerHand[] {
  const parts = token.split('-').map((part) => part.trim())
  if (parts.length !== 2) {
    throw new Error(
      `Invalid dash range: "${token}". Use exactly one dash, e.g. "A5s-A2s".`,
    )
  }

  const [from, to] = parts
  if (!isValidHand(from) || !isValidHand(to)) {
    throw new Error(
      `Invalid dash range endpoint(s) in "${token}". Both ends must be valid hands, e.g. "77-TT".`,
    )
  }

  const fromCategory = classifyHand(from)
  if (fromCategory !== classifyHand(to)) {
    throw new Error(
      `Dash range endpoints must be the same hand type (both pairs, both suited, or both offsuit): "${token}".`,
    )
  }

  if (fromCategory === 'pair') {
    return expandPairDash(from[0], to[0])
  }

  if (from[0] !== to[0]) {
    throw new Error(
      `Dash range endpoints must share the same high card: "${token}".`,
    )
  }
  return expandHighCardDash(
    from[0],
    from[1],
    to[1],
    fromCategory === 'suited' ? 's' : 'o',
  )
}

/** Expand one already-trimmed, non-empty notation token into its hands. */
function expandToken(token: string): PokerHand[] {
  if (token.includes(':') || token.includes('@')) {
    throw new Error(
      `Weighted, mixed-frequency, or action notation is not supported yet: "${token}".`,
    )
  }
  if (token.includes('-')) {
    return expandDashRange(token)
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

/**
 * How the 13x13 chart reads aloud, shared by both platforms.
 *
 * The chart is drawn, so on a range's own screen — where it is the content, not
 * a thumbnail beside a name — assistive tech has nothing to announce unless the
 * hands themselves are given as its text. Throws if any hand is invalid, like
 * the combo and percentage maths the same screen already runs.
 */
export function describeRangeChart(hands: PokerHand[]): string {
  const notation = formatRangeNotation(hands)
  return notation ? `Range chart: ${notation}` : 'Range chart: no hands selected'
}
