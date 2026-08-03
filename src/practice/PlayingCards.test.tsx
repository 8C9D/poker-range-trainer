import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayingCards } from './PlayingCards'
import type { Card } from '../domain/cards'

/**
 * The prompt the user stares at all session. Two things about it are load-bearing
 * and invisible to a passing render: each face has to carry its suit in a NAME
 * (the glyph is decorative, so an unlabelled card announces a bare rank and
 * "suited or not" is lost), and each has to take its ink from the `--card-*`
 * tokens rather than the themed suit accents, because the face stays paper in
 * dark mode and a lightened suit lands on cream.
 */
const AKs: Card[] = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 's' },
]

describe('PlayingCards', () => {
  it('draws one face per card, rank and suit glyph together', () => {
    render(<PlayingCards cards={AKs} />)

    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByTestId('card-As')).toHaveTextContent('A♠')
    expect(screen.getByTestId('card-Ks')).toHaveTextContent('K♠')
  })

  it('names every suit rather than leaving it to the glyph', () => {
    render(
      <PlayingCards
        cards={[
          { rank: 'A', suit: 's' },
          { rank: 'Q', suit: 'h' },
          { rank: '7', suit: 'd' },
          { rank: '2', suit: 'c' },
        ]}
      />,
    )

    expect(screen.getByRole('img', { name: 'A of spades' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Q of hearts' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '7 of diamonds' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2 of clubs' })).toBeInTheDocument()
  })

  it('hides the glyph from the name it would otherwise garble', () => {
    render(<PlayingCards cards={AKs} />)

    const glyphs = document.querySelectorAll('.playing-card-suit')
    expect(glyphs).toHaveLength(2)
    for (const glyph of glyphs) expect(glyph).toHaveAttribute('aria-hidden', 'true')
  })

  it('inks each suit from the card-face tokens, not the themed accents', () => {
    render(
      <PlayingCards
        cards={[
          { rank: 'A', suit: 's' },
          { rank: 'Q', suit: 'h' },
          { rank: '7', suit: 'd' },
          { rank: '2', suit: 'c' },
        ]}
      />,
    )

    expect(screen.getByTestId('card-As')).toHaveStyle({ color: 'var(--card-spade)' })
    expect(screen.getByTestId('card-Qh')).toHaveStyle({ color: 'var(--card-heart)' })
    expect(screen.getByTestId('card-7d')).toHaveStyle({ color: 'var(--card-diamond)' })
    expect(screen.getByTestId('card-2c')).toHaveStyle({ color: 'var(--card-club)' })
  })

  it('keeps the two identical ranks of a pair apart', () => {
    render(
      <PlayingCards
        cards={[
          { rank: 'A', suit: 'h' },
          { rank: 'A', suit: 'd' },
        ]}
      />,
    )

    expect(screen.getByRole('img', { name: 'A of hearts' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'A of diamonds' })).toBeInTheDocument()
  })
})
