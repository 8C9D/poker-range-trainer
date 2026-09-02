import {
  POSITIONS,
  TABLE_SIZE_LABELS,
  TABLE_SIZES,
  type ActionType,
  type Position,
  type RangeMetadata,
  type SavedRange,
  type TableSize,
} from '../types/range.js'

/**
 * Preflop spots, and matching them against the saved library (v8.0).
 *
 * Every drill before v8 starts by picking a range. A table does the opposite: it
 * deals you a seat, an action in front of you, a stack, and a hand, and the range
 * is something you have to recall. A {@link Spot} is that situation, and
 * {@link matchRangeToSpot} answers "which of my saved ranges covers this?" using
 * only the v1.3 scenario metadata already stored on each range. Pure.
 */

/**
 * What has happened in front of hero when the decision reaches them.
 *
 * Deliberately coarse: these five cover the preflop decisions a study library is
 * normally built around, and each maps onto a small set of `ActionType`s a range
 * may be saved under (see {@link SITUATION_ACTION_TYPES}).
 */
export const SPOT_SITUATIONS = [
  'foldedToYou',
  'facingOpen',
  'facingThreeBet',
  'facingFourBet',
  'facingJam',
] as const
export type SpotSituation = (typeof SPOT_SITUATIONS)[number]

export const SPOT_SITUATION_LABELS: Record<SpotSituation, string> = {
  foldedToYou: 'Folded to you',
  facingOpen: 'Facing an open',
  facingThreeBet: 'Facing a 3-bet',
  facingFourBet: 'Facing a 4-bet',
  facingJam: 'Facing a jam',
}

/**
 * The range `actionType`s that can answer each situation.
 *
 * A spot is a question ("folded to you on the button"); a range's action type is
 * the answer it encodes ("this is my button open"). A range whose action type is
 * not listed for a situation is answering a different question entirely, so it
 * can never match.
 */
export const SITUATION_ACTION_TYPES: Record<SpotSituation, readonly ActionType[]> = {
  foldedToYou: ['open', 'jam'],
  facingOpen: ['threeBet', 'call', 'defend'],
  facingThreeBet: ['fourBet', 'call', 'jam'],
  facingFourBet: ['jam', 'call'],
  facingJam: ['callJam'],
}

/** One preflop decision: where hero sits, what is in front of them, how deep. */
export interface Spot {
  tableSize: TableSize
  /** Hero's seat. */
  position: Position
  /** What has happened in front of hero. */
  situation: SpotSituation
  /** The opponent who acted, absent only when the pot is folded to hero. */
  versusPosition?: Position
  /** Effective stack depth in big blinds. */
  stackDepthBb: number
}

/**
 * Seats in preflop order of action, per table size.
 *
 * The metadata vocabulary has six seats, so 9-max shares the 6-max seat list —
 * a 9-max library still labels its ranges UTG/HJ/CO/BTN/SB/BB. Heads-up has only
 * the button (who posts the small blind) and the big blind.
 */
export function seatsForTableSize(tableSize: TableSize): Position[] {
  return tableSize === 'headsUp' ? ['btn', 'bb'] : [...POSITIONS]
}

/** The seats that act before `position` at this table size. */
function seatsBefore(tableSize: TableSize, position: Position): Position[] {
  const seats = seatsForTableSize(tableSize)
  return seats.slice(0, seats.indexOf(position))
}

/** The seats that act after `position` at this table size. */
function seatsAfter(tableSize: TableSize, position: Position): Position[] {
  const seats = seatsForTableSize(tableSize)
  return seats.slice(seats.indexOf(position) + 1)
}

/**
 * The opponents who could have created `situation` for hero in `position`.
 *
 * Follows the order of action: an open or a 4-bet comes from a seat that acted
 * before hero, while a 3-bet or a jam comes from a seat still to act behind
 * hero's own raise. The folded-to-you case has no opponent at all.
 */
export function villainsForSituation(
  tableSize: TableSize,
  position: Position,
  situation: SpotSituation,
): Position[] {
  switch (situation) {
    case 'foldedToYou':
      return []
    case 'facingOpen':
    case 'facingFourBet':
      return seatsBefore(tableSize, position)
    case 'facingThreeBet':
    case 'facingJam':
      return seatsAfter(tableSize, position)
  }
}

