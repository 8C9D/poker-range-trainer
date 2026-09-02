import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const tokenBytes = 32
const sha256Hex = /^[0-9a-f]{64}$/

export interface AuthTokens {
  sessionToken: string
  csrfToken: string
}

/** Generate a 256-bit opaque value that can be carried in a URL-safe cookie. */
export function generateOpaqueToken(): string {
  return randomBytes(tokenBytes).toString('base64url')
}

/** Session and CSRF capabilities must never share a value. */
export function generateAuthTokens(): AuthTokens {
  const sessionToken = generateOpaqueToken()
  let csrfToken = generateOpaqueToken()
  while (csrfToken === sessionToken) csrfToken = generateOpaqueToken()
  return { sessionToken, csrfToken }
}

/** The only representation appropriate for persistence. */
export function hashOpaqueToken(token: string): string {
  return hashOpaqueTokenDigest(token).toString('hex')
}

function hashOpaqueTokenDigest(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

/** Safe for untrusted token and database input; malformed values simply do not match. */
export function tokenHashMatches(token: string, persistedHash: string): boolean {
  if (!sha256Hex.test(persistedHash)) return false
  const candidate = hashOpaqueTokenDigest(token)
  const persisted = Buffer.from(persistedHash, 'hex')
  return timingSafeEqual(candidate, persisted)
}
