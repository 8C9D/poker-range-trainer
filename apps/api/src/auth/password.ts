import argon2 from 'argon2'

/** OWASP's minimum Argon2id configuration: 19 MiB, two iterations, one lane. */
export const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const

/**
 * A valid Argon2id hash used when no account credential is available. Keeping
 * this fixed ensures absent-account verification has the same expensive path.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$JNokblJq2C+guq+vpjk+1w$aucmJN15Ko0kn4GiArPKVqWCQXmSTGlRA1I5/ufa3kQ'

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordHashOptions)
}

const argon2idPhc =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

/**
 * Returns true for malformed, non-Argon2id, or below-policy hashes. Stronger
 * hashes stay valid so a policy increase never accidentally weakens a hash.
 */
export function needsPasswordRehash(passwordHash: string): boolean {
  try {
    const match = argon2idPhc.exec(passwordHash)
    if (!match) return true

    const [, memoryCost, timeCost, parallelism, , encodedOutput] = match
    if (!memoryCost || !timeCost || !parallelism || !encodedOutput) return true
    const outputLength = Buffer.from(encodedOutput, 'base64').length
    const meetsOrExceedsPolicy =
      Number(memoryCost) >= passwordHashOptions.memoryCost &&
      Number(timeCost) >= passwordHashOptions.timeCost &&
      Number(parallelism) === passwordHashOptions.parallelism &&
      outputLength >= passwordHashOptions.hashLength
    if (!meetsOrExceedsPolicy) return true

    const exactlyPolicy =
      Number(memoryCost) === passwordHashOptions.memoryCost &&
      Number(timeCost) === passwordHashOptions.timeCost &&
      Number(parallelism) === passwordHashOptions.parallelism &&
      outputLength === passwordHashOptions.hashLength
    if (exactlyPolicy) return argon2.needsRehash(passwordHash, passwordHashOptions)

    // A non-exact hash that reached this point has stronger work factors or output.
    return false
  } catch {
    return true
  }
}

/** Invalid or malformed stored values are authentication failures, not errors to expose. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    // Verification reads the encoded algorithm parameters from the stored hash.
    return await argon2.verify(passwordHash, password)
  } catch {
    return false
  }
}

/**
 * Use this for login checks. It always verifies one valid Argon2id hash when
 * no stored credential exists, avoiding an account-enumerating fast path.
 */
export async function verifyPasswordOrDummy(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  return verifyPassword(password, passwordHash ?? DUMMY_PASSWORD_HASH)
}
