import type { SavedRange } from '../types/range'
import { RANGE_ACTIONS, type RangeAction } from '../types/range'
import { decodeBase64Url, encodeBase64Url } from './base64url'
import { generateHandMatrix, isValidHand, type PokerHand } from './pokerHands'
import { countRangeCombos, rangeComboPercentage } from './comboSelection'

/**
 * Per-range interchange format (v3.2 import/export ecosystem).
 *
 * A versioned JSON envelope wrapping a single `SavedRange`, distinct from the
 * whole-library backup (v3). The `kind` tag lets an importer recognize the file.
 */

export const RANGE_EXPORT_KIND = 'poker-range'
export const RANGE_EXPORT_VERSION = 1

export const RANGE_PACK_KIND = 'poker-range-pack'
export const RANGE_PACK_VERSION = 1

export interface RangeExport {
  kind: typeof RANGE_EXPORT_KIND
  version: number
  range: SavedRange
}

/** Wrap a saved range in the export envelope. */
export function buildRangeExport(range: SavedRange): RangeExport {
  return { kind: RANGE_EXPORT_KIND, version: RANGE_EXPORT_VERSION, range }
}

/** Serialize a single range to a pretty-printed JSON export string. */
export function serializeRangeExport(range: SavedRange): string {
  return JSON.stringify(buildRangeExport(range), null, 2)
}

/**
 * Encode a range into a compact, URL-safe string for a shareable link.
 *
 * The same versioned JSON envelope as the file export, base64url-encoded
 * (UTF-8 safe). Client-only — no backend or hosting involved; the decoder
 * (`decodeRangeFromHash`) reverses it.
 */
export function encodeRangeToHash(range: SavedRange): string {
  return encodeBase64Url(serializeRangeExport(range))
}

/**
 * Decode a shareable-link string back into a `SavedRange`. Throws a clear
 * `Error` when the string is not valid base64url or not a valid range export.
 */
export function decodeRangeFromHash(hash: string): SavedRange {
  let json: string
  try {
    json = decodeBase64Url(hash)
  } catch {
    throw new Error('Share link is not a valid range.')
  }
  return parseRangeExport(json)
}

/**
 * Format a range as a spreadsheet-friendly CSV summary.
 *
 * A small summary block (name, hand count, combos, percentage) followed by a
 * blank line and a `hand` column listing each hand in stored order. Deterministic
 * and dependency-free; values with commas/quotes are CSV-escaped.
 */
export function formatRangeCsv(range: SavedRange): string {
  const combos = countRangeCombos(range.hands, range.comboSelections)
  const percentage = rangeComboPercentage(range.hands, range.comboSelections)
  const lines = [
    'field,value',
    `name,${csvEscape(range.name)}`,
    `hands,${range.hands.length}`,
    `combos,${combos}`,
    `percentage,${percentage.toFixed(1)}`,
    '',
    'hand',
    ...range.hands.map((hand) => csvEscape(hand)),
  ]
  return lines.join('\n')
}

/**
 * Parse a range CSV produced by {@link formatRangeCsv} back into a name + hands.
 *
 * Reads the optional `name,<value>` summary row and the `hand` column (every
 * non-blank line after the `hand` header). Values are CSV-unescaped and each
 * hand is validated via `isValidHand`. Throws a clear `Error` when there is no
 * `hand` column, the column is empty, or a value is not a valid hand. Hands are
 * returned in file order; the storage layer normalizes (de-dupes, orders) on
 * save.
 */
export function parseRangeCsv(csv: string): { name?: string; hands: PokerHand[] } {
  const lines = csv.split(/\r?\n/)

  // Scan the summary block for an optional name, stopping at the `hand` header.
  let name: string | undefined
  let headerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'hand') {
      headerIndex = i
      break
    }
    if (name === undefined && lines[i].startsWith('name,')) {
      name = csvUnescape(lines[i].slice('name,'.length))
    }
  }

  if (headerIndex === -1) {
    throw new Error('CSV has no "hand" column.')
  }

  const hands: PokerHand[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (raw.length === 0) continue
    const hand = csvUnescape(raw)
    if (!isValidHand(hand)) {
      throw new Error(`CSV contains an invalid hand: "${hand}".`)
    }
    hands.push(hand)
  }

  if (hands.length === 0) {
    throw new Error('CSV "hand" column is empty.')
  }

  return name !== undefined ? { name, hands } : { hands }
}

/**
 * Action fill colors for the SVG export, mirroring `ActionPalette.css` so an
 * exported image matches the on-screen multi-color grid.
 */
const ACTION_COLORS: Record<RangeAction, string> = {
  fold: '#6b7280',
  call: '#1a7f37',
  raise: '#d4a72c',
  threeBet: '#cf222e',
  fourBet: '#8250df',
  jam: '#6e1423',
  mixed: '#0969da',
}

