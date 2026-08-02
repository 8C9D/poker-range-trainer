import { parseRangeNotation } from './rangeNotation'
import type { PokerHand } from './pokerHands'
import type { RangeMetadata, SavedRange } from '../types/range'

/**
 * A built-in pack of standard 6-max 100bb preflop charts.
 *
 * Every training feature in the app reads from the saved library: the spot drill
 * needs a range that covers the spot, the coverage map needs ranges to mark
 * covered, the daily workout needs something due for review. A brand-new user has
 * none of that and has to hand-build a chart from memory before the app does
 * anything, which is exactly the knowledge they came here to acquire.
 *
 * These templates are a common, deliberately mainstream baseline — not solver
 * output — so they are saved as ordinary editable ranges, tagged
 * {@link STARTER_RANGE_TAG} so the user can find (or delete) them as a group, and
 * each carries a note saying to adjust it. Pure: the caller supplies the clock
 * and the id source.
 */

/** Organization tag every starter range is saved under. */
export const STARTER_RANGE_TAG = 'Starter'

/** Note attached to each starter range, so its provenance is never a mystery. */
const STARTER_NOTE =
  'Starter chart: a common baseline, not solver output. Edit it to match how you play.'

/** One chart in the pack, before it is turned into a saved range. */
export interface StarterRangeTemplate {
  name: string
  /** The chart in range notation, expanded by {@link parseRangeNotation}. */
  notation: string
  /** Scenario metadata, minus the note every template shares. */
  metadata: Omit<RangeMetadata, 'notes'>
}

const SIX_MAX_100BB = { gameType: 'cash', tableSize: 'sixMax', stackDepthBb: 100 } as const

/**
 * The pack: an opening range for each seat that can open, the big blind's
 * defence against the two most common opens, and the two most common 3-bets.
 *
 * Ordered as a player would learn them — opens first, from the tightest seat
 * outward, then the spots where someone has already raised.
 */
export const STARTER_RANGE_TEMPLATES: readonly StarterRangeTemplate[] = [
  {
    name: 'UTG open (6-max 100bb)',
    notation: '55+, A9s+, A5s-A2s, KTs+, QTs+, J9s+, T9s, 98s, 87s, AJo+, KQo',
    metadata: { ...SIX_MAX_100BB, position: 'utg', actionType: 'open' },
  },
  {
    name: 'HJ open (6-max 100bb)',
    notation: '44+, A7s+, A5s-A2s, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, ATo+, KJo+',
    metadata: { ...SIX_MAX_100BB, position: 'hj', actionType: 'open' },
  },
  {
    name: 'CO open (6-max 100bb)',
    notation:
      '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
    metadata: { ...SIX_MAX_100BB, position: 'co', actionType: 'open' },
  },
  {
    name: 'BTN open (6-max 100bb)',
    notation:
      '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K7o+, Q9o+, J9o+, T9o, 98o',
    metadata: { ...SIX_MAX_100BB, position: 'btn', actionType: 'open' },
  },
  {
    name: 'SB open (6-max 100bb)',
    notation:
      '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A7o+, A5o-A2o, K9o+, Q9o+, JTo, T9o',
    metadata: { ...SIX_MAX_100BB, position: 'sb', actionType: 'open' },
  },
  {
    name: 'BB defend vs BTN open (6-max 100bb)',
    notation:
      '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o',
    metadata: { ...SIX_MAX_100BB, position: 'bb', actionType: 'defend', versusPosition: 'btn' },
  },
  {
    name: 'BB defend vs CO open (6-max 100bb)',
    notation:
      '22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A4o+, K8o+, Q9o+, J9o+, T9o, 98o',
    metadata: { ...SIX_MAX_100BB, position: 'bb', actionType: 'defend', versusPosition: 'co' },
  },
  {
    name: 'BTN 3-bet vs CO open (6-max 100bb)',
    notation: '99+, AJs+, A5s-A3s, KJs+, QJs, JTs, T9s, 87s, 76s, AQo+, KQo',
    metadata: { ...SIX_MAX_100BB, position: 'btn', actionType: 'threeBet', versusPosition: 'co' },
  },
  {
    name: 'SB 3-bet vs BTN open (6-max 100bb)',
    notation: 'TT+, ATs+, A5s-A3s, KJs+, QJs, JTs, T9s, 76s, AQo+, KQo',
    metadata: { ...SIX_MAX_100BB, position: 'sb', actionType: 'threeBet', versusPosition: 'btn' },
  },
]

/** The hands one template selects, in canonical 13x13 order. */
export function starterRangeHands(template: StarterRangeTemplate): PokerHand[] {
  return parseRangeNotation(template.notation)
}

/**
 * Build the whole pack as saved ranges, ready to hand to the storage layer.
 *
 * `nowIso` timestamps every range identically (they were all added in one
 * action), and `createId` mints the ids so this stays pure and testable.
 */
export function buildStarterRanges(nowIso: string, createId: () => string): SavedRange[] {
  return STARTER_RANGE_TEMPLATES.map((template) => ({
    id: createId(),
    name: template.name,
    hands: starterRangeHands(template),
    createdAt: nowIso,
    updatedAt: nowIso,
    metadata: { ...template.metadata, notes: STARTER_NOTE },
    tags: [STARTER_RANGE_TAG],
  }))
}
