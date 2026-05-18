import { handAccuracyRate, handsWithMistakes, rankHandAccuracy } from '../domain/practice'
import type { PracticeSessionRecord, RangeHandAccuracy } from '../types/practice'
import type { SavedRange } from '../types/range'
import { HandHeatmap } from './HandHeatmap'
import './PracticeSession.css'
import './RangePerformance.css'

interface RangePerformanceProps {
  /** The saved range whose per-hand accuracy is shown. */
  range: SavedRange
  /** Cumulative per-hand accuracy for the range (may be empty). */
  accuracy: RangeHandAccuracy
  /** Finished sessions for the range, oldest-first (may be empty). */
  history: PracticeSessionRecord[]
  /** Return to the library view. */
  onClose: () => void
  /** Start a recognition session restricted to this range's mistaken hands. */
  onPracticeMistakes: () => void
}

/**
 * Range-specific performance view (v2.1): a weakest-first table of per-hand
 * accuracy (with a heatmap) plus a session-history timeline for one range, so the
 * user can see exactly which hands they struggle with and how they have trended.
 * Ranking and accuracy come from the `rankHandAccuracy` / `handAccuracyRate`
 * domain helpers; this component is pure presentation fed by props.
 */
export function RangePerformance({
  range,
  accuracy,
  history,
  onClose,
  onPracticeMistakes,
}: RangePerformanceProps) {
  const ranked = rankHandAccuracy(accuracy)
  const hasMistakes = handsWithMistakes(accuracy).length > 0
  // Newest session first; copy so the oldest-first prop is never mutated.
  const recentSessions = [...history].reverse()

  return (
    <section className="practice-session" aria-label="Range performance">
      <header className="practice-header">
        <h2>Performance: {range.name}</h2>
        {hasMistakes && (
          <button type="button" className="primary" onClick={onPracticeMistakes}>
            Practice mistakes
          </button>
        )}
        <button type="button" onClick={onClose}>
          Back to library
        </button>
      </header>

      {ranked.length === 0 && history.length === 0 && (
        <p className="range-performance-empty">
          No practice data yet — practice this range to see per-hand accuracy.
        </p>
      )}

      {ranked.length > 0 && (
        <>
          <h3 className="practice-review-heading">Accuracy heatmap</h3>
          <HandHeatmap accuracy={accuracy} />
          <table className="hand-accuracy-table" aria-label="Per-hand accuracy">
            <thead>
              <tr>
                <th scope="col">Hand</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Attempts</th>
                <th scope="col">Missed</th>
                <th scope="col">Wrongly included</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((stat) => (
                <tr key={stat.hand}>
                  <td>{stat.hand}</td>
                  <td>{handAccuracyRate(stat).toFixed(0)}%</td>
                  <td>{stat.attempts}</td>
                  <td>{stat.falseNegatives}</td>
                  <td>{stat.falsePositives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {history.length > 0 && (
        <>
          <h3 className="practice-review-heading">Session history</h3>
          <table className="hand-accuracy-table" aria-label="Session history">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Score</th>
                <th scope="col">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((record, index) => (
                <tr key={`${record.playedAt}-${index}`}>
                  <td>{new Date(record.playedAt).toLocaleDateString()}</td>
                  <td>
                    {record.correctAnswers}/{record.totalQuestions}
                  </td>
                  <td>{Math.round((record.correctAnswers / record.totalQuestions) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
