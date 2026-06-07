import { describe, it, expect } from 'vitest'
import { formatCard } from './cards'
import { buildPostflopScenario, describeHeroHand } from './postflopScenario'

const base = {
  heroHand: 'AsKh',
  flop: 'Kd7c2h',
  potSize: 10,
  stackDepth: 100,
  facing: 'villain bets pot',
}

describe('buildPostflopScenario', () => {
  it('builds a valid scenario', () => {
    const scenario = buildPostflopScenario(base)
    expect(scenario.heroHand.map(formatCard)).toEqual(['As', 'Kh'])
    expect(scenario.flop.map(formatCard)).toEqual(['Kd', '7c', '2h'])
    expect(scenario.potSize).toBe(10)
    expect(scenario.facing).toBe('villain bets pot')
  })

  it('rejects a hand that is not two cards', () => {
    expect(() => buildPostflopScenario({ ...base, heroHand: 'As' })).toThrow(/two cards/)
  })

  it('rejects a flop that is not three cards', () => {
    expect(() => buildPostflopScenario({ ...base, flop: 'Kd7c' })).toThrow(/three cards/)
  })

  it('rejects a card shared between hand and board', () => {
    expect(() => buildPostflopScenario({ ...base, heroHand: 'KdKh' })).toThrow(/Duplicate card/)
  })
})

describe('describeHeroHand', () => {
  it('returns the hero hand category tags vs the flop', () => {
    expect(describeHeroHand(buildPostflopScenario(base))).toEqual(['topPair'])
  })
})
