/**
 * Pure, testable glue for the blocker-aware combo drill, kept out of the screen (like
 * `swipeAnswer.ts` / `postflopDrill.ts` / `comboEnumeration.ts`). All combo/blocker math is
 * reused from `@core/domain/blockerPractice`; this only parses the board text and reports how
 * many of the range's combos survive it.
 */
import { parseBoard, type Card } from '@core/domain/cards';
import { availablePracticeCombos } from '@core/domain/blockerPractice';
import type { ComboSelection } from '@core/domain/comboSelection';
import type { PokerHand } from '@core/domain/pokerHands';

export interface BlockerAvailability {
  /** Parsed dead/board cards (empty when the board input is blank). */
  dead: Card[];
  /** The range's combos that survive the dead cards (and any selection). */
  combos: Card[][];
  /** `combos.length`. */
  remaining: number;
}

export interface BlockerAvailabilityError {
  error: string;
}

export type BlockerAvailabilityResult = BlockerAvailability | BlockerAvailabilityError;

export function isBlockerAvailabilityError(
  result: BlockerAvailabilityResult,
): result is BlockerAvailabilityError {
  return 'error' in result;
}

/**
 * Parse the board string and compute the range's unblocked combos. An empty board means no
 * dead cards (all combos eligible); an unparseable board returns a `{ error }`. The optional
 * `selection` (from `selectionForRange`) further restricts eligibility to refined combos.
 */
export function availabilityForBoard(
  hands: PokerHand[],
  boardInput: string,
  selection?: ComboSelection,
): BlockerAvailabilityResult {
  let dead: Card[];
  try {
    dead = boardInput.trim() === '' ? [] : parseBoard(boardInput);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid board.' };
  }
  const combos = availablePracticeCombos(hands, dead, selection);
  return { dead, combos, remaining: combos.length };
}
