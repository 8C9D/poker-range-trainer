import {
  matchRangeToSpot,
  seatsForTableSize,
  SPOT_SITUATIONS,
  standardSpots,
  type Spot,
  type SpotMatch,
  type SpotSituation,
} from './spot'
import {
  TABLE_SIZES,
  type Position,
  type SavedRange,
  type TableSize,
} from '../types/range'

/**
 * Which standard spots the saved library actually covers (v8.1).
 *
 * A study library grows one range at a time and its holes are invisible: nothing
 * on the Library screen says "you have never written down a big-blind defence
 * against the cutoff". Folding {@link standardSpots} through
 * {@link matchRangeToSpot} turns the library into a seat-by-situation map of what
 * is covered and what is missing. Pure — the caller passes the loaded ranges.
 */

/** One standard spot and the range that answers it, if any. */
export interface SpotCoverageEntry {
  spot: Spot
  match: SpotMatch | null
}

/** All the spots for one seat and situation — a single cell of the map. */
export interface SpotCoverageCell {
  position: Position
  situation: SpotSituation
  /** Every standard spot in this cell, in opponent order. */
  entries: SpotCoverageEntry[]
  covered: number
  total: number
}

export interface SpotCoverageReport {
  tableSize: TableSize
  stackDepthBb: number
  /** Cells in seat-then-situation order; seats with no spot at all are dropped. */
  cells: SpotCoverageCell[]
  covered: number
  total: number
  /** covered / total * 100, or 0 when there are no spots. */
  coveragePercentage: number
}

/**
 * Map the library's coverage of the standard spots at one table size and depth.
 *
 * Cells that hold no standard spot (a big blind with the pot folded to it, an
 * under-the-gun player facing an open) are left out entirely rather than shown as
 * an empty gap, so every cell on the map is a spot the user could actually study.
 */
export function buildSpotCoverage(
  ranges: SavedRange[],
  tableSize: TableSize,
  stackDepthBb: number,
): SpotCoverageReport {
  const spots = standardSpots(tableSize, stackDepthBb)
  const cells: SpotCoverageCell[] = []
  let covered = 0

  for (const position of seatsForTableSize(tableSize)) {
    for (const situation of SPOT_SITUATIONS) {
      const cellSpots = spots.filter(
        (spot) => spot.position === position && spot.situation === situation,
      )
      if (cellSpots.length === 0) continue
      const entries = cellSpots.map((spot) => ({ spot, match: matchRangeToSpot(ranges, spot) }))
      const cellCovered = entries.filter((entry) => entry.match !== null).length
      covered += cellCovered
      cells.push({
        position,
        situation,
        entries,
        covered: cellCovered,
        total: entries.length,
      })
    }
  }

  return {
    tableSize,
    stackDepthBb,
    cells,
    covered,
    total: spots.length,
    coveragePercentage: spots.length === 0 ? 0 : (covered / spots.length) * 100,
  }
}

/**
 * The table size and stack depth the library is mostly written for.
 *
 * The map has to be drawn for *some* format, and asking the user to pick one
 * before they can see anything is worse than opening on the format they already
 * study. Takes the most common declared value among active ranges, falling back
 * to 6-max 100bb when the library declares nothing. Ties break toward the earlier
 * table size in the vocabulary, and the deeper stack.
 */
export function inferLibraryContext(ranges: SavedRange[]): {
  tableSize: TableSize
  stackDepthBb: number
} {
  const active = ranges.filter((range) => !range.archived)

  const tableCounts = new Map<TableSize, number>()
  const depthCounts = new Map<number, number>()
  for (const range of active) {
    const { tableSize, stackDepthBb } = range.metadata ?? {}
    if (tableSize) tableCounts.set(tableSize, (tableCounts.get(tableSize) ?? 0) + 1)
    if (stackDepthBb !== undefined && stackDepthBb > 0) {
      depthCounts.set(stackDepthBb, (depthCounts.get(stackDepthBb) ?? 0) + 1)
    }
  }

  let tableSize: TableSize = 'sixMax'
  let bestTable = 0
  for (const candidate of TABLE_SIZES) {
    const count = tableCounts.get(candidate) ?? 0
    if (count > bestTable) {
      bestTable = count
      tableSize = candidate
    }
  }

  let stackDepthBb = 100
  let bestDepth = 0
  for (const [depth, count] of depthCounts) {
    if (count > bestDepth || (count === bestDepth && depth > stackDepthBb)) {
      bestDepth = count
      stackDepthBb = depth
    }
  }

  return { tableSize, stackDepthBb }
}
