/**
 * Minimal playing-card model for v4 postflop training.
 *
 * Pure and dependency-free, kept separate from the preflop range model (which
 * works in hand classes like "AKs"). A `Card` is a concrete rank+suit; a board
 * is an ordered list of distinct cards (a flop is three).
 */

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const
export const SUITS = ['s', 'h', 'd', 'c'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

export interface Card {
  rank: Rank
  suit: Suit
}

/** Numeric strength of a rank (A high = 14 … 2 = 2), for ordering/gap math. */
export function rankValue(rank: Rank): number {
  return 14 - RANKS.indexOf(rank)
}

/** Canonical "As" string for a card. */
export function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`
}

function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value)
}

function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value)
}

/** Parse a single card like "As", "Td", "7h" (rank case-insensitive). */
export function parseCard(input: string): Card {
  const trimmed = input.trim()
  if (trimmed.length !== 2) {
    throw new Error(`Invalid card: "${input}".`)
  }
  const rank = trimmed[0].toUpperCase()
  const suit = trimmed[1].toLowerCase()
  if (!isRank(rank) || !isSuit(suit)) {
    throw new Error(`Invalid card: "${input}".`)
  }
  return { rank, suit }
}

/**
 * Parse a board string into distinct cards. Accepts concatenated ("AsKd7h") or
 * whitespace/comma-separated ("As Kd 7h") input. Throws on malformed or
 * duplicate cards.
 */
export function parseBoard(input: string): Card[] {
  const cleaned = input.trim()
  const tokens = /[\s,]/.test(cleaned)
    ? cleaned.split(/[\s,]+/).filter(Boolean)
    : (cleaned.match(/.{1,2}/g) ?? [])
  if (tokens.length === 0) {
    throw new Error('No cards provided.')
  }
  const cards = tokens.map(parseCard)
  const seen = new Set<string>()
  for (const card of cards) {
    const key = formatCard(card)
    if (seen.has(key)) {
      throw new Error(`Duplicate card: "${key}".`)
    }
    seen.add(key)
  }
  return cards
}
