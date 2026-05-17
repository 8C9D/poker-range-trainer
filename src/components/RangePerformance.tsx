import { handAccuracyRate, rankHandAccuracy } from '../domain/practice'
import type { RangeHandAccuracy } from '../types/practice'
import type { SavedRange } from '../types/range'
import { HandHeatmap } from './HandHeatmap'
import './PracticeSession.css'
import './RangePerformance.css'

interface RangePerformanceProps {
  /** The saved range whose per-hand accuracy is shown. */
  range: SavedRange
  /** Cumulative per-hand accuracy for the range (may be empty). */
  accuracy: RangeHandAccuracy
  /** Return to the library view. */
  onClose: () => void
}

/**
 * Range-specific performance view (v2.1): a weakest-first table of per-hand
 * accuracy for one range, so the user can see exactly which hands they struggle
 * with. Ranking and accuracy come from the `rankHandAccuracy` / `handAccuracyRate`
 * domain helpers; this component is pure presentation fed by props.
 */
export function RangePerformance({ range, accuracy, onClose }: RangePerformanceProps) {
  const ranked = rankHandAccuracy(accuracy)

  return (
    <section className="practice-session" aria-label="Range performance">
      <header className="practice-header">
        <h2>Performance: {range.name}</h2>
        <button type="button" onClick={onClose}>
          Back to library
        </button>
      </header>

      {ranked.length === 0 ? (
        <p className="range-performance-empty">
          No practice data yet — practice this range to see per-hand accuracy.
        </p>
      ) : (
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
    </section>
  )
}
