import { generateHandMatrix, type PokerHand } from '../domain/pokerHands'
import { primaryAction, type HandMixedStrategy } from '../domain/mixedStrategy'
import './ActionPalette.css'
import './ActionGrid.css'
import './MixedStrategyGrid.css'

/** The 13x13 matrix is fixed, so build the flat hand list once at module load. */
const HANDS = generateHandMatrix().flat()

interface MixedStrategyGridProps {
  /** Per-hand mixed strategies; hands without one render muted. */
  mixedStrategies: Record<PokerHand, HandMixedStrategy>
}

/**
 * Read-only 13×13 view of a range's mixed strategies: each hand with a strategy
 * is colored by its `primaryAction` (via the shared `action-{action}` classes)
 * and exposes `data-primary` for tests; hands without a strategy render muted.
 * Purely presentational — no clicks, no state.
 */
export function MixedStrategyGrid({ mixedStrategies }: MixedStrategyGridProps) {
  return (
    <div className="action-grid mixed-strategy-grid">
      {HANDS.map((hand) => {
        const strategy = mixedStrategies[hand]
        const primary = strategy ? primaryAction(strategy) : null
        return (
          <div
            key={hand}
            className={primary ? `action-cell action-${primary}` : 'action-cell is-muted'}
            data-primary={primary ?? 'none'}
          >
            {hand}
          </div>
        )
      })}
    </div>
  )
}
