import { useState } from 'react'
import type { PokerHand } from '../domain/pokerHands'
import { formatRangeNotation, parseRangeNotation } from '../domain/rangeNotation'
import './RangeNotation.css'

interface RangeNotationProps {
  /** Current selection, mirrored back as deterministic notation. */
  selectedHands: PokerHand[]
  /** Replace the entire selection with the parsed notation result. */
  onReplaceHands: (hands: PokerHand[]) => void
}

/**
 * Import/export panel for poker range notation.
 *
 * The read-only "Current range" field always mirrors the live selection via
 * {@link formatRangeNotation}, so it stays in sync whenever hands change for
 * any reason (click, drag, shortcut, clear, load, or a notation apply).
 *
 * Applying notation parses the input with {@link parseRangeNotation} and
 * replaces the whole selection. Invalid input leaves the selection untouched
 * and surfaces the parser's reason; a successful apply clears that error. All
 * parsing/formatting stays in the domain layer — this component owns no poker
 * logic of its own.
 */
export function RangeNotation({ selectedHands, onReplaceHands }: RangeNotationProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  // Empty input parses to an empty array, so applying it clears the selection.
  const currentNotation = formatRangeNotation(selectedHands)

  function handleApply() {
    try {
      const hands = parseRangeNotation(input)
      onReplaceHands(hands)
      setError('')
    } catch (err) {
      // Leave the current selection untouched; show the parser's explanation.
      setError(err instanceof Error ? err.message : 'Could not parse that range notation.')
    }
  }

  return (
    <section className="range-notation" aria-label="Range notation">
      <h2>Range notation</h2>

      <div className="range-notation-group">
        <label htmlFor="range-notation-input">Paste or type notation</label>
        <textarea
          id="range-notation-input"
          className="range-notation-input"
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. 77+, AJs+, KQo"
        />
        <p className="range-notation-examples">
          Examples: <code>77+, AJs+, KQo</code> · <code>22+, A2s+, ATo+, KQs</code> ·{' '}
          <code>A5s-A2s</code>
        </p>
        <button type="button" onClick={handleApply}>
          Apply Notation
        </button>
        {error && (
          <p className="range-notation-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="range-notation-group">
        <label htmlFor="range-notation-current">Current range</label>
        <textarea
          id="range-notation-current"
          className="range-notation-output"
          readOnly
          rows={2}
          value={currentNotation}
          placeholder="No hands selected yet"
        />
      </div>
    </section>
  )
}
