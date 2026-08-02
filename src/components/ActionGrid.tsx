import { generateHandMatrix, type PokerHand } from '../domain/pokerHands'
import { RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import { useHandGridKeys } from './useHandGridKeys'
import './ActionPalette.css'
import './ActionGrid.css'

/** The 13x13 matrix is fixed, so build the flat hand list once at module load. */
const HANDS = generateHandMatrix().flat()

interface ActionGridProps {
  /** The action assigned to each hand; absent hands are unassigned. */
  handActions: Record<PokerHand, RangeAction>
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
export function ActionGrid({ handActions, onAssign }: ActionGridProps) {
  const { gridRef, focusedIndex, onKeyDown, onFocus } = useHandGridKeys()

  return (
    <div className="action-grid" ref={gridRef} onKeyDown={onKeyDown} onFocus={onFocus}>
      {HANDS.map((hand, index) => {
        const action = handActions[hand]
        return (
          <button
            key={hand}
            type="button"
            className={action ? `action-cell action-${action}` : 'action-cell'}
            data-action={action ?? 'none'}
            aria-label={action ? `${hand}: ${RANGE_ACTION_LABELS[action]}` : `${hand}: unassigned`}
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
