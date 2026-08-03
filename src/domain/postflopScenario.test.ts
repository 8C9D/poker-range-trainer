import { describe, it, expect } from 'vitest'
import { formatCard } from './cards'
import {
  buildPostflopScenario,
  describeHeroHand,
  isFacingAggression,
  suggestDecision,
} from './postflopScenario'

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

describe('isFacingAggression', () => {
  it('detects a bet/raise in the facing text', () => {
    expect(isFacingAggression(buildPostflopScenario({ ...base, facing: 'villain bets pot' }))).toBe(
      true,
    )
    expect(
      isFacingAggression(buildPostflopScenario({ ...base, facing: 'checked to you' })),
    ).toBe(false)
  })

  it('detects raise/jam/shove/all-in phrasings', () => {
    for (const facing of [
      'villain raises',
      'hero jams',
      'villain shoves',
      'villain is all-in',
      'villain all in',
      'villain allin',
    ]) {
      expect(isFacingAggression(buildPostflopScenario({ ...base, facing }))).toBe(true)
    }
  })

  it('does not flag passive or check lines as aggression', () => {
    for (const facing of ['checks to you', 'villain checks', 'first to act']) {
      expect(isFacingAggression(buildPostflopScenario({ ...base, facing }))).toBe(false)
    }
  })

  it('does not treat an "N-bet pot" descriptor as facing a bet', () => {
    for (const facing of ['3-bet pot, checked to hero', '4-bet pot', 'checked to hero in a 3-bet pot']) {
      expect(isFacingAggression(buildPostflopScenario({ ...base, facing }))).toBe(false)
    }
  })
})

describe('suggestDecision', () => {
  function decide(input: Partial<typeof base>) {
    return suggestDecision(buildPostflopScenario({ ...base, ...input })).decision
  }

  it('raises strong made hands versus a bet, bets when first to act', () => {
    // AsKh on Kd7c2h = top pair.
    expect(decide({ facing: 'villain bets pot' })).toBe('raise')
    expect(decide({ facing: 'checked to you' })).toBe('bet')
  })

  it('plays a made straight for value, not as a draw', () => {
    // 9s8d on 7c6h5s is a completed straight — value, not a semi-bluff.
    expect(decide({ heroHand: '9s8d', flop: '7c6h5s', facing: 'villain bets' })).toBe('raise')
    expect(decide({ heroHand: '9s8d', flop: '7c6h5s', facing: 'checked to you' })).toBe('bet')
  })

  it('plays a made flush for value rather than folding it as air', () => {
    // AhKh on Qh7h2h is the nut flush. With no `flush` category it carried no
    // tag at all, so the heuristic reached its last branch and folded it.
    expect(decide({ heroHand: 'AhKh', flop: 'Qh7h2h', facing: 'villain bets' })).toBe('raise')
    expect(decide({ heroHand: 'AhKh', flop: 'Qh7h2h', facing: 'checked to you' })).toBe('bet')
  })

  it('calls draws versus a bet and semi-bluffs when checked to', () => {
    // AhKh on Qh7h2c = flush draw, no pair.
    expect(decide({ heroHand: 'AhKh', flop: 'Qh7h2c', facing: 'villain bets' })).toBe('call')
    expect(decide({ heroHand: 'AhKh', flop: 'Qh7h2c', facing: 'checked to you' })).toBe('bet')
  })

  it('calls/checks medium pairs', () => {
    // 7s5d on Kd7c2h = middle pair.
    expect(decide({ heroHand: '7s5d', facing: 'villain bets' })).toBe('call')
    expect(decide({ heroHand: '7s5d', facing: 'checked to you' })).toBe('check')
  })

  it('folds air to a bet and checks when first to act', () => {
    // Js4d on Kd7c2h = air.
    expect(decide({ heroHand: 'Js4d', facing: 'villain bets' })).toBe('fold')
    expect(decide({ heroHand: 'Js4d', facing: 'checked to you' })).toBe('check')
  })
})
