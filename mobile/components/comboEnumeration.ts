/**
 * Pure, testable logic for the combo explorer, kept out of the screen so it unit-tests
 * without React (mirroring `swipeAnswer.ts` / `postflopDrill.ts`). All combo math is reused
 * from `@core/domain/combos`; this module only normalizes/validates the text inputs and
 * marks which combos a set of dead (board/blocker) cards removes.
 */
import { parseBoard, type Card } from '@core/domain/cards';
import { comboKey, handClassCombos, removeDeadCards } from '@core/domain/combos';
import { isValidHand } from '@core/domain/pokerHands';

export interface ComboEnumeration {
  /** The normalized, validated hand class (e.g. "AKs"). */
  hand: string;
  /** Every concrete combo of the hand class. */
  combos: Card[][];
  /** `comboKey`s of combos removed by the dead cards (for dimming in the UI). */
  deadKeys: Set<string>;
  /** Total combos of the hand class (`combos.length`). */
  total: number;
  /** Combos surviving after dead-card removal. */
  survivingCount: number;
}

export interface ComboEnumerationError {
  error: string;
}

export type ComboEnumerationResult = ComboEnumeration | ComboEnumerationError;

export function isComboEnumerationError(
  result: ComboEnumerationResult,
): result is ComboEnumerationError {
  return 'error' in result;
}

/** Normalize a typed hand class: uppercase ranks, lowercase the suited/offsuit flag. */
function normalizeHand(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length < 2) return trimmed;
  const ranks = trimmed.slice(0, 2).toUpperCase();
  const flag = trimmed.slice(2).toLowerCase();
  return ranks + flag;
}

/**
 * Enumerate a hand class's concrete combos and mark those a dead-card string removes.
 * Returns a `{ error }` for an invalid hand or unparseable dead cards. An empty dead-card
 * string means no blockers (all combos survive).
 */
export function enumerateCombos(handInput: string, deadInput: string): ComboEnumerationResult {
  const hand = normalizeHand(handInput);
  if (!isValidHand(hand)) {
    return { error: 'Enter a valid hand, e.g. AKs, AKo, or 88.' };
  }

  let dead: Card[] = [];
  if (deadInput.trim()) {
    try {
      dead = parseBoard(deadInput);
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid dead cards.' };
    }
  }

  const combos = handClassCombos(hand);
  const surviving = removeDeadCards(combos, dead);
  const survivingKeys = new Set(surviving.map(comboKey));
  const deadKeys = new Set(
    combos.map(comboKey).filter((key) => !survivingKeys.has(key)),
  );

  return { hand, combos, deadKeys, total: combos.length, survivingCount: surviving.length };
}
