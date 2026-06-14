import { useState } from 'react'
import { formatMixedNotation, parseMixedNotation } from '../domain/mixedNotation'
import type { HandMixedStrategy } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import './RangeNotation.css'

interface MixedNotationProps {
  /** Current mixed chart, mirrored back as deterministic frequency notation. */
  mixedStrategies: Record<PokerHand, HandMixedStrategy>
  /** Replace the entire mixed chart with the parsed notation result. */
  onReplace: (mixedStrategies: Record<PokerHand, HandMixedStrategy>) => void
}

/**
 * Import/export panel for mixed-frequency notation (v4.2), mirroring
 * {@link ActionNotation}. The read-only "Current frequencies" field always
 * mirrors the live chart via {@link formatMixedNotation}. Applying notation
 * parses with {@link parseMixedNotation} and replaces the whole chart; invalid
 * input leaves the chart untouched and surfaces the parser's reason. All
 * parsing/formatting stays in the domain layer.
 */
export function MixedNotation({ mixedStrategies, onReplace }: MixedNotationProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const currentNotation = formatMixedNotation(mixedStrategies)

  function handleApply() {
    try {
      const parsed = parseMixedNotation(input)
      onReplace(parsed)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that frequency notation.')
    }
  }

  return (
    <section className="range-notation" aria-label="Frequency notation">
      <h2>Frequency notation</h2>

      <div className="range-notation-group">
        <label htmlFor="mixed-notation-input">Paste or type frequency notation</label>
        <textarea
          id="mixed-notation-input"
          className="range-notation-input"
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'e.g. AA: fold 40, raise 60\nKK: raise 100'}
        />
        <p className="range-notation-examples">
          One hand per line: <code>AA: fold 40, raise 60</code>
        </p>
        <button type="button" onClick={handleApply}>
          Apply Frequency Notation
        </button>
        {error && (
          <p className="range-notation-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="range-notation-group">
        <label htmlFor="mixed-notation-current">Current frequencies</label>
        <textarea
          id="mixed-notation-current"
          className="range-notation-output"
          readOnly
          rows={3}
          value={currentNotation}
          placeholder="No frequencies assigned yet"
        />
      </div>
    </section>
  )
}
