import {
  isValidMixedStrategy,
  normalizeMixedStrategy,
  totalFrequency,
  type HandMixedStrategy,
} from '../domain/mixedStrategy'
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range'
import './ActionPalette.css'
import './MixedStrategyEditor.css'

interface MixedStrategyEditorProps {
  /** The current mixed strategy (controlled; parent owns it). */
  strategy: HandMixedStrategy
  /** Fired with the next normalized strategy whenever a slider moves. */
  onChange: (next: HandMixedStrategy) => void
}

/**
 * Controlled, presentational editor for ONE hand's mixed strategy: a 0–100
 * frequency slider per `RangeAction`. Moving a slider rebuilds the strategy
 * (dropping zeros, normalized to canonical order) and reports it via `onChange`.
 * Shows the live total and whether it sums to 100.
 */
export function MixedStrategyEditor({ strategy, onChange }: MixedStrategyEditorProps) {
  const byAction = new Map<RangeAction, number>()
  for (const { action, frequency } of strategy) byAction.set(action, frequency)

  const setFrequency = (action: RangeAction, frequency: number) => {
    const next: HandMixedStrategy = []
    for (const a of RANGE_ACTIONS) {
      const value = a === action ? frequency : (byAction.get(a) ?? 0)
      if (value > 0) next.push({ action: a, frequency: value })
    }
    onChange(normalizeMixedStrategy(next))
  }

  const total = totalFrequency(strategy)
  const valid = isValidMixedStrategy(strategy)

  return (
    <div className="mixed-strategy-editor">
      {RANGE_ACTIONS.map((action) => {
        const value = byAction.get(action) ?? 0
        const label = RANGE_ACTION_LABELS[action]
        return (
          <label key={action} className="mixed-strategy-row">
            <span className={`mixed-strategy-swatch action-${action}`} aria-hidden="true" />
            <span className="mixed-strategy-label">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              aria-label={label}
              onChange={(event) => setFrequency(action, Number(event.target.value))}
            />
            <span className="mixed-strategy-value">{value}%</span>
          </label>
        )
      })}
      <p className={`mixed-strategy-total${valid ? ' is-valid' : ''}`}>
        Total: {total}% {valid ? '✓' : '(must total 100%)'}
      </p>
    </div>
  )
}