/** Fill for an in-range cell with no per-hand action (the accent color). */
const IN_RANGE_COLOR = '#aa3bff'
/** Fill for an out-of-range cell. */
const OUT_OF_RANGE_COLOR = '#2b2540'

/**
 * Render a range's 13×13 grid as a standalone SVG image string.
 *
 * Pure and dependency-free: draws one square per starting hand in standard
 * matrix order with its hand label. In-range hands are filled with the accent
 * color; when `handActions` is present, each assigned hand uses its action color
 * (matching the on-screen palette). The result is a real, printable image users
 * can open in any browser or image viewer.
 */
export function formatRangeSvg(range: SavedRange): string {
  const matrix = generateHandMatrix()
  const inRange = new Set(range.hands)
  const handActions = range.handActions
  const cell = 40
  const size = cell * 13

  const cells: string[] = []
  matrix.forEach((row, i) => {
    row.forEach((hand, j) => {
      const x = j * cell
      const y = i * cell
      let fill = OUT_OF_RANGE_COLOR
      const action = handActions?.[hand]
      if (action && RANGE_ACTIONS.includes(action)) {
        fill = ACTION_COLORS[action]
      } else if (inRange.has(hand)) {
        fill = IN_RANGE_COLOR
      }
      const textFill = fill === OUT_OF_RANGE_COLOR ? '#888' : '#fff'
      cells.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="#1a1626" stroke-width="1"/>` +
          `<text x="${x + cell / 2}" y="${y + cell / 2}" fill="${textFill}" font-family="sans-serif" font-size="11" text-anchor="middle" dominant-baseline="central">${xmlEscape(hand)}</text>`,
      )
    })
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<title>${xmlEscape(range.name)}</title>` +
    cells.join('') +
    `</svg>`
  )
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Inverse of {@link csvEscape}: unwrap a quoted field and undouble `""`. */
function csvUnescape(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"')
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse and validate a single-range export string, returning the inner
 * `SavedRange`. Throws a clear `Error` when the JSON is invalid, the envelope is
 * the wrong `kind`/`version`, or the `range` is structurally invalid (the rest
 * of the app's storage layer still sanitizes optional fields on save).
 */
export function parseRangeExport(json: string): SavedRange {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Range file is not valid JSON.')
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Range file is not a range export.')
  }
  if (parsed.kind !== RANGE_EXPORT_KIND) {
    throw new Error('Range file is not a poker-range export.')
  }
  if (parsed.version !== RANGE_EXPORT_VERSION) {
    throw new Error(`Unsupported range export version: ${String(parsed.version)}.`)
  }
  if (!isValidRangeShape(parsed.range)) {
    throw new Error('Range file is missing a valid range.')
  }
  return parsed.range as unknown as SavedRange
}

/** Structural check shared by single-range and range-pack parsing. */
function isValidRangeShape(range: unknown): boolean {
  return (
    isPlainObject(range) &&
    typeof range.id === 'string' &&
    typeof range.name === 'string' &&
    Array.isArray(range.hands)
  )
}

/**
 * A range pack bundles multiple ranges into one shareable/movable file. Like the
 * single-range export it is a versioned envelope; `name` is an optional label.
 */
export interface RangePack {
  kind: typeof RANGE_PACK_KIND
  version: number
  name?: string
  ranges: SavedRange[]
}

/** Wrap ranges in a pack envelope (omitting `name` when blank). */
export function buildRangePack(name: string, ranges: SavedRange[]): RangePack {
  const trimmed = name.trim()
  return {
    kind: RANGE_PACK_KIND,
    version: RANGE_PACK_VERSION,
    ...(trimmed ? { name: trimmed } : {}),
    ranges,
  }
}

/** Serialize a range pack to a pretty-printed JSON string. */
export function serializeRangePack(name: string, ranges: SavedRange[]): string {
  return JSON.stringify(buildRangePack(name, ranges), null, 2)
}

/**
 * Parse and validate a range-pack string, returning its optional name and the
 * contained ranges. Throws a clear `Error` on invalid JSON, the wrong
 * `kind`/`version`, a non-array `ranges`, or any structurally invalid range.
 */
export function parseRangePack(json: string): { name?: string; ranges: SavedRange[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Pack file is not valid JSON.')
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Pack file is not a range pack.')
  }
  if (parsed.kind !== RANGE_PACK_KIND) {
    throw new Error('Pack file is not a poker-range-pack.')
  }
  if (parsed.version !== RANGE_PACK_VERSION) {
    throw new Error(`Unsupported range pack version: ${String(parsed.version)}.`)
  }
  if (!Array.isArray(parsed.ranges) || !parsed.ranges.every(isValidRangeShape)) {
    throw new Error('Pack file is missing valid ranges.')
  }
  const name = typeof parsed.name === 'string' ? parsed.name : undefined
  return { name, ranges: parsed.ranges as unknown as SavedRange[] }
}
