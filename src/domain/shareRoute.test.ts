import { describe, it, expect } from 'vitest'
import { parsePackShareRoute, parseShareRoute } from './shareRoute'

describe('parseShareRoute', () => {
  it('parses a public share route', () => {
    expect(parseShareRoute('#/r/abc123')).toEqual({ id: 'abc123' })
  })

  it('parses a private share route with a token', () => {
    expect(parseShareRoute('#/r/abc123?t=secret')).toEqual({ id: 'abc123', token: 'secret' })
  })

  it('accepts a hash with no leading #', () => {
    expect(parseShareRoute('/r/xyz')).toEqual({ id: 'xyz' })
  })

  it('decodes percent-encoded values', () => {
    expect(parseShareRoute('#/r/a%20b?t=x%26y')).toEqual({ id: 'a b', token: 'x&y' })
  })

  it('returns null for non-share hashes', () => {
    expect(parseShareRoute('')).toBeNull()
    expect(parseShareRoute('#range=abc')).toBeNull()
    expect(parseShareRoute('#/r/')).toBeNull()
    expect(parseShareRoute('#/other')).toBeNull()
  })

  it('returns null for a pack route', () => {
    expect(parseShareRoute('#/p/abc')).toBeNull()
  })
})

describe('parsePackShareRoute', () => {
  it('parses a public pack route', () => {
    expect(parsePackShareRoute('#/p/pack123')).toEqual({ id: 'pack123' })
  })

  it('parses a private pack route with a token', () => {
    expect(parsePackShareRoute('#/p/pack123?t=secret')).toEqual({ id: 'pack123', token: 'secret' })
  })

  it('decodes percent-encoded values', () => {
    expect(parsePackShareRoute('#/p/a%20b?t=x%26y')).toEqual({ id: 'a b', token: 'x&y' })
  })

  it('returns null for non-pack hashes (including range routes)', () => {
    expect(parsePackShareRoute('')).toBeNull()
    expect(parsePackShareRoute('#/p/')).toBeNull()
    expect(parsePackShareRoute('#/r/abc')).toBeNull()
    expect(parsePackShareRoute('#range=abc')).toBeNull()
  })
})
