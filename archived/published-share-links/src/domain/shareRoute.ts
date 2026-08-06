/**
 * Client-side route parsing for v3.2 shared range pages (no router dependency).
 *
 * A shared page lives at `#/r/:id`, optionally carrying a private-link token as
 * `?t=<token>` or `&t=<token>`. This is distinct from slice 90's `#range=<hash>`
 * local-import links, so the two never collide.
 */

export interface ShareRoute {
  id: string
  token?: string
}

/**
 * Percent-decode a captured segment, returning null on malformed encoding
 * rather than letting `decodeURIComponent`'s `URIError` escape. A hash like
 * `#/r/%` would otherwise throw during App render, blanking the whole app.
 */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/**
 * Parse a location hash into a {@link ShareRoute}, or null when it is not a
 * shared-range route. Accepts an optional leading `#` and a `t` query param for
 * the private-link token. A malformed percent-encoding yields null (a corrupt
 * link is treated as no route), never a thrown error.
 */
export function parseShareRoute(hash: string): ShareRoute | null {
  const match = /^#?\/r\/([^/?&#]+)(.*)$/.exec(hash)
  if (!match) return null
  const id = safeDecode(match[1])
  if (!id) return null
  const tokenMatch = /[?&]t=([^&]+)/.exec(match[2])
  if (!tokenMatch) return { id }
  const token = safeDecode(tokenMatch[1])
  if (token === null) return null
  return { id, token }
}

/**
 * Parse a location hash into a shared-PACK route (`#/p/:id`), or null when it is
 * not one. Mirrors {@link parseShareRoute} for the v5.1 pack page (slice 139's
 * `shared_packs`); distinct from the `#/r/:id` single-range route so the two
 * never collide.
 */
export function parsePackShareRoute(hash: string): ShareRoute | null {
  const match = /^#?\/p\/([^/?&#]+)(.*)$/.exec(hash)
  if (!match) return null
  const id = safeDecode(match[1])
  if (!id) return null
  const tokenMatch = /[?&]t=([^&]+)/.exec(match[2])
  if (!tokenMatch) return { id }
  const token = safeDecode(tokenMatch[1])
  if (token === null) return null
  return { id, token }
}
