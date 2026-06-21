import { describe, it, expect } from 'vitest'
import { parseBoard } from './cards'
import { tagFlopTexture } from './boardTexture'

function tags(board: string) {
  return tagFlopTexture(parseBoard(board))
}

describe('tagFlopTexture', () => {
  it('tags a monotone ace-high flop', () => {
    expect(tags('AsKs2s')).toEqual(expect.arrayContaining(['aceHigh', 'monotone', 'wet']))
    expect(tags('AsKs2s')).not.toContain('rainbow')
  })

  it('tags a paired rainbow flop as dry', () => {
    const t = tags('7h7d2c')
    expect(t).toEqual(expect.arrayContaining(['paired', 'rainbow', 'dry']))
    expect(t).not.toContain('connected')
    expect(t).not.toContain('wet')
  })

  it('tags an unpaired rainbow disconnected flop as dry', () => {
    // The canonical dry board: King-high, three suits, ranks too far apart to
    // connect. Unlike 7h7d2c the dry tag here comes via the non-paired path
    // (isConnected returns false), not because pairing skips the straight check.
    const t = tags('Kh8d3c')
    expect(t).toEqual(['rainbow', 'dry'])
    expect(t).not.toContain('paired')
    expect(t).not.toContain('connected')
    expect(t).not.toContain('wet')
  })

  it('tags a connected flop', () => {
    expect(tags('9s8h7d')).toEqual(expect.arrayContaining(['connected', 'rainbow', 'wet']))
  })

  it('treats the ace as low for wheel connectedness', () => {
    expect(tags('Ah3d2c')).toContain('connected')
  })

  it('tags a two-tone flop', () => {
    expect(tags('Kh9h2c')).toContain('twoTone')
    expect(tags('Kh9h2c')).toContain('wet')
  })

  it('returns tags in canonical order', () => {
    expect(tags('AsKs2s')).toEqual(['aceHigh', 'monotone', 'wet'])
  })

  it('throws when the board is not three cards', () => {
    expect(() => tagFlopTexture(parseBoard('AsKd'))).toThrow(/exactly three/)
  })
})
