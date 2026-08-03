import { generateHandMatrix, type PokerHand } from '../domain/pokerHands'
import { diffRanges, diffSummary } from '../domain/rangeDiff'
import './ActionGrid.css'
import './RangeDiffView.css'

/** The 13x13 matrix is fixed, so build the flat hand list once at module load. */
const HANDS = generateHandMatrix().flat()

type Bucket = 'common' | 'onlyA' | 'onlyB' | 'none'

interface RangeDiffViewProps {
  /** The two ranges to compare (hand lists). */
  handsA: PokerHand[]
  handsB: PokerHand[]
  /** Display labels for each range. */
  labelA?: string
  labelB?: string
}

/**
 * Read-only 13×13 comparison of two ranges via {@link diffRanges}: each cell is
 * colored by its bucket (in both / only A / only B / neither) and exposes
 * `data-bucket` for tests. Purely presentational — no clicks, no state.
 */
export function RangeDiffView({ handsA, handsB, labelA = 'A', labelB = 'B' }: RangeDiffViewProps) {
  const diff = diffRanges(handsA, handsB)
  const summary = diffSummary(diff)
  const bucketOf = new Map<PokerHand, Bucket>()
  for (const hand of diff.common) bucketOf.set(hand, 'common')
  for (const hand of diff.onlyA) bucketOf.set(hand, 'onlyA')
  for (const hand of diff.onlyB) bucketOf.set(hand, 'onlyB')

  return (
    <div className="range-diff-view">
      <ul className="range-diff-legend">
        <li className="range-diff-swatch bucket-common">Both: {summary.common}</li>
        <li className="range-diff-swatch bucket-onlyA">Only {labelA}: {summary.onlyA}</li>
        <li className="range-diff-swatch bucket-onlyB">Only {labelB}: {summary.onlyB}</li>
      </ul>
      <div className="action-grid range-diff-grid" role="group" aria-label="Range comparison">
        {HANDS.map((hand) => {
          const bucket = bucketOf.get(hand) ?? 'none'
          return (
            <div key={hand} className={`action-cell bucket-${bucket}`} data-bucket={bucket}>
              {hand}
            </div>
          )
        })}
      </div>
    </div>
  )
}