/**
 * Every standard spot at a table size and stack depth, in seat order.
 *
 * The fixed vocabulary the app deals from and measures library coverage against.
 * The big blind is skipped for "folded to you" — there is no decision when
 * everyone folds to the blind that already has the pot.
 */
export function standardSpots(tableSize: TableSize, stackDepthBb: number): Spot[] {
  const spots: Spot[] = []
  for (const position of seatsForTableSize(tableSize)) {
    for (const situation of SPOT_SITUATIONS) {
      if (situation === 'foldedToYou') {
        if (position !== 'bb') spots.push({ tableSize, position, situation, stackDepthBb })
        continue
      }
      for (const versusPosition of villainsForSituation(tableSize, position, situation)) {
        spots.push({ tableSize, position, situation, versusPosition, stackDepthBb })
      }
    }
  }
  return spots
}

/** Stable identity for a spot, for keying records and lookups. */
export function spotKey(spot: Spot): string {
  return [
    spot.tableSize,
    spot.position,
    spot.situation,
    spot.versusPosition ?? '-',
    spot.stackDepthBb,
  ].join('|')
}

/**
 * Read a {@link spotKey} back into a spot, or `null` when it is not one.
 *
 * The key is what gets persisted (per-spot accuracy is stored under it), so this
 * validates every field against its vocabulary rather than trusting the string.
 */
export function parseSpotKey(key: string): Spot | null {
  const [tableSize, position, situation, versus, depth] = key.split('|')
  if (!(TABLE_SIZES as readonly string[]).includes(tableSize)) return null
  if (!(POSITIONS as readonly string[]).includes(position)) return null
  if (!(SPOT_SITUATIONS as readonly string[]).includes(situation)) return null
  if (versus !== '-' && !(POSITIONS as readonly string[]).includes(versus)) return null
  const stackDepthBb = Number(depth)
  if (!Number.isFinite(stackDepthBb) || stackDepthBb <= 0) return null
  return {
    tableSize: tableSize as TableSize,
    position: position as Position,
    situation: situation as SpotSituation,
    ...(versus === '-' ? {} : { versusPosition: versus as Position }),
    stackDepthBb,
  }
}

/**
 * Hero's seat with the preposition that seat takes: "under the gun" already
 * carries its own article, and the button is one you sit *on*. A single
 * "in the ${seat}" template gets both wrong ("in the UTG").
 */
const HERO_SEAT_PHRASES: Record<Position, string> = {
  utg: 'UTG',
  hj: 'in the HJ',
  co: 'in the CO',
  btn: 'on the BTN',
  sb: 'in the SB',
  bb: 'in the BB',
}

/** The same seats named as the other player, e.g. "an open from the CO". */
const VILLAIN_SEAT_PHRASES: Record<Position, string> = {
  utg: 'UTG',
  hj: 'the HJ',
  co: 'the CO',
  btn: 'the BTN',
  sb: 'the SB',
  bb: 'the BB',
}

/** The spot in plain words, as it would be described at the table. */
export function describeSpot(spot: Spot): string {
  const table = `${TABLE_SIZE_LABELS[spot.tableSize]}, ${spot.stackDepthBb}bb.`
  const seat = HERO_SEAT_PHRASES[spot.position]
  if (spot.situation === 'foldedToYou') return `${table} Folded to you ${seat}.`
  const villain = spot.versusPosition
    ? ` from ${VILLAIN_SEAT_PHRASES[spot.versusPosition]}`
    : ''
  const facing: Record<Exclude<SpotSituation, 'foldedToYou'>, string> = {
    facingOpen: 'an open',
    facingThreeBet: 'a 3-bet',
    facingFourBet: 'a 4-bet',
    facingJam: 'a jam',
  }
  return `${table} You are ${seat} facing ${facing[spot.situation]}${villain}.`
}

/**
 * The action type a range for this spot most likely records.
 *
 * A situation allows several (facing an open can be answered with a 3-bet, a
 * call, or a defend), so this picks the one a player would normally write down
 * first: the big blind already has money in and defends, everyone else 3-bets.
 * Only a starting point — the editor's dropdown still decides.
 */
export function defaultActionTypeForSpot(spot: Spot): ActionType {
  if (spot.situation === 'facingOpen' && spot.position === 'bb') return 'defend'
  return SITUATION_ACTION_TYPES[spot.situation][0]
}

