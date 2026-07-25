import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSpotAccuracy,
  recordSpotAccuracy,
  SPOT_ACCURACY_STORAGE_KEY,
} from './spotAccuracyStorage'

beforeEach(() => {
  localStorage.clear()
})

const BTN = 'sixMax|btn|foldedToYou|-|100'
const BB = 'sixMax|bb|facingOpen|co|100'

describe('spotAccuracyStorage', () => {
  it('starts empty', () => {
    expect(loadSpotAccuracy()).toEqual({})
  })

  it('records a session and accumulates across sessions', () => {
    recordSpotAccuracy([{ spotKey: BTN, attempts: 5, correct: 4 }])
    recordSpotAccuracy([
      { spotKey: BTN, attempts: 3, correct: 1 },
      { spotKey: BB, attempts: 2, correct: 2 },
    ])

    expect(loadSpotAccuracy()).toEqual({
      [BTN]: { spotKey: BTN, attempts: 8, correct: 5 },
      [BB]: { spotKey: BB, attempts: 2, correct: 2 },
    })
  })

  it('never creates a record for an empty session', () => {
    recordSpotAccuracy([])

    expect(localStorage.getItem(SPOT_ACCURACY_STORAGE_KEY)).toBeNull()
  })

  it('falls back to empty for corrupt or wrongly-shaped storage', () => {
    localStorage.setItem(SPOT_ACCURACY_STORAGE_KEY, 'not json')
    expect(loadSpotAccuracy()).toEqual({})

    localStorage.setItem(SPOT_ACCURACY_STORAGE_KEY, '[1,2]')
    expect(loadSpotAccuracy()).toEqual({})
  })

  it('drops malformed entries but keeps the valid ones', () => {
    localStorage.setItem(
      SPOT_ACCURACY_STORAGE_KEY,
      JSON.stringify({
        a: { spotKey: BTN, attempts: 4, correct: 3 },
        b: { spotKey: '', attempts: 1, correct: 1 },
        c: { spotKey: BB, attempts: -1, correct: 0 },
        d: 'nonsense',
      }),
    )

    expect(loadSpotAccuracy()).toEqual({ [BTN]: { spotKey: BTN, attempts: 4, correct: 3 } })
  })

  it('re-keys entries by their own spotKey', () => {
    localStorage.setItem(
      SPOT_ACCURACY_STORAGE_KEY,
      JSON.stringify({ wrongKey: { spotKey: BTN, attempts: 2, correct: 2 } }),
    )

    expect(Object.keys(loadSpotAccuracy())).toEqual([BTN])
  })
})
