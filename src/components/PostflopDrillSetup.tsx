import { useState } from 'react'
import { buildPostflopScenario, type PostflopScenario } from '../domain/postflopScenario'
import './PracticeSession.css'

interface PostflopDrillSetupProps {
  /** Receives the built scenario once the inputs are valid. */
  onStart: (scenario: PostflopScenario) => void
  /** Leave the setup. */
  onExit: () => void
}

/**
 * Form for building a postflop scenario to drill: hero hand, flop, pot, stack,
 * and the action faced. Validates via `buildPostflopScenario` and shows the
 * parse error inline; on success hands the scenario to `onStart`.
 */
export function PostflopDrillSetup({ onStart, onExit }: PostflopDrillSetupProps) {
  const [heroHand, setHeroHand] = useState('')
  const [flop, setFlop] = useState('')
  const [potSize, setPotSize] = useState('10')
  const [stackDepth, setStackDepth] = useState('100')
  const [facing, setFacing] = useState('villain bets pot')
  const [error, setError] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    try {
      const scenario = buildPostflopScenario({
        heroHand,
        flop,
        potSize: Number(potSize) || 0,
        stackDepth: Number(stackDepth) || 0,
        facing,
      })
      setError('')
      onStart(scenario)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid scenario.')
    }
  }

  return (
    <section className="practice-session" aria-label="Postflop drill setup">
      <header className="practice-header">
        <h2>Postflop drill</h2>
        <button type="button" onClick={onExit}>
          Back to library
        </button>
      </header>

      <form className="postflop-setup" onSubmit={handleSubmit}>
        <label>
          Your hand
          <input
            type="text"
            value={heroHand}
            placeholder="e.g. AsKh"
            onChange={(e) => setHeroHand(e.target.value)}
          />
        </label>
        <label>
          Flop
          <input
            type="text"
            value={flop}
            placeholder="e.g. Kd7c2h"
            onChange={(e) => setFlop(e.target.value)}
          />
        </label>
        <label>
          Pot size
          <input type="number" value={potSize} onChange={(e) => setPotSize(e.target.value)} />
        </label>
        <label>
          Stack depth
          <input
            type="number"
            value={stackDepth}
            onChange={(e) => setStackDepth(e.target.value)}
          />
        </label>
        <label>
          Facing
          <input type="text" value={facing} onChange={(e) => setFacing(e.target.value)} />
        </label>

        {error && (
          <p className="postflop-setup-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary">
          Start drill
        </button>
      </form>
    </section>
  )
}
