import { describe, it, expect } from 'vitest'
import { formatCard, parseBoard, parseCard, rankValue } from './cards'

describe('parseCard', () => {
  it('parses rank and suit (case-insensitive rank)', () => {
    expect(parseCard('As')).toEqual({ rank: 'A', suit: 's' })
    expect(parseCard('td')).toEqual({ rank: 'T', suit: 'd' })
    expect(parseCard('7h')).toEqual({ rank: '7', suit: 'h' })
  })

  it('throws on malformed input', () => {
    expect(() => parseCard('A')).toThrow(/Invalid card/)
    expect(() => parseCard('Xs')).toThrow(/Invalid card/)
    expect(() => parseCard('Az')).toThrow(/Invalid card/)
  })
})

describe('rankValue / formatCard', () => {
  it('orders ace high and two low', () => {
    expect(rankValue('A')).toBe(14)
    expect(rankValue('2')).toBe(2)
  })

  it('round-trips a card to its string', () => {
    expect(formatCard(parseCard('Kd'))).toBe('Kd')
  })
})

describe('parseBoard', () => {
  it('parses a concatenated flop', () => {
    expect(parseBoard('AsKd7h').map(formatCard)).toEqual(['As', 'Kd', '7h'])
  })

  it('parses a space- or comma-separated flop', () => {
    expect(parseBoard('As Kd 7h').map(formatCard)).toEqual(['As', 'Kd', '7h'])
    expect(parseBoard('As,Kd,7h').map(formatCard)).toEqual(['As', 'Kd', '7h'])
  })

  it('rejects duplicate cards', () => {
    expect(() => parseBoard('AsAs2c')).toThrow(/Duplicate/)
  })

  it('rejects empty input', () => {
    expect(() => parseBoard('  ')).toThrow(/No cards/)
  })
})
