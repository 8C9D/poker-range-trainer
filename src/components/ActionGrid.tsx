import { generateHandMatrix, type PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'
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
 */
export function ActionGrid({ handActions, onAssign }: ActionGridProps) {
  return (
    <div className="action-grid">
      {HANDS.map((hand) => {
        const action = handActions[hand]
        return (
          <button
            key={hand}
            type="button"
            className={action ? `action-cell action-${action}` : 'action-cell'}
            data-action={action ?? 'none'}
            onClick={() => onAssign(hand)}
          >
            {hand}
          </button>
        )
      })}
    </div>
  )
}
