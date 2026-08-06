import { useState } from 'react'
import { actionRangePercentage, handsForAction, scopedHandActions } from '../domain/actionRange'
import type { PokerHand } from '../domain/pokerHands'
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import { ActionGrid } from './ActionGrid'
import { ActionPalette } from './ActionPalette'
import './MultiActionEditor.css'

interface MultiActionEditorProps {
  /** The action assigned to each hand (controlled by the parent). */
  handActions: Record<PokerHand, RangeAction>
  /** The range's hands; only these can be assigned an action. */
  rangeHands: readonly PokerHand[]
  /** Assign `action` to `hand`. */
  onSetHandAction: (hand: PokerHand, action: RangeAction) => void
}

/**
 * The v2.3 multi-action range editor: pick an active action from the palette,
 * paint it onto the grid, and see per-action percentages. Controlled — the parent
 * owns `handActions` (and will persist it later); only the active action is
 * internal. Composes `ActionPalette`, `ActionGrid`, and the `actionRange` domain
 * helpers.
 */
export function MultiActionEditor({
  handActions,
  rangeHands,
  onSetHandAction,
}: MultiActionEditorProps) {
  const [selectedAction, setSelectedAction] = useState<RangeAction>('raise')
  // The percentages describe the chart, so they read the same narrowed overlay
  // the quiz and the export do: an action stranded on a hand the range no longer
  // holds is inert, and counting it here would overstate the chart's size.
  const inChart = scopedHandActions({ hands: rangeHands, handActions })
  const actionsInUse = RANGE_ACTIONS.filter(
    (action) => handsForAction(inChart, action).length > 0,
  )

  return (
    <section className="multi-action-editor" aria-label="Multi-action editor">
      <ActionPalette selected={selectedAction} onSelect={setSelectedAction} />
      <ActionGrid
        handActions={handActions}
        rangeHands={rangeHands}
        onAssign={(hand) => onSetHandAction(hand, selectedAction)}
      />
      <div className="multi-action-summary" role="group" aria-label="Per-action percentages">
        {actionsInUse.length === 0 ? (
          <span className="multi-action-summary-empty">No actions assigned yet.</span>
        ) : (
          actionsInUse.map((action) => (
            <span key={action} className="multi-action-summary-item">
              {RANGE_ACTION_LABELS[action]}: {actionRangePercentage(inChart, action).toFixed(1)}%
            </span>
          ))
        )}
      </div>
    </section>
  )
}
