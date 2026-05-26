import { useState } from 'react'
import { formatActionNotation, parseActionNotation } from '../domain/actionRange'
import type { PokerHand } from '../domain/pokerHands'
import type { RangeAction } from '../types/range'
import './RangeNotation.css'

interface ActionNotationProps {
  /** Current action chart, mirrored back as deterministic action-grouped notation. */
  handActions: Record<PokerHand, RangeAction>
  /** Replace the entire action chart with the parsed notation result. */
  onReplaceActions: (handActions: Record<PokerHand, RangeAction>) => void
}

/**
 * Import/export panel for action-grouped range notation (v2.3), mirroring
 * {@link RangeNotation} for multi-action charts.
 *
 * The read-only "Current actions" field always mirrors the live chart via
 * {@link formatActionNotation}. Applying notation parses the input with
 * {@link parseActionNotation} and replaces the whole chart; invalid input leaves
 * the chart untouched and surfaces the parser's reason, and a successful apply
 * clears that error. All parsing/formatting stays in the domain layer — this
 * component owns no poker logic of its own.
 */
export function ActionNotation({ handActions, onReplaceActions }: ActionNotationProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const currentNotation = formatActionNotation(handActions)

  function handleApply() {
    try {
      const parsed = parseActionNotation(input)
      onReplaceActions(parsed)
      setError('')
    } catch (err) {
      // Leave the current chart untouched; show the parser's explanation.
      setError(err instanceof Error ? err.message : 'Could not parse that action notation.')
    }
  }

  return (
    <section className="range-notation" aria-label="Action notation">
      <h2>Action notation</h2>

      <div className="range-notation-group">
        <label htmlFor="action-notation-input">Paste or type action notation</label>
        <textarea
          id="action-notation-input"
          className="range-notation-input"
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'e.g. Raise: 77+, AJs+\n3-bet: AA, KK'}
        />
        <p className="range-notation-examples">
          One action per line: <code>Raise: 77+, AJs+</code> · <code>3-bet: AA, KK</code>
        </p>
        <button type="button" onClick={handleApply}>
          Apply Action Notation
        </button>
        {error && (
          <p className="range-notation-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="range-notation-group">
        <label htmlFor="action-notation-current">Current actions</label>
        <textarea
          id="action-notation-current"
          className="range-notation-output"
          readOnly
          rows={3}
          value={currentNotation}
          placeholder="No actions assigned yet"
        />
      </div>
    </section>
  )
}
