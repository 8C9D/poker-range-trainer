export type PokerHand = string

export type HandCategory = 'pair' | 'suited' | 'offsuit'

/** Card ranks from highest to lowest, matching standard range-grid ordering. */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

/**
 * Build the standard 13x13 Texas Hold'em starting-hand matrix.
 *
 * The diagonal holds pairs, the upper triangle holds suited hands, and the
 * lower triangle holds offsuit hands. In every cell the higher rank comes
 * first, which matches conventional poker notation (e.g. AKs, AKo).
 */
export function generateHandMatrix(): PokerHand[][] {
  return RANKS.map((rowRank, i) =>
    RANKS.map((colRank, j) => {
      if (i === j) return `${rowRank}${rowRank}`
      if (i < j) return `${rowRank}${colRank}s`
      return `${colRank}${rowRank}o`
    }),
  )
}

/** Flat list of all 169 starting hands in matrix (row-major) order. */
export const ALL_HANDS: PokerHand[] = generateHandMatrix().flat()

const COMBO_COUNTS: Record<HandCategory, number> = {
  pair: 6,
  suited: 4,
  offsuit: 12,
}

/** Classify a hand by its notation suffix: pairs have none, suited end in `s`, offsuit in `o`. */
export function classifyHand(hand: PokerHand): HandCategory {
  if (hand.endsWith('s')) return 'suited'
  if (hand.endsWith('o')) return 'offsuit'
  return 'pair'
}

/** Number of specific card combinations a hand represents (pair 6, suited 4, offsuit 12). */
export function comboCount(hand: PokerHand): number {
  return COMBO_COUNTS[classifyHand(hand)]
}

/** The 169 canonical starting hands, for O(1) validity lookups. */
const HAND_SET = new Set<PokerHand>(ALL_HANDS)

/** True when `hand` is one of the 169 canonical starting hands (e.g. "AA", "AKs", "AKo"). */
export function isValidHand(hand: PokerHand): boolean {
  return HAND_SET.has(hand)
}

/**
 * True when `hands` is an array whose every entry is a canonical starting hand.
 * A runtime guard for untrusted payloads (e.g. cloud-fetched shared ranges)
 * before they reach combo/percentage math that throws on an invalid hand.
 */
export function areValidHands(hands: unknown): hands is PokerHand[] {
  return Array.isArray(hands) && hands.every((hand) => typeof hand === 'string' && isValidHand(hand))
}
