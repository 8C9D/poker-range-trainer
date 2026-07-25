import { useMemo, useState } from 'react'
import { routeHash } from '../app/routes'
import { distinctStackDepths } from '../domain/rangeLibrary'
import {
  describeSpot,
  SPOT_SITUATION_LABELS,
  SPOT_SITUATIONS,
  seatsForTableSize,
  spotKey,
  spotPrefillMetadata,
  type Spot,
  type SpotSituation,
} from '../domain/spot'
import { buildSpotCoverage, inferLibraryContext } from '../domain/spotCoverage'
import {
  POSITION_LABELS,
  TABLE_SIZE_LABELS,
  TABLE_SIZES,
  type Position,
  type SavedRange,
  type TableSize,
} from '../types/range'
import './SpotCoverage.css'

/** Stack depths always offered, so a thin library still has formats to inspect. */
const COMMON_DEPTHS = [20, 40, 100, 200]

/** The new-range link for a spot the library does not cover yet. */
function createRangeHref(spot: Spot): string {
  return routeHash({ screen: 'newRange', prefill: spotPrefillMetadata(spot) })
}

interface SpotCoverageProps {
  ranges: SavedRange[]
  /** Start the spot drill at the format currently shown; omitted where it cannot run. */
  onPlaySpots?: (format: { tableSize: TableSize; stackDepthBb: number }) => void
}

/**
 * The v8.1 coverage map: a seat-by-situation grid of which standard preflop
 * spots the library answers. Selecting a cell lists its spots, each either
 * naming the range that covers it or linking into a new range pre-filled with
 * that spot's metadata.
 */
export function SpotCoverage({ ranges, onPlaySpots }: SpotCoverageProps) {
  const inferred = useMemo(() => inferLibraryContext(ranges), [ranges])
  const [tableSize, setTableSize] = useState<TableSize>(inferred.tableSize)
  const [stackDepthBb, setStackDepthBb] = useState(inferred.stackDepthBb)
  const [openCell, setOpenCell] = useState<string | null>(null)

  const depths = useMemo(
    () =>
      [...new Set([...COMMON_DEPTHS, ...distinctStackDepths(ranges), stackDepthBb])].sort(
        (a, b) => a - b,
      ),
    [ranges, stackDepthBb],
  )
  const report = useMemo(
    () => buildSpotCoverage(ranges, tableSize, stackDepthBb),
    [ranges, tableSize, stackDepthBb],
  )

  const seats = seatsForTableSize(tableSize)
  const cellAt = (position: Position, situation: SpotSituation) =>
    report.cells.find((cell) => cell.position === position && cell.situation === situation)
  const selected = report.cells.find((cell) => `${cell.position}/${cell.situation}` === openCell)

  return (
    <section className="coach-card spot-coverage" aria-label="Spot coverage">
      <div className="spot-coverage-header">
        <h3>Spot coverage</h3>
        <div className="spot-coverage-controls">
          <select
            className="coach-input"
            value={tableSize}
            onChange={(event) => {
              setTableSize(event.target.value as TableSize)
              setOpenCell(null)
            }}
            aria-label="Table size for spot coverage"
          >
            {TABLE_SIZES.map((size) => (
              <option key={size} value={size}>
                {TABLE_SIZE_LABELS[size]}
              </option>
            ))}
          </select>
          <select
            className="coach-input"
            value={String(stackDepthBb)}
            onChange={(event) => {
              setStackDepthBb(Number(event.target.value))
              setOpenCell(null)
            }}
            aria-label="Stack depth for spot coverage"
          >
            {depths.map((depth) => (
              <option key={depth} value={depth}>
                {depth}bb
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="spot-coverage-summary-row">
        <p className="spot-coverage-summary coach-tabular">
          {report.covered} of {report.total} standard spots covered ·{' '}
          {report.coveragePercentage.toFixed(0)}%
        </p>
        {onPlaySpots && report.covered > 0 && (
          <button
            type="button"
            className="coach-btn primary"
            onClick={() => onPlaySpots({ tableSize, stackDepthBb })}
          >
            Play these spots
          </button>
        )}
      </div>

      <div className="spot-coverage-scroll">
        <table className="spot-coverage-table">
          <thead>
            <tr>
              <th scope="col">Seat</th>
              {SPOT_SITUATIONS.map((situation) => (
                <th key={situation} scope="col">
                  {SPOT_SITUATION_LABELS[situation]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seats.map((position) => (
              <tr key={position}>
                <th scope="row">{POSITION_LABELS[position]}</th>
                {SPOT_SITUATIONS.map((situation) => {
                  const cell = cellAt(position, situation)
                  const key = `${position}/${situation}`
                  if (!cell) {
                    return (
                      <td key={situation} className="spot-coverage-cell-none" aria-label="No spot">
                        –
                      </td>
                    )
                  }
                  const state =
                    cell.covered === 0 ? 'none' : cell.covered === cell.total ? 'full' : 'partial'
                  return (
                    <td key={situation}>
                      <button
                        type="button"
                        className={`spot-coverage-cell spot-coverage-${state}`}
                        aria-pressed={openCell === key}
                        aria-label={`${POSITION_LABELS[position]} ${SPOT_SITUATION_LABELS[situation].toLowerCase()}: ${cell.covered} of ${cell.total} covered`}
                        onClick={() => setOpenCell(openCell === key ? null : key)}
                      >
                        <span className="coach-tabular">
                          {cell.covered}/{cell.total}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ul className="spot-coverage-detail" aria-label="Spots in the selected cell">
          {selected.entries.map((entry) => (
            <li key={spotKey(entry.spot)}>
              <span className="spot-coverage-detail-text">{describeSpot(entry.spot)}</span>
              {entry.match ? (
                <a
                  className="coach-chip"
                  href={routeHash({ screen: 'range', id: entry.match.range.id, tab: 'overview' })}
                >
                  {entry.match.range.name}
                </a>
              ) : (
                <a className="coach-btn" href={createRangeHref(entry.spot)}>
                  Create
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
