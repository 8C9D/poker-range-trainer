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
 * Parse a location hash into a {@link ShareRoute}, or null when it is not a
 * shared-range route. Accepts an optional leading `#` and a `t` query param for
 * the private-link token.
 */
export function parseShareRoute(hash: string): ShareRoute | null {
  const match = /^#?\/r\/([^/?&#]+)(.*)$/.exec(hash)
  if (!match) return null
  const id = decodeURIComponent(match[1])
  if (!id) return null
  const tokenMatch = /[?&]t=([^&]+)/.exec(match[2])
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined
  return token ? { id, token } : { id }
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
  const id = decodeURIComponent(match[1])
  if (!id) return null
  const tokenMatch = /[?&]t=([^&]+)/.exec(match[2])
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined
  return token ? { id, token } : { id }
}
