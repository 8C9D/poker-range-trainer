import { RANKS, classifyHand, isValidHand, type PokerHand } from './pokerHands'

/**
 * Poker-meaningful groupings of the 169 starting hands (v7.0 leak report).
 *
 * Per-hand mistake stats are precise but hard to act on — "you missed K8s and
 * J7s and 96s" is noise, "you fold too many suited gappers" is a lesson. Every
 * hand belongs to exactly one class, so class stats are a clean partition of the
 * per-hand stats. Pure: notation in, class out.
 */

export const HAND_CLASSES = [
  'premiumPair',
  'mediumPair',
  'smallPair',
  'suitedAce',
  'suitedBroadway',
  'suitedConnector',
  'suitedGapper',
  'suitedOther',
  'offsuitAce',
  'offsuitBroadway',
  'offsuitConnector',
  'offsuitOther',
] as const

export type HandClass = (typeof HAND_CLASSES)[number]

export const HAND_CLASS_LABELS: Record<HandClass, string> = {
  premiumPair: 'Premium pairs (JJ+)',
  mediumPair: 'Medium pairs (77–TT)',
  smallPair: 'Small pairs (22–66)',
  suitedAce: 'Suited aces',
  suitedBroadway: 'Suited broadway',
  suitedConnector: 'Suited connectors',
  suitedGapper: 'Suited gappers',
  suitedOther: 'Other suited',
  offsuitAce: 'Offsuit aces',
  offsuitBroadway: 'Offsuit broadway',
  offsuitConnector: 'Offsuit connectors',
  offsuitOther: 'Other offsuit',
}

/** Index of a rank in `RANKS` (0 = ace), i.e. its distance from the top. */
function rankIndex(rank: string): number {
  return (RANKS as readonly string[]).indexOf(rank)
}

/** Broadway ranks are ten and above — the top five indices. */
function isBroadway(rank: string): boolean {
  return rankIndex(rank) <= rankIndex('T')
}

/**
 * The class `hand` belongs to. Throws on a non-canonical hand, matching the rest
 * of the domain's treatment of invalid notation.
 *
 * Non-pairs are classified by the strongest signal first: an ace kicker, then a
 * two-broadway holding, then connectedness (gap 0) and one/two-gappers.
 */
export function classifyHandClass(hand: PokerHand): HandClass {
  if (!isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`)
  const kind = classifyHand(hand)
  const high = hand[0]
  if (kind === 'pair') {
    if (rankIndex(high) <= rankIndex('J')) return 'premiumPair'
    if (rankIndex(high) <= rankIndex('7')) return 'mediumPair'
    return 'smallPair'
  }
  const low = hand[1]
  const suited = kind === 'suited'
  if (high === 'A') return suited ? 'suitedAce' : 'offsuitAce'
  if (isBroadway(high) && isBroadway(low)) {
    return suited ? 'suitedBroadway' : 'offsuitBroadway'
  }
  const gap = rankIndex(low) - rankIndex(high) - 1
  if (gap === 0) return suited ? 'suitedConnector' : 'offsuitConnector'
  // Offsuit one/two-gappers are rarely studied as their own group, so they fold
  // into "other offsuit" rather than earning a class of their own.
  if (gap <= 2 && suited) return 'suitedGapper'
  return suited ? 'suitedOther' : 'offsuitOther'
}