/**
 * The spots that can follow this one once hero puts money in (v8.3).
 *
 * A hand does not end when you open it: someone behind can 3-bet, and the player
 * you 3-bet can 4-bet. Each entry is a second decision on the *same* hand, in the
 * same seat and format. Returns an empty list where the action ends — hero has
 * jammed, called a jam, or nobody is left to act.
 */
export function followUpSpots(spot: Spot): Spot[] {
  const { tableSize, position, stackDepthBb } = spot
  const follow = (situation: SpotSituation, versusPosition: Position): Spot => ({
    tableSize,
    position,
    situation,
    versusPosition,
    stackDepthBb,
  })
  switch (spot.situation) {
    case 'foldedToYou':
      // Hero opened; anyone still to act can 3-bet.
      return villainsForSituation(tableSize, position, 'facingThreeBet').map((villain) =>
        follow('facingThreeBet', villain),
      )
    case 'facingOpen':
      // Hero 3-bet; the original raiser can 4-bet back.
      return spot.versusPosition ? [follow('facingFourBet', spot.versusPosition)] : []
    case 'facingThreeBet':
      // Hero 4-bet; the 3-bettor can shove.
      return spot.versusPosition ? [follow('facingJam', spot.versusPosition)] : []
    case 'facingFourBet':
    case 'facingJam':
      return []
  }
}

/**
 * The scenario metadata a range written for this spot would carry.
 *
 * What the coverage map hands to the range editor when the user fills a gap.
 */
export function spotPrefillMetadata(spot: Spot): RangeMetadata {
  return {
    tableSize: spot.tableSize,
    position: spot.position,
    ...(spot.versusPosition === undefined ? {} : { versusPosition: spot.versusPosition }),
    stackDepthBb: spot.stackDepthBb,
    actionType: defaultActionTypeForSpot(spot),
  }
}

/** A saved range put forward as the answer to a spot, with how well it fits. */
export interface SpotMatch {
  range: SavedRange
  /** 0–100. 60 is a bare seat-and-action match; every extra field pins it further. */
  confidence: number
}

/** Widest relative stack-depth difference still treated as the same spot. */
const STACK_DEPTH_TOLERANCE = 0.25

/**
 * Score one range against a spot, or `null` when it cannot answer it.
 *
 * Seat and action type are required: a range with neither recorded describes no
 * situation, and a range describing a different one is not a weaker answer, it is
 * the wrong answer. Everything else is treated as *optional detail that must not
 * contradict* — a range that names no table size, opponent, or stack depth stays
 * eligible as a generic chart and simply scores lower than one that pins the spot
 * exactly.
 */
export function scoreRangeForSpot(range: SavedRange, spot: Spot): number | null {
  if (range.archived) return null
  const metadata = range.metadata
  if (!metadata?.position || !metadata.actionType) return null
  if (metadata.position !== spot.position) return null
  if (!SITUATION_ACTION_TYPES[spot.situation].includes(metadata.actionType)) return null

  let confidence = 60

  if (metadata.tableSize) {
    if (metadata.tableSize !== spot.tableSize) return null
    confidence += 15
  }

  if (metadata.versusPosition) {
    // A range saved against a specific opponent answers only that opponent, and
    // never a pot that was folded to hero.
    if (metadata.versusPosition !== spot.versusPosition) return null
    confidence += 15
  }

  if (metadata.stackDepthBb !== undefined) {
    const drift = Math.abs(metadata.stackDepthBb - spot.stackDepthBb) / spot.stackDepthBb
    if (drift > STACK_DEPTH_TOLERANCE) return null
    confidence += 10
  }

  return confidence
}

/**
 * The best range in the library for a spot, or `null` when nothing covers it.
 *
 * Ties break toward the more recently edited range, then by name, so the result
 * is stable for a given library.
 */
export function matchRangeToSpot(ranges: SavedRange[], spot: Spot): SpotMatch | null {
  let best: SpotMatch | null = null
  for (const range of ranges) {
    const confidence = scoreRangeForSpot(range, spot)
    if (confidence === null) continue
    if (
      !best ||
      confidence > best.confidence ||
      (confidence === best.confidence &&
        (range.updatedAt > best.range.updatedAt ||
          (range.updatedAt === best.range.updatedAt && range.name < best.range.name)))
    ) {
      best = { range, confidence }
    }
  }
  return best
}
