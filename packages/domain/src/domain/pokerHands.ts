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

const RANK_ORDER = new Map(RANKS.map((rank, index) => [rank as string, index]))

/**
 * Read a hand a user typed into its canonical form, or null when what they
 * typed is not a hand.
 *
 * Case is ignored and either rank order is accepted ("a5s" and "5as" both mean
 * A5s): a search box is typed quickly, and the grid's higher-rank-first
 * convention is not something a player thinks about mid-search. A pair takes no
 * suffix ("tt" -> "TT") and rejects one, since "AAs" is not a hand; every other
 * hand must say suited or offsuit, because "A5" alone names two different ones.
 */
export function parseHandInput(input: string): PokerHand | null {
  const text = input.trim().toUpperCase()
  if (text.length !== 2 && text.length !== 3) return null
  const first = RANK_ORDER.get(text[0])
  const second = RANK_ORDER.get(text[1])
  if (first === undefined || second === undefined) return null
  const [high, low] = first <= second ? [text[0], text[1]] : [text[1], text[0]]
  if (text.length === 2) return first === second ? `${high}${high}` : null
  const suffix = text[2] === 'S' ? 's' : text[2] === 'O' ? 'o' : null
  if (suffix === null || first === second) return null
  const hand = `${high}${low}${suffix}`
  return isValidHand(hand) ? hand : null
}

/**
 * True when `hands` is an array whose every entry is a canonical starting hand.
 * A runtime guard for untrusted payloads (e.g. cloud-fetched shared ranges)
 * before they reach combo/percentage math that throws on an invalid hand.
 */
export function areValidHands(hands: unknown): hands is PokerHand[] {
  return Array.isArray(hands) && hands.every((hand) => typeof hand === 'string' && isValidHand(hand))
}
