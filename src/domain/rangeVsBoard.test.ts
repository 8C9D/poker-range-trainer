import { describe, it, expect } from 'vitest'
import { parseBoard } from './cards'
import { bucketRangeOnBoard, expandHandClass } from './rangeVsBoard'

describe('expandHandClass', () => {
  it('expands a pocket pair to 6 combos', () => {
    expect(expandHandClass('AA')).toHaveLength(6)
  })

  it('expands a suited hand to 4 combos', () => {
    expect(expandHandClass('AKs')).toHaveLength(4)
  })

  it('expands an offsuit hand to 12 combos', () => {
    expect(expandHandClass('AKo')).toHaveLength(12)
  })

  it('throws on an invalid hand class', () => {
    expect(() => expandHandClass('XY')).toThrow(/Invalid hand class/)
  })
})

describe('bucketRangeOnBoard', () => {
  it('buckets combos by category and removes board blockers', () => {
    const flop = parseBoard('Kd7c2h')
    const tally = bucketRangeOnBoard(['AA', 'AKs'], flop)
    // AA: all 6 combos are overpairs (no ace on board).
    expect(tally.overpair).toBe(6)
    // AKs: 4 combos minus the one using Kd (blocked) = 3 top pairs.
    expect(tally.topPair).toBe(3)
    expect(tally.air).toBe(0)
  })

  it('counts a combo toward each tag it carries', () => {
    const flop = parseBoard('Qh7h2c')
    // QhJh would be blocked (Qh on board); the other QJs combos are not flushes
    // here, so use a clean draw example: AhKh is a flush draw with no made pair.
    const tally = bucketRangeOnBoard(['AKs'], flop)
    expect(tally.flushDraw).toBeGreaterThan(0)
  })

  it('buckets a made flush as a flush, not as air', () => {
    const flop = parseBoard('Qh7h2h')
    // Of AKs' 4 combos only AhKh is hearts, so exactly one makes the flush; the
    // other three miss the board entirely. Before the `flush` category the made
    // one landed in `air` alongside them.
    const tally = bucketRangeOnBoard(['AKs'], flop)
    expect(tally.flush).toBe(1)
    expect(tally.flushDraw).toBe(0)
    expect(tally.air).toBe(3)
  })

  it('buckets a completed straight as a straight, not a straight draw', () => {
    const flop = parseBoard('7c6h5s')
    // Every 98s combo makes the 5-6-7-8-9 straight on this board.
    const tally = bucketRangeOnBoard(['98s'], flop)
    expect(tally.straight).toBe(4)
    expect(tally.straightDraw).toBe(0)
  })
})
