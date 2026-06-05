import { describe, it, expect } from 'vitest'
import { parseShareRoute } from './shareRoute'

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
})
