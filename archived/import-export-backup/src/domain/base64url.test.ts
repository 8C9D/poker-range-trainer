import { describe, expect, it } from 'vitest'
import { decodeBase64Url, encodeBase64Url } from './base64url'

/** The browser recipe this module replaces, used as the reference encoding. */
function browserEncode(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

describe('encodeBase64Url', () => {
  it('matches the browser btoa recipe for ASCII of every tail length', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'hello world', '{"kind":"poker-range"}']) {
      expect(encodeBase64Url(text)).toBe(browserEncode(text))
    }
  })

  it('matches the browser recipe for multi-byte UTF-8', () => {
    for (const text of ['café', 'ΑΒΓ', '日本語', '♠♥♦♣', '🂡 AKs']) {
      expect(encodeBase64Url(text)).toBe(browserEncode(text))
    }
  })

  it('emits only URL-safe characters', () => {
    // 0xFB 0xEF encodes to "++8" in standard base64, so this exercises both swaps.
    const encoded = encodeBase64Url('ÿ~û￾ï?>')
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('decodeBase64Url', () => {
  it('round-trips text of every tail length', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'café 日本語 🂡', 'a'.repeat(1000)]) {
      expect(decodeBase64Url(encodeBase64Url(text))).toBe(text)
    }
  })

  it('decodes padded standard base64 as well as unpadded base64url', () => {
    expect(decodeBase64Url('aGVsbG8=')).toBe('hello')
    expect(decodeBase64Url('aGVsbG8')).toBe('hello')
  })

  it('rejects characters outside the alphabet', () => {
    expect(() => decodeBase64Url('!!!not base64!!!')).toThrow(/Invalid base64 character/)
  })

  it('rejects a length that cannot be a base64 tail', () => {
    expect(() => decodeBase64Url('aGVsbG8gd29ybGQh1')).toThrow(/Invalid base64 length/)
  })
})
