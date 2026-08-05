import { useId } from 'react'
import { generateHandMatrix, type PokerHand } from '../domain/pokerHands'
import { RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import { HAND_GRID_KEY_HINT, useHandGridKeys } from './useHandGridKeys'
import './ActionPalette.css'
import './ActionGrid.css'

/** The 13x13 matrix is fixed, so build the flat hand list once at module load. */
const HANDS = generateHandMatrix().flat()

interface ActionGridProps {
  /** The action assigned to each hand; absent hands are unassigned. */
  handActions: Record<PokerHand, RangeAction>
  /**
   * The hands the range holds. Cells outside it are shown out of the range and
   * cannot be assigned: `hands` is the membership list, so an action there is
   * inert (the quiz skips it, the export does not colour it), and letting the
   * grid paint it made the tab promise something no drill honoured. The Combos
   * and Frequencies tabs already list only the range's hands; this matches them.
   */
  rangeHands: readonly PokerHand[]
  /** Assign the active action (owned by the parent) to `hand`. */
  onAssign: (hand: PokerHand) => void
}

/**
 * The v2.3 multi-color action grid: all 169 hands as cells colored by their
 * assigned `RangeAction` (neutral when unassigned). Clicking a cell calls
 * `onAssign(hand)`; the parent owns the active action and applies it. Colors come
 * from the shared `action-{action}` classes; the action is exposed via
 * `data-action` for tests and styling.
 *
 * Keyboard model matches the hand grid: one roving tab stop moved with the arrow
 * keys (see {@link useHandGridKeys}); Enter/Space assigns the active action.
 */
export function ActionGrid({ handActions, rangeHands, onAssign }: ActionGridProps) {
  const { gridRef, focusedIndex, onKeyDown, onFocus } = useHandGridKeys()
  const keysId = useId()
  const inRange = new Set(rangeHands)

  return (
    <div
      className="action-grid"
      role="group"
      aria-label="Starting hand action grid"
      aria-describedby={keysId}
      ref={gridRef}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {/* Out of flow (absolutely positioned), so it takes no cell in the grid. */}
      <p id={keysId} className="coach-sr-only">
        {HAND_GRID_KEY_HINT}
      </p>
      {HANDS.map((hand, index) => {
        const outsideRange = !inRange.has(hand)
        const action = outsideRange ? undefined : handActions[hand]
        return (
          <button
            key={hand}
            type="button"
            className={action ? `action-cell action-${action}` : 'action-cell'}
            data-action={action ?? 'none'}
            disabled={outsideRange}
            aria-label={
              outsideRange
                ? `${hand}: not in this range`
                : action
                  ? `${hand}: ${RANGE_ACTION_LABELS[action]}`
                  : `${hand}: unassigned`
            }
            tabIndex={index === focusedIndex ? 0 : -1}
            onClick={() => onAssign(hand)}
          >
            {hand}
          </button>
        )
      })}
    </div>
  )
}
