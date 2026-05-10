import type { PokerHand } from '../domain/pokerHands'

/**
 * Scenario metadata vocabularies.
 *
 * Each is declared as a `const` tuple so its union type can be derived from it
 * (`(typeof X)[number]`). That keeps a single source of truth the storage layer
 * validates against and future editor dropdowns can iterate, with no risk of the
 * runtime list and the type drifting apart.
 */
export const GAME_TYPES = ['cash', 'tournament', 'sitAndGo'] as const
export type GameType = (typeof GAME_TYPES)[number]

export const TABLE_SIZES = ['headsUp', 'sixMax', 'nineMax'] as const
export type TableSize = (typeof TABLE_SIZES)[number]

export const POSITIONS = ['utg', 'hj', 'co', 'btn', 'sb', 'bb'] as const
export type Position = (typeof POSITIONS)[number]

export const ACTION_TYPES = [
  'open',
  'call',
  'threeBet',
  'fourBet',
  'defend',
  'jam',
  'callJam',
] as const
export type ActionType = (typeof ACTION_TYPES)[number]

/**
 * User-facing labels for the metadata vocabularies, kept beside the tuples so a
 * new value forces a matching label (each `Record` is exhaustive over its
 * union). Both the editor dropdowns and the library cards render through these
 * maps, so the displayed wording stays in one place.
 */
export const GAME_TYPE_LABELS: Record<GameType, string> = {
  cash: 'Cash',
  tournament: 'Tournament',
  sitAndGo: 'Sit & Go',
}

export const TABLE_SIZE_LABELS: Record<TableSize, string> = {
  headsUp: 'Heads-up',
  sixMax: '6-max',
  nineMax: '9-max',
}

export const POSITION_LABELS: Record<Position, string> = {
  utg: 'UTG',
  hj: 'HJ',
  co: 'CO',
  btn: 'BTN',
  sb: 'SB',
  bb: 'BB',
}

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  open: 'Open',
  call: 'Call',
  threeBet: '3-bet',
  fourBet: '4-bet',
  defend: 'Defend',
  jam: 'Jam',
  callJam: 'Call jam',
}

/**
 * Optional poker-situation metadata describing when a range applies.
 *
 * Every field is optional: a range may carry none, some, or all of them, and
 * ranges saved before this type existed remain valid. Metadata is descriptive
 * only — it does not affect practice behavior.
 */
export interface RangeMetadata {
  /** Cash, tournament, or sit & go. */
  gameType?: GameType
  /** Heads-up, 6-max, or 9-max. */
  tableSize?: TableSize
  /** Effective stack depth in big blinds (positive). */
  stackDepthBb?: number
  /** Hero's seat. */
  position?: Position
  /** Action this range represents (open, 3-bet, defend, …). */
  actionType?: ActionType
  /** Opponent's seat, when the scenario is defined against a specific position. */
  versusPosition?: Position
  /** Free-form notes. */
  notes?: string
}

/**
 * A user-created, named preflop range of starting hands.
 *
 * Named `SavedRange` rather than `Range` to avoid shadowing the DOM `Range`
 * global.
 */
export interface SavedRange {
  /** Stable unique identifier. */
  id: string
  /** User-facing display name. */
  name: string
  /** Selected starting hands in canonical notation (e.g. "AA", "AKs", "AKo"). */
  hands: PokerHand[]
  /** ISO-8601 timestamp of when the range was created. */
  createdAt: string
  /** ISO-8601 timestamp of the most recent edit. */
  updatedAt: string
  /** Optional scenario metadata; absent on ranges saved before v1.3. */
  metadata?: RangeMetadata
  /**
   * Library archive state; absent/false = active. Hidden-by-default filtering
   * comes in a later slice.
   */
  archived?: boolean
  /**
   * Library favorite state; absent/false = not favorited. This is library
   * state, not an edit. Favorites-only filtering / favorites-first sorting
   * comes in a later slice.
   */
  favorite?: boolean
}
