import { ALL_HANDS, type PokerHand } from './pokerHands'
import type { ActionAttempt, PracticeAttempt } from '../types/practice'
import { RANGE_ACTIONS, type RangeAction } from '../types/range'

/**
 * The end-of-session miss recap.
 *
 * Every drill explains a miss the moment it happens, but that explanation is
 * gone by the next hand — after twenty questions the summary could say "14 of
 * 20 correct" without ever naming one of the six. This folds a session's
 * incorrect attempts back into the two lists that are actually actionable:
 * hands to start playing, and hands to start folding.
 *
 * Split by direction rather than by range, because a spot session spans several
 * charts and "fold 72o" reads the same whichever one it came from. Pure — the
 * caller passes the attempts.
 */

/** How many missed hands the recap names before it just counts the rest. */
export const MISS_RECAP_LIMIT = 8

export interface MissRecap {
  /** Range members the user folded — hands to start playing. */
  shouldPlay: PokerHand[]
  /** Non-members the user played — hands to start folding. */
  shouldFold: PokerHand[]
  /** Missed hands the cap left out of the two lists. */
  hiddenCount: number
}

/** Grid (row-major) position of each hand, so the strongest are named first. */
const HAND_ORDER = new Map<PokerHand, number>(ALL_HANDS.map((hand, index) => [hand, index]))

/**
 * The missed hands of `attempts`, strongest-and-most-missed first, capped at
 * `limit`. Returns null when nothing was missed — there is no recap to show.
 *
 * A hand is keyed with its direction, not alone: the same hand can be a member
 * of one chart and a fold in another, and a spot session deals both, so
 * collapsing them would report one of the two as the wrong lesson.
 */
export function recapMisses(
  attempts: PracticeAttempt[],
  limit: number = MISS_RECAP_LIMIT,
): MissRecap | null {
  const counts = new Map<string, { hand: PokerHand; expectedInRange: boolean; times: number }>()
  for (const attempt of attempts) {
    if (attempt.correct) continue
    const key = `${attempt.hand}:${attempt.expectedInRange}`
    const entry = counts.get(key)
    if (entry) entry.times += 1
    else counts.set(key, { hand: attempt.hand, expectedInRange: attempt.expectedInRange, times: 1 })
  }
  if (counts.size === 0) return null

  const ranked = [...counts.values()].sort(
    (a, b) => b.times - a.times || handOrder(a.hand) - handOrder(b.hand),
  )
  const named = ranked.slice(0, Math.max(0, limit))
  return {
    shouldPlay: named.filter((miss) => miss.expectedInRange).map((miss) => miss.hand),
    shouldFold: named.filter((miss) => !miss.expectedInRange).map((miss) => miss.hand),
    hiddenCount: ranked.length - named.length,
  }
}

/** Unknown notation sorts last rather than tying with AA at index 0. */
function handOrder(hand: PokerHand): number {
  return HAND_ORDER.get(hand) ?? ALL_HANDS.length
}

/** The hands one action wanted, for {@link ActionMissRecap}. */
export interface ActionMissGroup {
  action: RangeAction
  hands: PokerHand[]
}

export interface ActionMissRecap {
  /** Missed hands by the action they wanted, in canonical `RANGE_ACTIONS` order. */
  groups: ActionMissGroup[]
  /** Missed hands the cap left out of the groups. */
  hiddenCount: number
}

/**
 * The action quiz's {@link recapMisses}: the hands whose action the session got
 * wrong, grouped by the action each one actually wanted.
 *
 * The recognition drill splits its recap into play/fold because in/out of range
 * is the only question it asks. The action quiz has the whole `RANGE_ACTIONS`
 * vocabulary, so "wrong" is not the lesson — which action the hand wanted is,
 * and grouping by it says "3-bet these" in one line instead of naming a
 * correction per hand. Grouped by the EXPECTED action rather than the chosen
 * one for the same reason: what to do next time is the takeaway.
 *
 * Returns null when nothing was missed. Same cap and ordering as `recapMisses`.
 */
export function recapActionMisses(
  attempts: ActionAttempt[],
  limit: number = MISS_RECAP_LIMIT,
): ActionMissRecap | null {
  const counts = new Map<string, { hand: PokerHand; expected: RangeAction; times: number }>()
  for (const attempt of attempts) {
    if (attempt.correct) continue
    const key = `${attempt.hand}:${attempt.expected}`
    const entry = counts.get(key)
    if (entry) entry.times += 1
    else counts.set(key, { hand: attempt.hand, expected: attempt.expected, times: 1 })
  }
  if (counts.size === 0) return null

  const ranked = [...counts.values()].sort(
    (a, b) => b.times - a.times || handOrder(a.hand) - handOrder(b.hand),
  )
  const named = ranked.slice(0, Math.max(0, limit))
  const groups = RANGE_ACTIONS.map((action) => ({
    action,
    hands: named.filter((miss) => miss.expected === action).map((miss) => miss.hand),
  })).filter((group) => group.hands.length > 0)
  return { groups, hiddenCount: ranked.length - named.length }
}
