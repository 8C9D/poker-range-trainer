import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asMember, isNonNegativeFinite, readJson } from './storageHelpers'

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

describe('asMember', () => {
  const COLORS = ['red', 'green', 'blue'] as const

  it('returns the value when it is a member', () => {
    expect(asMember(COLORS, 'green')).toBe('green')
  })

  it('returns undefined for a non-member string', () => {
    expect(asMember(COLORS, 'purple')).toBeUndefined()
  })

  it('returns undefined for non-string values', () => {
    expect(asMember(COLORS, 1)).toBeUndefined()
    expect(asMember(COLORS, null)).toBeUndefined()
    expect(asMember(COLORS, undefined)).toBeUndefined()
  })
})

describe('readJson', () => {
  const KEY = 'storage-helpers.test-key'

  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns undefined when the key is absent', () => {
    expect(readJson(KEY)).toBeUndefined()
  })

  it('returns undefined when the stored text is not valid JSON', () => {
    localStorage.setItem(KEY, '{ not json')
    expect(readJson(KEY)).toBeUndefined()
  })

  it('returns the parsed value for valid JSON', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1, b: [2, 3] }))
    expect(readJson(KEY)).toEqual({ a: 1, b: [2, 3] })
  })

  it('round-trips primitive and array JSON', () => {
    localStorage.setItem(KEY, JSON.stringify([1, 2, 3]))
    expect(readJson(KEY)).toEqual([1, 2, 3])
    localStorage.setItem(KEY, JSON.stringify('hi'))
    expect(readJson(KEY)).toBe('hi')
  })
})
