import { describe, it, expect, beforeEach } from 'vitest'
import type { HandAccuracyStat } from '../types/practice'
import {
  HAND_ACCURACY_STORAGE_KEY,
  loadHandAccuracy,
  recordHandAccuracy,
} from './handAccuracyStorage'

// Isolate storage per test so cases never leak into one another or depend on order.
beforeEach(() => {
  localStorage.clear()
})

function stat(hand: string, over: Partial<HandAccuracyStat> = {}): HandAccuracyStat {
  return { hand, attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0, ...over }
}

describe('loadHandAccuracy', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadHandAccuracy()).toEqual({})
  })

  it('returns an empty map when the stored JSON is corrupt', () => {
    localStorage.setItem(HAND_ACCURACY_STORAGE_KEY, '{not valid json')
    expect(loadHandAccuracy()).toEqual({})
  })

  it('returns an empty map when the stored value is not an object', () => {
    localStorage.setItem(HAND_ACCURACY_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadHandAccuracy()).toEqual({})

    localStorage.setItem(HAND_ACCURACY_STORAGE_KEY, JSON.stringify('a string'))
    expect(loadHandAccuracy()).toEqual({})
  })

  it('skips malformed hand entries and drops a range with no valid hands', () => {
    localStorage.setItem(
      HAND_ACCURACY_STORAGE_KEY,
      JSON.stringify({
        r1: {
          AA: stat('AA', { attempts: 3, correct: 2, falseNegatives: 1 }),
          missingHand: { attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0 },
          negative: { hand: 'KK', attempts: -1, correct: 0, falsePositives: 0, falseNegatives: 0 },
          nonNumeric: { hand: 'QQ', attempts: 'lots', correct: 0, falsePositives: 0, falseNegatives: 0 },
        },
        empty: { bad: 42 },
      }),
    )
    expect(loadHandAccuracy()).toEqual({
      r1: { AA: stat('AA', { attempts: 3, correct: 2, falseNegatives: 1 }) },
    })
  })

  it("re-keys inner entries by each stat's own hand", () => {
    localStorage.setItem(HAND_ACCURACY_STORAGE_KEY, JSON.stringify({ r1: { staleKey: stat('AA') } }))
    expect(loadHandAccuracy()).toEqual({ r1: { AA: stat('AA') } })
  })
})

describe('recordHandAccuracy', () => {
  it('records a first session and round-trips it', () => {
    recordHandAccuracy('r1', [stat('AA', { attempts: 2, correct: 1, falseNegatives: 1 })])
    expect(loadHandAccuracy()).toEqual({
      r1: { AA: stat('AA', { attempts: 2, correct: 1, falseNegatives: 1 }) },
    })
  })

  it('accumulates a second session onto the first and adds new hands', () => {
    recordHandAccuracy('r1', [stat('AA', { attempts: 2, correct: 2 })])
    recordHandAccuracy('r1', [
      stat('AA', { attempts: 1, correct: 0, falseNegatives: 1 }),
      stat('KK', { attempts: 1, correct: 1 }),
    ])
    expect(loadHandAccuracy().r1).toEqual({
      AA: stat('AA', { attempts: 3, correct: 2, falseNegatives: 1 }),
      KK: stat('KK', { attempts: 1, correct: 1 }),
    })
  })

  it('is a no-op for an empty handStats array', () => {
    recordHandAccuracy('r1', [])
    expect(loadHandAccuracy()).toEqual({})
  })

  it('records ranges independently', () => {
    recordHandAccuracy('a', [stat('AA')])
    recordHandAccuracy('b', [stat('KK')])
    expect(loadHandAccuracy()).toEqual({
      a: { AA: stat('AA') },
      b: { KK: stat('KK') },
    })
  })
})
