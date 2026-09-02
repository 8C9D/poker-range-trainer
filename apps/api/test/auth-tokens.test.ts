import { describe, expect, it } from 'vitest'

import {
  generateAuthTokens,
  generateOpaqueToken,
  hashOpaqueToken,
  tokenHashMatches,
} from '../src/auth/tokens.js'

describe('auth capability tokens', () => {
  it('creates independent 256-bit URL-safe session and CSRF tokens', () => {
    const token = generateOpaqueToken()
    const { sessionToken, csrfToken } = generateAuthTokens()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(sessionToken).not.toBe(csrfToken)
  })

  it('persists only SHA-256 hashes and compares them in a malformed-safe way', () => {
    const raw = generateOpaqueToken()
    const persisted = hashOpaqueToken(raw)
    expect(persisted).toMatch(/^[0-9a-f]{64}$/)
    expect(persisted).not.toBe(raw)
    expect(tokenHashMatches(raw, persisted)).toBe(true)
    expect(tokenHashMatches(`${raw}x`, persisted)).toBe(false)
    expect(tokenHashMatches(raw, 'not-a-hash')).toBe(false)
    expect(tokenHashMatches(raw, 'A'.repeat(64))).toBe(false)
  })
})
