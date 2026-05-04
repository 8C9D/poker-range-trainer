import type { PokerHand } from '../domain/pokerHands'

interface HandCellProps {
  hand: PokerHand
  selected: boolean
  onMouseDown: (hand: PokerHand, button: number) => void
  onMouseEnter: (hand: PokerHand, buttons: number) => void
  onClick: (hand: PokerHand, detail: number) => void
}

/**
 * A single cell in the hand grid, rendered as a toggle button.
 *
 * The grid drives selection through three signals so it can support both single
 * clicks and drag-painting:
 * - `mousedown` starts a drag and paints the pressed cell.
 * - `mouseenter` paints cells the cursor crosses while a drag is active.
 * - `click` toggles only on keyboard / assistive-tech activation (detail 0);
 *   real mouse clicks (detail >= 1) were already handled on mousedown.
 */
export function HandCell({ hand, selected, onMouseDown, onMouseEnter, onClick }: HandCellProps) {
  return (
    <button
      type="button"
      className={selected ? 'hand-cell selected' : 'hand-cell'}
      aria-pressed={selected}
      onMouseDown={(event) => onMouseDown(hand, event.button)}
      onMouseEnter={(event) => onMouseEnter(hand, event.buttons)}
      onClick={(event) => onClick(hand, event.detail)}
    >
      {hand}
    </button>
  )
}
