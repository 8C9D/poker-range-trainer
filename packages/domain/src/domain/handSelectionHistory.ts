import type { PokerHand } from './pokerHands.js'
import { normalizeRangeHands } from './rangeMath.js'

export const HAND_SELECTION_HISTORY_LIMIT = 50

export interface HandSelectionHistory {
  past: PokerHand[][]
  present: PokerHand[]
  future: PokerHand[][]
}

function snapshot(hands: Iterable<PokerHand>): PokerHand[] {
  return normalizeRangeHands(Array.from(hands))
}

function sameSelection(left: readonly PokerHand[], right: readonly PokerHand[]): boolean {
  return left.length === right.length && left.every((hand, index) => hand === right[index])
}

export function createHandSelectionHistory(
  hands: Iterable<PokerHand> = [],
): HandSelectionHistory {
  return { past: [], present: snapshot(hands), future: [] }
}

export function recordHandSelection(
  history: HandSelectionHistory,
  hands: Iterable<PokerHand>,
  limit = HAND_SELECTION_HISTORY_LIMIT,
): HandSelectionHistory {
  const next = snapshot(hands)
  if (sameSelection(history.present, next)) return history

  const boundedLimit = Math.max(0, Math.floor(limit))
  const past =
    boundedLimit === 0
      ? []
      : [...history.past, history.present].slice(-boundedLimit)
  return { past, present: next, future: [] }
}

export function undoHandSelection(history: HandSelectionHistory): HandSelectionHistory {
  const previous = history.past.at(-1)
  if (!previous) return history

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redoHandSelection(history: HandSelectionHistory): HandSelectionHistory {
  const next = history.future[0]
  if (!next) return history

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  }
}
