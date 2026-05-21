import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import './ActionPalette.css'

interface ActionPaletteProps {
  /** The action currently selected for painting onto the grid. */
  selected: RangeAction
  /** Choose a different active action. */
  onSelect: (action: RangeAction) => void
}

/**
 * The v2.3 action palette: a row of colored swatches, one per `RangeAction`,
 * where the user picks the active action to assign to hands on the multi-action
 * grid. Pure presentation; the selected action and handler come from the parent.
 * The `action-{action}` color classes are shared with the action grid.
 */
export function ActionPalette({ selected, onSelect }: ActionPaletteProps) {
  return (
    <div className="action-palette" role="group" aria-label="Action palette">
      {RANGE_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          className={`action-swatch action-${action}${action === selected ? ' selected' : ''}`}
          aria-pressed={action === selected}
          onClick={() => onSelect(action)}
        >
          {RANGE_ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  )
}
