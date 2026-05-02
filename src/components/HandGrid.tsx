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
  onToggle: (hand: PokerHand) => void
}

/** Renders all 169 starting hands as a controlled, click-to-toggle grid. */
export function HandGrid({ selected, onToggle }: HandGridProps) {
  return (
    <div className="hand-grid">
      {HANDS.map((hand) => (
        <HandCell
          key={hand}
          hand={hand}
          selected={selected.has(hand)}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
