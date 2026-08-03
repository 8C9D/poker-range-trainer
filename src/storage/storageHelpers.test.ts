import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asMember, isNonNegativeFinite, readJson, removeJson, writeJson } from './storageHelpers'

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

  it('reads as empty when the store refuses access instead of taking the app down', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    try {
      expect(readJson(KEY)).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('writeJson', () => {
  it('serializes the value under the key', () => {
    writeJson('helpers-test', { a: 1 })

    expect(localStorage.getItem('helpers-test')).toBe('{"a":1}')
  })

  it('turns a full or unavailable store into a message a person can act on', () => {
    const quota = new Error('QuotaExceededError')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota
    })

    try {
      expect(() => writeJson('helpers-test', { a: 1 })).toThrow(/storage is full or unavailable/)
      // The browser's own error is kept for debugging rather than swallowed.
      let thrown: unknown
      try {
        writeJson('helpers-test', { a: 1 })
      } catch (error) {
        thrown = error
      }
      expect((thrown as Error).cause).toBe(quota)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('removeJson', () => {
  it('deletes the stored value', () => {
    localStorage.setItem('helpers-remove-test', '1')

    removeJson('helpers-remove-test')

    expect(localStorage.getItem('helpers-remove-test')).toBeNull()
  })

  it('reports a store that refuses the delete the same way a failed save does', () => {
    const blocked = new DOMException('The operation is insecure.', 'SecurityError')
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw blocked
    })

    try {
      expect(() => removeJson('helpers-remove-test')).toThrow(/storage is full or unavailable/)
    } finally {
      spy.mockRestore()
    }
  })
})
