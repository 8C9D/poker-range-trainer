/**
 * Return a safe external URL for a range source reference, or null when the
 * reference is a citation/plain text (or uses a non-web scheme).
 */
export function sourceReferenceUrl(reference: string | undefined): string | null {
  const trimmed = reference?.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
