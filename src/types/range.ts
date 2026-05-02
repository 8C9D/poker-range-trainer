import type { PokerHand } from '../domain/pokerHands'

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
}
