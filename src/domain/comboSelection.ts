import type { PokerHand } from './pokerHands'
import { comboKey, handClassCombos, rangeCombos } from './combos'
import type { Card } from './cards'

/**
 * Specific-combo selection (v4.1 "combo-level precision").
 *
 * Models a per-combo on/off selection over a hand class or range, so e.g. AhKh
 * can be selected while AcKc is not. Pure and serializable-friendly: a selection
 * is a `Set<string>` of canonical `comboKey`s (the on combos), so it is
 * order-independent and survives JSON round-trips via `Array.from`.
 */
export type ComboSelection = Set<string>

/** A selection with every combo of the given hand classes turned on. */
export function allCombosSelected(hands: PokerHand[]): ComboSelection {
  return new Set(rangeCombos(hands).map(comboKey))
}

/** Whether a specific combo is currently selected. */
export function isComboSelected(selection: ComboSelection, combo: Card[]): boolean {
  return selection.has(comboKey(combo))
}

/**
 * Toggle one combo on/off, returning a NEW selection (the input is unchanged).
 * Keyed by `comboKey`, so AhKh and KhAh refer to the same physical combo.
 */
export function toggleCombo(selection: ComboSelection, combo: Card[]): ComboSelection {
  const key = comboKey(combo)
  const next = new Set(selection)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

/** How many combos are currently selected. */
export function selectedComboCount(selection: ComboSelection): number {
  return selection.size
}

/** Serialize a selection to a plain, JSON-friendly array of combo keys. */
export function serializeComboSelection(selection: ComboSelection): string[] {
  return Array.from(selection)
}

/** Rebuild a selection from a serialized array of combo keys. */
export function deserializeComboSelection(keys: string[]): ComboSelection {
  return new Set(keys)
}

/** Convenience: every combo of a single hand class, selected. */
export function allCombosForHand(hand: PokerHand): ComboSelection {
  return new Set(handClassCombos(hand).map(comboKey))
}
