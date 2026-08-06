/**
 * Dependency-free base64url codec for UTF-8 text.
 *
 * Share links have to round-trip identically on both platforms, but the classic
 * `btoa(unescape(encodeURIComponent(s)))` recipe leans on browser-only globals
 * (`btoa`/`atob`) and the deprecated Annex B `escape`/`unescape` — neither is
 * guaranteed on Hermes, where the React Native app runs. This module does the
 * same transform with plain arithmetic, so a link minted on one platform decodes
 * byte-for-byte on the other.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Reverse lookup for `ALPHABET`, plus the standard `+`/`/` so either flavor decodes. */
const VALUES: Record<string, number> = {}
for (let index = 0; index < ALPHABET.length; index += 1) VALUES[ALPHABET[index]] = index
VALUES['+'] = 62
VALUES['/'] = 63

/** UTF-8 encode via `encodeURIComponent`, which is standard on every JS runtime. */
function utf8Bytes(text: string): number[] {
  const encoded = encodeURIComponent(text)
  const bytes: number[] = []
  for (let index = 0; index < encoded.length; index += 1) {
    const char = encoded[index]
    if (char === '%') {
      bytes.push(parseInt(encoded.slice(index + 1, index + 3), 16))
      index += 2
    } else {
      bytes.push(char.charCodeAt(0))
    }
  }
  return bytes
}

/** Inverse of `utf8Bytes`: percent-encode every byte and let the runtime decode. */
function utf8Text(bytes: number[]): string {
  let percent = ''
  for (const byte of bytes) percent += `%${byte.toString(16).padStart(2, '0')}`
  return decodeURIComponent(percent)
}

/** Encode `text` as unpadded base64url (`-`/`_`, no trailing `=`). */
export function encodeBase64Url(text: string): string {
  const bytes = utf8Bytes(text)
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
    out += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63]
    // A 1-byte tail yields 2 chars, a 2-byte tail 3 — the padding is dropped.
    if (remaining > 1) out += ALPHABET[(chunk >> 6) & 63]
    if (remaining > 2) out += ALPHABET[chunk & 63]
  }
  return out
}

/**
 * Decode unpadded (or padded) base64url back to text. Throws when the input has
 * characters outside the alphabet or a length that cannot be a base64 tail.
 */
export function decodeBase64Url(encoded: string): string {
  const clean = encoded.replace(/=+$/, '')
  if (clean.length % 4 === 1) throw new Error('Invalid base64 length.')
  const bytes: number[] = []
  for (let index = 0; index < clean.length; index += 4) {
    const quad = clean.slice(index, index + 4)
    let chunk = 0
    for (let offset = 0; offset < 4; offset += 1) {
      const char = quad[offset]
      if (char === undefined) {
        chunk = (chunk << 6) | 0
        continue
      }
      const value = VALUES[char]
      if (value === undefined) throw new Error(`Invalid base64 character: ${char}`)
      chunk = (chunk << 6) | value
    }
    bytes.push((chunk >> 16) & 255)
    if (quad.length > 2) bytes.push((chunk >> 8) & 255)
    if (quad.length > 3) bytes.push(chunk & 255)
  }
  return utf8Text(bytes)
}
