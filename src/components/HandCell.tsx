import type { PokerHand } from '../domain/pokerHands'

interface HandCellProps {
  hand: PokerHand
  selected: boolean
  onToggle: (hand: PokerHand) => void
}

/** A single clickable cell in the hand grid, rendered as a toggle button. */
export function HandCell({ hand, selected, onToggle }: HandCellProps) {
  return (
    <button
      type="button"
      className={selected ? 'hand-cell selected' : 'hand-cell'}
      aria-pressed={selected}
      onClick={() => onToggle(hand)}
    >
      {hand}
    </button>
  )
}
