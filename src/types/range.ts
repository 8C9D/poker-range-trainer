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
}
