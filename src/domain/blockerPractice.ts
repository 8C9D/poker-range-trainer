import type { PokerHand } from './pokerHands'
import type { Card } from './cards'
import { rangeCombos, removeDeadCards } from './combos'
import { isComboSelected, type ComboSelection } from './comboSelection'

/**
 * Blocker-aware practice prompt selection (v4.1 "blocker-aware practice").
 *
 * Picks a concrete combo from a range while respecting dead/board cards (so
 * blocked combos never appear) and an optional per-combo `ComboSelection`.
 * Pure and dependency-free; randomness is injected (defaulting to `Math.random`)
 * so draws are deterministic and unit-testable.
 */

/**
 * The concrete combos of a range eligible to be drawn: after dead-card removal
 * and, when a `ComboSelection` is given, restricted to the selected combos.
 * Absence of `selection` means all (non-blocked) combos are eligible.
 */
export function availablePracticeCombos(
  hands: PokerHand[],
  dead: Card[] = [],
  selection?: ComboSelection,
): Card[][] {
  const live = removeDeadCards(rangeCombos(hands), dead)
  if (!selection) return live
  return live.filter((combo) => isComboSelected(selection, combo))
}

/**
 * Draw one eligible combo uniformly at random from the range. Throws a clear
 * `Error` when nothing is eligible (every combo blocked or deselected).
 */
export function drawPracticeCombo(
  hands: PokerHand[],
  dead: Card[] = [],
  selection?: ComboSelection,
  random: () => number = Math.random,
): Card[] {
  const pool = availablePracticeCombos(hands, dead, selection)
  if (pool.length === 0) {
    throw new Error('No combos available to practice (all blocked or deselected).')
  }
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return pool[index]
}
