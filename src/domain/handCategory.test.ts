import { describe, it, expect } from 'vitest'
import { parseBoard } from './cards'
import { categorizeHand } from './handCategory'

function categorize(hand: string, flop: string) {
  return categorizeHand(parseBoard(hand), parseBoard(flop))
}

describe('categorizeHand', () => {
  it('tags top pair', () => {
    expect(categorize('AsKh', 'Kd7c2h')).toEqual(['topPair'])
  })

  it('tags an underpair (pocket pair below top board card)', () => {
    expect(categorize('9s9h', 'Kd7c2h')).toEqual(['pair'])
  })

  it('tags an overpair', () => {
    expect(categorize('AsAd', 'Kd7c2h')).toEqual(['overpair'])
  })

  it('tags a set', () => {
    expect(categorize('7s7h', 'Kd7c2h')).toEqual(['set'])
  })

  it('tags two pair', () => {
    expect(categorize('Kc7d', 'Kd7c2h')).toEqual(['twoPair'])
  })

  it('tags trips when a hole card matches a paired board', () => {
    expect(categorize('KsQd', 'Kd Kc 2h')).toEqual(['trips'])
  })

  it('tags middle and bottom pair', () => {
    expect(categorize('7s5d', 'Kd7c2h')).toEqual(['middlePair'])
    expect(categorize('2s5d', 'Kd7c2h')).toEqual(['bottomPair'])
  })

  it('tags a flush draw', () => {
    expect(categorize('AhKh', 'Qh7h2c')).toEqual(['flushDraw'])
  })

  it('tags a top pair plus flush draw', () => {
    expect(categorize('QhJh', 'Qh7h2c')).toEqual(expect.arrayContaining(['topPair', 'flushDraw']))
  })

  it('tags an open-ended straight draw', () => {
    expect(categorize('9s8d', 'Tc7h2s')).toEqual(['straightDraw'])
  })

  it('tags a wheel straight draw using the low ace', () => {
    expect(categorize('Ah2d', '3c4s9h')).toContain('straightDraw')
  })

  it('tags a made straight as a straight, never as a draw', () => {
    // 9s8d on 7c6h5s completes the 5-6-7-8-9 straight.
    expect(categorize('9s8d', '7c6h5s')).toEqual(['straight'])
  })

  it('tags a made wheel straight using the low ace', () => {
    // Ah2d on 3c4s5h completes A-2-3-4-5.
    expect(categorize('Ah2d', '3c4s5h')).toEqual(['straight'])
  })

  it('tags air when nothing connects', () => {
    expect(categorize('Js4d', 'Kd7c2h')).toEqual(['air'])
  })

  it('throws on wrong card counts', () => {
    expect(() => categorizeHand(parseBoard('As'), parseBoard('Kd7c2h'))).toThrow(/two cards/)
    expect(() => categorizeHand(parseBoard('AsKh'), parseBoard('Kd7c'))).toThrow(/three cards/)
  })
})
