import { useEffect, useRef } from 'react'
import { generateHandMatrix } from '../domain/pokerHands'
import type { PokerHand } from '../domain/pokerHands'
import { HandCell } from './HandCell'
import './HandGrid.css'

/**
 * The 13x13 matrix is fixed, so build it once at module load: pairs sit on the
 * diagonal, suited hands above it, offsuit hands below it (row-major order).
 */
const HANDS = generateHandMatrix().flat()

interface HandGridProps {
  selected: ReadonlySet<PokerHand>
  onSetSelected: (hand: PokerHand, selected: boolean) => void
}

/**
 * Renders all 169 starting hands as a controlled grid supporting both
 * click-to-toggle and drag-to-paint selection.
 *
 * Drag model: the first cell pressed decides the gesture's paint mode — press an
 * unselected hand to select, a selected hand to deselect. Every hand crossed
 * during the drag is set to that one target state (an idempotent set, not a
 * toggle), so re-entering a hand mid-drag never flips it back and forth.
 */
export function HandGrid({ selected, onSetSelected }: HandGridProps) {
  const draggingRef = useRef(false)
  const paintModeRef = useRef<'select' | 'deselect'>('select')

  // A drag can end with the button released anywhere, so end it on a window-level
  // mouseup rather than relying on a mouseup landing on a specific cell.
  useEffect(() => {
    function endDrag() {
      draggingRef.current = false
    }
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [])

  function paint(hand: PokerHand) {
    onSetSelected(hand, paintModeRef.current === 'select')
  }

  function handleMouseDown(hand: PokerHand, button: number) {
    if (button !== 0) return // only the primary button starts a drag
    draggingRef.current = true
    // Painting "adds" when the pressed hand is currently outside the range.
    paintModeRef.current = selected.has(hand) ? 'deselect' : 'select'
    paint(hand)
  }

  function handleMouseEnter(hand: PokerHand, buttons: number) {
    if (!draggingRef.current) return
    if (buttons === 0) {
      // The button was released outside the grid; stop painting on re-entry.
      draggingRef.current = false
      return
    }
    paint(hand)
  }

  function handleClick(hand: PokerHand, detail: number) {
    // Mouse clicks (detail >= 1) already painted on mousedown; swallow them so
    // the cell is not toggled a second time. Keyboard / assistive-tech
    // activation reports detail 0 and is the only path that toggles here.
    if (detail >= 1) return
    onSetSelected(hand, !selected.has(hand))
  }

  return (
    <div className="hand-grid">
      {HANDS.map((hand) => (
        <HandCell
          key={hand}
          hand={hand}
          selected={selected.has(hand)}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}
