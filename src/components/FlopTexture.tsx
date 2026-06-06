import { useMemo } from 'react'
import { formatCard, parseBoard } from '../domain/cards'
import { FLOP_TEXTURE_TAGS, tagFlopTexture, type FlopTextureTag } from '../domain/boardTexture'
import './FlopTexture.css'

/** Display labels for the flop texture tags. */
const TAG_LABELS: Record<FlopTextureTag, string> = {
  aceHigh: 'Ace high',
  paired: 'Paired',
  monotone: 'Monotone',
  twoTone: 'Two-tone',
  rainbow: 'Rainbow',
  connected: 'Connected',
  wet: 'Wet',
  dry: 'Dry',
}

interface FlopTextureProps {
  /** A board string such as "AsKd7h" or "As Kd 7h". */
  board: string
}

/**
 * Read-only display of a three-card flop and its texture tags. Parses the board
 * via the pure domain helpers and renders a clear inline error (rather than
 * throwing) when the input is not a valid three-card flop.
 */
export function FlopTexture({ board }: FlopTextureProps) {
  const result = useMemo(() => {
    try {
      const cards = parseBoard(board)
      const tags = tagFlopTexture(cards)
      return { cards, tags }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid flop.' }
    }
  }, [board])

  if ('error' in result) {
    return (
      <div className="flop-texture">
        <p className="flop-texture-error" role="alert">
          {result.error}
        </p>
      </div>
    )
  }

  return (
    <div className="flop-texture">
      <div className="flop-cards" aria-label="Flop">
        {result.cards.map((card) => (
          <span key={formatCard(card)} className={`flop-card suit-${card.suit}`}>
            {formatCard(card)}
          </span>
        ))}
      </div>
      <ul className="flop-tags">
        {FLOP_TEXTURE_TAGS.filter((tag) => result.tags.includes(tag)).map((tag) => (
          <li key={tag} className="flop-tag">
            {TAG_LABELS[tag]}
          </li>
        ))}
      </ul>
    </div>
  )
}
