import { describe, expect, it } from 'vitest'
import { isNonNegativeFinite } from './storageHelpers'

describe('isNonNegativeFinite', () => {
  it('accepts zero and positive finite numbers', () => {
    expect(isNonNegativeFinite(0)).toBe(true)
    expect(isNonNegativeFinite(1)).toBe(true)
    expect(isNonNegativeFinite(42.5)).toBe(true)
  })

  it('rejects negative numbers', () => {
    expect(isNonNegativeFinite(-1)).toBe(false)
    expect(isNonNegativeFinite(-0.0001)).toBe(false)
  })

  it('rejects non-finite numbers', () => {
    expect(isNonNegativeFinite(Number.NaN)).toBe(false)
    expect(isNonNegativeFinite(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isNonNegativeFinite(Number.NEGATIVE_INFINITY)).toBe(false)
  })

  it('rejects non-number values', () => {
    expect(isNonNegativeFinite('1')).toBe(false)
    expect(isNonNegativeFinite(null)).toBe(false)
    expect(isNonNegativeFinite(undefined)).toBe(false)
    expect(isNonNegativeFinite({})).toBe(false)
  })
})
