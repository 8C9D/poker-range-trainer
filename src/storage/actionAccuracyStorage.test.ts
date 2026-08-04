import { describe, it, expect, beforeEach } from 'vitest'
import type { ActionAccuracyStat } from '../domain/actionRange'
import type { RangeAction } from '../types/range'
import {
  ACTION_ACCURACY_STORAGE_KEY,
  loadActionAccuracy,
  recordActionAccuracy,
} from './actionAccuracyStorage'

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

function stat(action: RangeAction, over: Partial<ActionAccuracyStat> = {}): ActionAccuracyStat {
  return { action, attempts: 1, correct: 1, ...over }
}

describe('loadActionAccuracy', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadActionAccuracy()).toEqual({})
  })

  it('returns an empty map when the stored JSON is corrupt', () => {
    localStorage.setItem(ACTION_ACCURACY_STORAGE_KEY, '{not valid json')
    expect(loadActionAccuracy()).toEqual({})
  })

  it('returns an empty map when the stored value is not an object', () => {
    localStorage.setItem(ACTION_ACCURACY_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadActionAccuracy()).toEqual({})

    localStorage.setItem(ACTION_ACCURACY_STORAGE_KEY, JSON.stringify('a string'))
    expect(loadActionAccuracy()).toEqual({})
  })

  it('skips malformed action entries and drops a range with no valid actions', () => {
    localStorage.setItem(
      ACTION_ACCURACY_STORAGE_KEY,
      JSON.stringify({
        r1: {
          raise: stat('raise', { attempts: 3, correct: 2 }),
          missingAction: { attempts: 1, correct: 1 },
          unknownAction: { action: 'limp', attempts: 1, correct: 1 },
          negative: { action: 'call', attempts: -1, correct: 0 },
          nonNumeric: { action: 'jam', attempts: 'lots', correct: 0 },
          impossibleScore: { action: 'fold', attempts: 1, correct: 2 },
          fractionalCount: { action: 'threeBet', attempts: 1.5, correct: 1 },
        },
        empty: { bad: 42 },
      }),
    )
    expect(loadActionAccuracy()).toEqual({
      r1: { raise: stat('raise', { attempts: 3, correct: 2 }) },
    })
  })

  it("re-keys inner entries by each stat's own action", () => {
    localStorage.setItem(
      ACTION_ACCURACY_STORAGE_KEY,
      JSON.stringify({ r1: { staleKey: stat('raise') } }),
    )
    expect(loadActionAccuracy()).toEqual({ r1: { raise: stat('raise') } })
  })
})

describe('recordActionAccuracy', () => {
  it('records a first session and round-trips it', () => {
    recordActionAccuracy('r1', [stat('raise', { attempts: 2, correct: 1 })])
    expect(loadActionAccuracy()).toEqual({
      r1: { raise: stat('raise', { attempts: 2, correct: 1 }) },
    })
  })

  it('accumulates a second session onto the first and adds new actions', () => {
    recordActionAccuracy('r1', [stat('raise', { attempts: 2, correct: 2 })])
    recordActionAccuracy('r1', [
      stat('raise', { attempts: 1, correct: 0 }),
      stat('threeBet', { attempts: 1, correct: 1 }),
    ])
    expect(loadActionAccuracy().r1).toEqual({
      raise: stat('raise', { attempts: 3, correct: 2 }),
      threeBet: stat('threeBet', { attempts: 1, correct: 1 }),
    })
  })

  it('is a no-op for an empty actionStats array', () => {
    recordActionAccuracy('r1', [])
    expect(loadActionAccuracy()).toEqual({})
  })

  it('records ranges independently', () => {
    recordActionAccuracy('a', [stat('raise')])
    recordActionAccuracy('b', [stat('fold')])
    expect(loadActionAccuracy()).toEqual({
      a: { raise: stat('raise') },
      b: { fold: stat('fold') },
    })
  })

  it('rejects an impossible action score instead of persisting it', () => {
    expect(() =>
      recordActionAccuracy('r1', [stat('raise', { attempts: 1, correct: 2 })]),
    ).toThrow(/invalid action accuracy/)
    expect(loadActionAccuracy()).toEqual({})
  })
})
