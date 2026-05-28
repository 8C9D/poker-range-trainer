import { describe, expect, it } from 'vitest'
import { accuracyPercentage } from './accuracy'

describe('accuracyPercentage', () => {
  it('returns 0 (never NaN) when total is 0', () => {
    expect(accuracyPercentage(0, 0)).toBe(0)
    expect(accuracyPercentage(5, 0)).toBe(0)
  })

  it('scales the correct/total ratio to 0–100', () => {
    expect(accuracyPercentage(0, 4)).toBe(0)
    expect(accuracyPercentage(1, 2)).toBe(50)
    expect(accuracyPercentage(3, 4)).toBe(75)
    expect(accuracyPercentage(4, 4)).toBe(100)
  })
})
