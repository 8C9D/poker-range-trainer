import { describe, expect, it } from 'vitest'
import argon2 from 'argon2'

import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  needsPasswordRehash,
  passwordHashOptions,
  verifyPassword,
  verifyPasswordOrDummy,
} from '../src/auth/password.js'

describe('password hashing', () => {
  it('uses the configured OWASP-minimum Argon2id parameters', () => {
    expect(passwordHashOptions).toMatchObject({
      memoryCost: 19 * 1024,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    })
  })

  it('hashes and verifies passwords with Argon2id', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
    await expect(verifyPassword('incorrect password', hash)).resolves.toBe(false)
  })

  it('uses a fixed valid dummy Argon2id hash when no credential exists', async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    await expect(verifyPasswordOrDummy('anything', undefined)).resolves.toBe(false)
    await expect(verifyPasswordOrDummy('anything', '$argon2id$not-valid')).resolves.toBe(false)
  })

  it('inspects encoded parameters to flag hashes that need rehashing', async () => {
    const currentHash = await hashPassword('current passphrase')
    const weakHash = await argon2.hash('weak passphrase', {
      type: argon2.argon2id,
      memoryCost: 8 * 1024,
      timeCost: 1,
      parallelism: 1,
      hashLength: 32,
    })
    const otherAlgorithm = await argon2.hash('other algorithm', {
      type: argon2.argon2i,
      memoryCost: 19 * 1024,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    })
    const strongerHash = await argon2.hash('stronger passphrase', {
      type: argon2.argon2id,
      memoryCost: 20 * 1024,
      timeCost: 3,
      parallelism: 1,
      hashLength: 48,
    })
    const shortOutputHash = await argon2.hash('short output', {
      type: argon2.argon2id,
      memoryCost: 19 * 1024,
      timeCost: 2,
      parallelism: 1,
      hashLength: 16,
    })

    expect(needsPasswordRehash(currentHash)).toBe(false)
    expect(needsPasswordRehash(DUMMY_PASSWORD_HASH)).toBe(false)
    expect(needsPasswordRehash(weakHash)).toBe(true)
    expect(needsPasswordRehash(otherAlgorithm)).toBe(true)
    expect(needsPasswordRehash(strongerHash)).toBe(false)
    expect(needsPasswordRehash(shortOutputHash)).toBe(true)
    expect(needsPasswordRehash('not-a-password-hash')).toBe(true)
  })
})
