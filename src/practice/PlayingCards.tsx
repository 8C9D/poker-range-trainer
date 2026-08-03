import type { Card } from '../domain/cards'

const SUIT_GLYPHS: Record<Card['suit'], string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_NAMES: Record<Card['suit'], string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
}
const SUIT_VARS: Record<Card['suit'], string> = {
  s: 'var(--spade)',
  h: 'var(--heart)',
  d: 'var(--diamond)',
  c: 'var(--club)',
}

/**
 * Two concrete playing-card faces for a drill prompt, using the 4-color deck
 * tokens.
 *
 * Each face is one image with its own name ("A of spades"): the suit is drawn
 * as a glyph, which a screen reader either skips or reads as punctuation, so
 * without the label the prompt announced two bare ranks and the suits — half of
 * what makes a hand suited or not — were lost.
 */
export function PlayingCards({ cards }: { cards: Card[] }) {
  return (
    <div className="playing-cards" data-testid="playing-cards">
      {cards.map((card) => (
        <div
          key={card.rank + card.suit}
          className="playing-card"
          role="img"
          aria-label={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
          style={{ color: SUIT_VARS[card.suit] }}
          data-testid={`card-${card.rank}${card.suit}`}
        >
          <span className="playing-card-rank">{card.rank}</span>
          <span className="playing-card-suit" aria-hidden="true">
            {SUIT_GLYPHS[card.suit]}
          </span>
        </div>
      ))}
    </div>
  )
}
