import { describe, expect, it } from 'vitest'
import { ALL_HANDS } from './pokerHands'
import { HAND_CLASSES, HAND_CLASS_LABELS, classifyHandClass } from './handClass'

describe('classifyHandClass', () => {
  it('splits pairs into premium, medium, and small', () => {
    expect(classifyHandClass('AA')).toBe('premiumPair')
    expect(classifyHandClass('JJ')).toBe('premiumPair')
    expect(classifyHandClass('TT')).toBe('mediumPair')
    expect(classifyHandClass('77')).toBe('mediumPair')
    expect(classifyHandClass('66')).toBe('smallPair')
    expect(classifyHandClass('22')).toBe('smallPair')
  })

  it('classes every ace-x hand by suitedness, ahead of any other signal', () => {
    expect(classifyHandClass('AKs')).toBe('suitedAce')
    expect(classifyHandClass('A5s')).toBe('suitedAce')
    expect(classifyHandClass('AKo')).toBe('offsuitAce')
    expect(classifyHandClass('A2o')).toBe('offsuitAce')
  })

  it('classes two-broadway holdings as broadway, not connectors', () => {
    expect(classifyHandClass('KQs')).toBe('suitedBroadway')
    expect(classifyHandClass('JTs')).toBe('suitedBroadway')
    expect(classifyHandClass('KTo')).toBe('offsuitBroadway')
  })

  it('separates connectors, gappers, and the rest below broadway', () => {
    expect(classifyHandClass('98s')).toBe('suitedConnector')
    expect(classifyHandClass('32s')).toBe('suitedConnector')
    expect(classifyHandClass('97s')).toBe('suitedGapper')
    expect(classifyHandClass('96s')).toBe('suitedGapper')
    expect(classifyHandClass('95s')).toBe('suitedOther')
    expect(classifyHandClass('98o')).toBe('offsuitConnector')
    // Offsuit gappers have no class of their own.
    expect(classifyHandClass('97o')).toBe('offsuitOther')
  })

  it('rejects a non-canonical hand', () => {
    expect(() => classifyHandClass('XX')).toThrow(/Invalid hand/)
  })

  it('partitions all 169 hands, using every class', () => {
    const counts = new Map<string, number>()
    for (const hand of ALL_HANDS) {
      const handClass = classifyHandClass(hand)
      counts.set(handClass, (counts.get(handClass) ?? 0) + 1)
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
    expect(total).toBe(169)
    for (const handClass of HAND_CLASSES) {
      expect(counts.get(handClass)).toBeGreaterThan(0)
      expect(HAND_CLASS_LABELS[handClass]).toBeTruthy()
    }
  })
})
