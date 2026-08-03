import { generateHandMatrix } from '../domain/pokerHands'
import type { PokerHand } from '../domain/pokerHands'

// Hand -> grid position, built once from the canonical 13x13 matrix.
const HAND_POSITIONS: Record<PokerHand, { row: number; col: number }> = (() => {
  const positions: Record<PokerHand, { row: number; col: number }> = {}
  generateHandMatrix().forEach((rowHands, row) => {
    rowHands.forEach((hand, col) => {
      positions[hand] = { row, col }
    })
  })
  return positions
})()

interface RangeThumbnailProps {
  hands: PokerHand[]
  /** Rendered size in px (square). */
  size?: number
  className?: string
  /**
   * Accessible name for the chart, e.g. from {@link describeRangeChart}. Pass it
   * where the chart is the content rather than a thumbnail beside a name.
   */
  label?: string
}

/**
 * A miniature 13x13 grid of a range: gold cells on the well background.
 * Decorative (aria-hidden) by default — shown next to the range's name, never
 * instead of it. Given a `label` it becomes an image with that text instead, for
 * the range's own screen where nothing else says which hands are in.
 */
export function RangeThumbnail({ hands, size = 44, className, label }: RangeThumbnailProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 13 13"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="range-thumbnail"
      className={className}
      style={{ flex: 'none', borderRadius: 6, background: 'var(--well)' }}
    >
      {hands.map((hand) => {
        const pos = HAND_POSITIONS[hand]
        if (!pos) return null
        return (
          <rect
            key={hand}
            x={pos.col + 0.12}
            y={pos.row + 0.12}
            width={0.76}
            height={0.76}
            rx={0.18}
            fill="var(--gold-fill)"
          />
        )
      })}
    </svg>
  )
}
