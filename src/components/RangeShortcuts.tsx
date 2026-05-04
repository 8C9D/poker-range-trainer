import type { PokerHand } from '../domain/pokerHands'
import {
  selectAllBroadways,
  selectAllPairs,
  selectOffsuitBroadways,
  selectPairsAtOrAbove,
  selectSuitedBroadways,
} from '../domain/rangeShortcuts'
import './RangeShortcuts.css'

interface RangeShortcutsProps {
  /** Merge the shortcut's hands into the current selection. */
  onAddHands: (hands: PokerHand[]) => void
}

/**
 * Each button's label and the hand group it contributes. The hand logic lives
 * entirely in the domain helpers — this list only maps a label to a helper, so
 * the membership rules are never duplicated in the UI.
 */
const SHORTCUTS: ReadonlyArray<{ label: string; getHands: () => PokerHand[] }> = [
  { label: 'Add all pairs', getHands: selectAllPairs },
  { label: 'Add 77+', getHands: () => selectPairsAtOrAbove('77') },
  { label: 'Add suited broadways', getHands: selectSuitedBroadways },
  { label: 'Add offsuit broadways', getHands: selectOffsuitBroadways },
  { label: 'Add all broadways', getHands: selectAllBroadways },
]

/**
 * Compact set of buttons that add common hand groups to the current selection.
 *
 * Buttons only ever add hands; they never clear or remove the existing
 * selection, so they compose with manual click/drag editing.
 */
export function RangeShortcuts({ onAddHands }: RangeShortcutsProps) {
  return (
    <section className="range-shortcuts" aria-label="Range shortcuts">
      <h2>Range shortcuts</h2>
      <div className="range-shortcuts-buttons">
        {SHORTCUTS.map(({ label, getHands }) => (
          <button key={label} type="button" onClick={() => onAddHands(getHands())}>
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
