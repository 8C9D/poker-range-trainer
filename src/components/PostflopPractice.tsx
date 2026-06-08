import { useState } from 'react'
import { formatCard } from '../domain/cards'
import {
  POSTFLOP_DECISIONS,
  POSTFLOP_DECISION_LABELS,
  suggestDecision,
  type PostflopDecision,
  type PostflopScenario,
} from '../domain/postflopScenario'
import { FlopTexture } from './FlopTexture'
import './PracticeSession.css'

interface PostflopPracticeProps {
  /** The scenario to drill (built by the caller via `buildPostflopScenario`). */
  scenario: PostflopScenario
  /** Leave the drill. */
  onExit: () => void
}

interface AnsweredState {
  chosen: PostflopDecision
  suggested: PostflopDecision
  rationale: string
}

/**
 * Self-graded postflop decision drill: shows the hero hand, the flop texture,
 * pot/stack, and the action faced, then compares the user's choice to
 * `suggestDecision`. Framed as a heuristic suggestion, not absolute truth; no
 * persisted stats.
 */
export function PostflopPractice({ scenario, onExit }: PostflopPracticeProps) {
  const [answered, setAnswered] = useState<AnsweredState | null>(null)

  function answer(decision: PostflopDecision) {
    if (answered) return
    const { decision: suggested, rationale } = suggestDecision(scenario)
    setAnswered({ chosen: decision, suggested, rationale })
  }

  const board = scenario.flop.map(formatCard).join('')
  const matched = answered ? answered.chosen === answered.suggested : false

  return (
    <section className="practice-session" aria-label="Postflop decision practice">
      <header className="practice-header">
        <h2>Postflop decision</h2>
        <button type="button" onClick={onExit}>
          Back to library
        </button>
      </header>

      <p className="postflop-hero">
        Your hand: <strong>{scenario.heroHand.map(formatCard).join(' ')}</strong>
      </p>
      <FlopTexture board={board} />
      <p className="postflop-context">
        Pot {scenario.potSize} · Stack {scenario.stackDepth} · Facing: {scenario.facing}
      </p>

      <div className="postflop-decisions" role="group" aria-label="Decision">
        {POSTFLOP_DECISIONS.map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={answered !== null}
            onClick={() => answer(decision)}
          >
            {POSTFLOP_DECISION_LABELS[decision]}
          </button>
        ))}
      </div>

      {answered && (
        <div className="postflop-feedback" role="status">
          <p>
            {matched ? 'Matches the heuristic.' : 'Differs from the heuristic.'} The heuristic
            suggests <strong>{POSTFLOP_DECISION_LABELS[answered.suggested]}</strong>.
          </p>
          <p>{answered.rationale}</p>
        </div>
      )}
    </section>
  )
}
