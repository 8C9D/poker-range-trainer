import { ALL_HANDS, type PokerHand } from './pokerHands'
import type { PracticeAttempt } from '../types/practice'

/**
 * Pure domain logic for the weakness-focused drill (mode 6): drawing the next
 * prompt biased toward hands the user has gotten wrong so far this session.
 *
 * The weighting is an *in-session* signal computed only from the current
 * session's attempts: every canonical hand stays drawable, but each incorrect
 * attempt on a hand adds extra copies to the draw pool, so frequently-missed
 * hands come up more often. This is deliberately NOT persisted across sessions —
 * cross-session per-hand accuracy tracking is the separate v2.1 work.
 *
 * Randomness is injected (defaulting to `Math.random`) so draws are
 * deterministic and unit-testable; nothing random runs at module scope.
 */

/** Extra pool copies added per incorrect attempt on a hand. */
export const WEAKNESS_MISTAKE_WEIGHT = 3

/** Count of incorrect attempts recorded per hand. */
function mistakeCountsByHand(attempts: PracticeAttempt[]): Map<PokerHand, number> {
  const counts = new Map<PokerHand, number>()
  for (const { hand, correct } of attempts) {
    if (!correct) {
      counts.set(hand, (counts.get(hand) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * The weighted draw pool: iterating `ALL_HANDS` in canonical order, each hand
 * appears once plus `mistakeWeight` extra copies per incorrect attempt on it.
 * With no attempts the pool is exactly `ALL_HANDS`; a hand missed twice (default
 * weight) appears `1 + 3*2 = 7` times. Only canonical hands contribute, so a
 * stray non-canonical attempt can never inflate the pool.
 */
export function buildWeaknessPool(
  attempts: PracticeAttempt[],
  mistakeWeight: number = WEAKNESS_MISTAKE_WEIGHT,
): PokerHand[] {
  const mistakes = mistakeCountsByHand(attempts)
  const pool: PokerHand[] = []
  for (const hand of ALL_HANDS) {
    const copies = 1 + mistakeWeight * (mistakes.get(hand) ?? 0)
    for (let i = 0; i < copies; i += 1) {
      pool.push(hand)
    }
  }
  return pool
}

/**
 * Draw the next weakness-focused prompt: a uniform draw over all hands when
 * there are no mistakes yet, otherwise biased toward missed hands in proportion
 * to how often they were missed. Uses the same clamp as `getRandomPracticeHand`
 * so an input of exactly 1 still yields a valid hand.
 */
export function getWeaknessFocusedHand(
  attempts: PracticeAttempt[],
  random: () => number = Math.random,
  mistakeWeight: number = WEAKNESS_MISTAKE_WEIGHT,
): PokerHand {
  const pool = buildWeaknessPool(attempts, mistakeWeight)
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return pool[index]
}
