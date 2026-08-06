import { generateHandMatrix } from '../domain/pokerHands'
import { accuracyHeatLevel, handAccuracyRate } from '../domain/practice'
import type { RangeHandAccuracy } from '../types/practice'
import './HandHeatmap.css'

/** The 13x13 matrix is fixed, so build the flat hand list once at module load. */
const HANDS = generateHandMatrix().flat()

interface HandHeatmapProps {
  /** Cumulative per-hand accuracy for the range; hands absent read as untested. */
  accuracy: RangeHandAccuracy
}

/**
 * Read-only 13x13 heatmap of per-hand accuracy for one range: each cell is
 * colored by `accuracyHeatLevel` (untested / low / medium / high). Purely
 * presentational — unlike `HandGrid`, the cells are non-interactive `<div>`s.
 * The `data-heat` attribute exposes the level for tests and styling.
 */
const LEGEND = [
  { level: 'untested', label: 'Untested' },
  { level: 'low', label: '<50' },
  { level: 'medium', label: '50–79' },
  { level: 'high', label: '80+' },
] as const

export function HandHeatmap({ accuracy }: HandHeatmapProps) {
  return (
    <div>
      <ul className="heatmap-legend" aria-label="Heatmap legend">
        {LEGEND.map(({ level, label }) => (
          <li key={level}>
            <span className={`heat-swatch heat-${level}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <div className="hand-heatmap" role="group" aria-label="Accuracy heatmap">
        {HANDS.map((hand) => {
        const stat = accuracy[hand]
        const level = accuracyHeatLevel(stat)
        const title =
          stat && stat.attempts > 0
            ? `${hand}: ${handAccuracyRate(stat).toFixed(0)}% (${stat.attempts} attempt${
                stat.attempts === 1 ? '' : 's'
              })`
            : `${hand}: untested`
          return (
            <div
              key={hand}
              className={`heat-cell heat-${level}`}
              data-heat={level}
              role="img"
              aria-label={title}
              title={title}
            >
              {hand}
            </div>
          )
        })}
      </div>
    </div>
  )
}
