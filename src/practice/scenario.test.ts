import { describe, it, expect } from 'vitest'
import { answerVerbs, feedbackLine, scenarioLine } from './scenario'
import type { SavedRange } from '../types/range'

function makeRange(metadata?: SavedRange['metadata']): SavedRange {
  return {
    id: 'r1',
    name: 'Test',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(metadata ? { metadata } : {}),
  }
}

describe('answerVerbs', () => {
  it("uses the range's action verb against Fold", () => {
    expect(answerVerbs(makeRange({ actionType: 'open' }))).toEqual({ yes: 'Open', no: 'Fold' })
    expect(answerVerbs(makeRange({ actionType: 'threeBet' }))).toEqual({
      yes: '3-bet',
      no: 'Fold',
    })
  })

  it('falls back to In range without an action type', () => {
    expect(answerVerbs(makeRange())).toEqual({ yes: 'In range', no: 'Fold' })
  })
})

describe('scenarioLine', () => {
  it('returns null without metadata', () => {
    expect(scenarioLine(makeRange())).toBeNull()
  })

  it('describes seat, stack, and action', () => {
    expect(
      scenarioLine(makeRange({ position: 'utg', stackDepthBb: 100, actionType: 'open' })),
    ).toBe('You are UTG, 100bb. First to act — open or fold.')
  })

  it('mentions the opponent seat when set', () => {
    expect(
      scenarioLine(makeRange({ position: 'bb', versusPosition: 'btn', actionType: 'defend' })),
    ).toBe('You are BB. Defending against BTN.')
  })

  it('describes stack depth alone', () => {
    expect(scenarioLine(makeRange({ stackDepthBb: 40 }))).toBe('40bb effective.')
  })
})

describe('feedbackLine', () => {
  const verbs = { yes: 'Open', no: 'Fold' }

  it('confirms hits briefly', () => {
    expect(feedbackLine('AKs', true, true, verbs)).toBe('Correct — open AKs.')
    expect(feedbackLine('72o', false, true, verbs)).toBe('Correct — 72o is a fold.')
  })

  it('explains misses', () => {
    expect(feedbackLine('A9s', false, false, verbs)).toBe(
      "A9s isn't in this range — fold it.",
    )
    expect(feedbackLine('AKs', true, false, verbs)).toBe('AKs is in this range — open it.')
  })
})
