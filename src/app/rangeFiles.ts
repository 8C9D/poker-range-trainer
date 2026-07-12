import {
  encodeRangeToHash,
  formatRangeCsv,
  formatRangeSvg,
  serializeRangeExport,
} from '../domain/rangeTransfer'
import type { SavedRange } from '../types/range'

/** Trigger a client-side download of `text` as `filename`. */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function safeRangeFileName(range: SavedRange): string {
  return range.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'range'
}

export function exportRangeJsonFile(range: SavedRange): void {
  downloadTextFile(`${safeRangeFileName(range)}.json`, serializeRangeExport(range))
}

export function exportRangeCsvFile(range: SavedRange): void {
  downloadTextFile(`${safeRangeFileName(range)}.csv`, formatRangeCsv(range), 'text/csv')
}

export function exportRangeSvgFile(range: SavedRange): void {
  downloadTextFile(`${safeRangeFileName(range)}.svg`, formatRangeSvg(range), 'image/svg+xml')
}

/**
 * Copy the client-side share link for `range` to the clipboard, falling back
 * to a prompt when the clipboard is unavailable (e.g. insecure contexts).
 */
export async function copyRangeShareLink(range: SavedRange): Promise<void> {
  const link = `${window.location.origin}${window.location.pathname}#range=${encodeRangeToHash(range)}`
  try {
    await navigator.clipboard.writeText(link)
    window.alert('Share link copied to clipboard.')
  } catch {
    window.prompt('Copy this share link:', link)
  }
}
