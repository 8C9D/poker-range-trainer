import type { SavedRange } from '../types/range'
import { RANGE_ACTIONS, type RangeAction } from '../types/range'
import { decodeBase64Url, encodeBase64Url } from './base64url'
import { areValidHands, generateHandMatrix, isValidHand, type PokerHand } from './pokerHands'
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
  const rows = parseCsvRows(csv)

  // Scan the summary block for an optional name, stopping at the `hand` header.
  let name: string | undefined
  let headerIndex = -1
  let handColumn = -1
  for (let i = 0; i < rows.length; i++) {
    const normalized = rows[i].map((field, index) =>
      (index === 0 ? field.replace(/^\uFEFF/, '') : field).trim().toLowerCase(),
    )
    if (name === undefined && normalized[0] === 'name') {
      name = rows[i][1] ?? ''
      continue
    }
    handColumn = normalized.indexOf('hand')
    if (handColumn !== -1) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    throw new Error('CSV has no "hand" column.')
  }

  const hands: PokerHand[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const hand = rows[i][handColumn]?.trim() ?? ''
    if (hand.length === 0) continue
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
 * The exported image's palette: the resolved light-theme values of the tokens
 * `theme.css` gives the on-screen grid.
 *
 * Literals rather than `var(...)` because the file is opened outside the app,
 * where no stylesheet defines the tokens and every cell would fall back to
 * black. Light because that is the app's default theme and the one an image
 * meant for printing and sharing should carry. They are kept honest by a guard
 * test that reads the same declarations back out of `theme.css`.
 */
export const SVG_PALETTE = {
  '--act-fold': '#696a66',
  '--act-call': '#287750',
  '--act-raise': '#c2502f',
  '--act-3bet': '#7261c9',
  '--act-4bet': '#3469b4',
  '--act-jam': '#785907',
  '--act-mixed': '#555758',
  /** Ink on any action fill. */
  '--on-action': '#fffef9',
  /** Fill for an in-range cell with no per-hand action, and its ink. */
  '--gold-fill': '#d9ab33',
  '--on-accent': '#241c05',
  /** An out-of-range cell, and the same cell on the pocket-pair diagonal. */
  '--cellbg': '#f1efe8',
  '--pairbg': '#efede4',
  /** Ink on either unselected fill. */
  '--ink': '#22252a',
  /** Cell border. */
  '--line': '#dfdcd0',
} as const

const ACTION_COLORS: Record<RangeAction, string> = {
  fold: SVG_PALETTE['--act-fold'],
  call: SVG_PALETTE['--act-call'],
  raise: SVG_PALETTE['--act-raise'],
  threeBet: SVG_PALETTE['--act-3bet'],
  fourBet: SVG_PALETTE['--act-4bet'],
  jam: SVG_PALETTE['--act-jam'],
  mixed: SVG_PALETTE['--act-mixed'],
}

/**
 * Render a range's 13×13 grid as a standalone SVG image string.
 *
 * Pure and dependency-free: draws one square per starting hand in standard
 * matrix order with its hand label. In-range hands take the selected-cell fill;
 * when `handActions` is present, each assigned hand uses its action color. Every
 * fill is the on-screen one (see the palette above), so the downloaded image is
 * the chart the user was just looking at rather than a differently-colored copy
 * of it. The result is a real, printable image users can open in any browser or
 * image viewer.
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
      let fill: string = i === j ? SVG_PALETTE['--pairbg'] : SVG_PALETTE['--cellbg']
      let textFill: string = SVG_PALETTE['--ink']
      const action = handActions?.[hand]
      if (action && RANGE_ACTIONS.includes(action)) {
        fill = ACTION_COLORS[action]
        textFill = SVG_PALETTE['--on-action']
      } else if (inRange.has(hand)) {
        fill = SVG_PALETTE['--gold-fill']
        textFill = SVG_PALETTE['--on-accent']
      }
      cells.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="${SVG_PALETTE['--line']}" stroke-width="1"/>` +
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
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Parse standard comma-separated rows, including escaped quotes and quoted newlines. */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const finishRow = () => {
    row.push(field)
    rows.push(row)
    row = []
    field = ''
  }

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index += 1
      finishRow()
    } else {
      field += char
    }
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.')
  if (field.length > 0 || row.length > 0) finishRow()
  return rows
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value))
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
  if (!isValidSavedRange(parsed.range)) {
    throw new Error('Range file is missing a valid range.')
  }
  return parsed.range as unknown as SavedRange
}

/**
 * The optional per-hand overlays, and the value shape each one's readers assume.
 *
 * The five required fields are all a FORK needs checked: it hands the payload to
 * the storage layer, which normalizes every overlay on the way in. A shared page
 * renders the payload before anything saves it, and reads these directly —
 * `countRangeCombos` does `new Set(comboSelections[hand])`, so a number there
 * throws mid-render and takes the page down instead of showing the "not found"
 * it keeps for exactly this case.
 *
 * Each entry is checked only for the shape its readers iterate or call string
 * methods on. The CONTENTS stay the storage layer's business: an unrecognized
 * action or an impossible combo key is still dropped on save rather than
 * rejecting the whole payload here, so a range written by a later version of
 * the app degrades instead of failing.
 */
const OVERLAY_VALUE_SHAPES: Record<string, (value: unknown) => boolean> = {
  comboSelections: (value) =>
    Array.isArray(value) && value.every((key) => typeof key === 'string'),
  handActions: (value) => typeof value === 'string',
  handNotes: (value) => typeof value === 'string',
  mixedStrategies: (value) => Array.isArray(value),
}

/** True when every overlay the payload carries is a record of readable values. */
function hasReadableOverlays(range: Record<string, unknown>): boolean {
  return Object.entries(OVERLAY_VALUE_SHAPES).every(([field, isReadable]) => {
    const overlay = range[field]
    if (overlay === undefined) return true
    return isPlainObject(overlay) && Object.values(overlay).every(isReadable)
  })
}

/**
 * Structural check for a range from an untrusted source.
 *
 * Shared by single-range and range-pack parsing, and by the cloud share pages:
 * a published row is publisher-controlled in exactly the way an imported file
 * is. Checking only the hands is not enough — a payload with canonical hands
 * and a non-string `name` renders straight into `<h1>{range.name}</h1>` and
 * takes the page down with "Objects are not valid as a React child". Nor are the
 * required fields enough on their own; see {@link OVERLAY_VALUE_SHAPES}.
 */
export function isValidSavedRange(range: unknown): range is SavedRange {
  return (
    isPlainObject(range) &&
    typeof range.id === 'string' &&
    range.id.length > 0 &&
    typeof range.name === 'string' &&
    areValidHands(range.hands) &&
    isValidTimestamp(range.createdAt) &&
    isValidTimestamp(range.updatedAt) &&
    hasReadableOverlays(range)
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

/**
 * Structural check for a whole pack from an untrusted source.
 *
 * A pack ARRIVING AS A FILE gets this from {@link parseRangePack}, which also
 * names which part of a bad file is bad. One fetched from the cloud has no file
 * to name and the shared page only needs a yes/no — but it needs the same
 * answer. Checking `ranges` alone (all the page used to do) left the envelope's
 * own `name` free to be an object, which React refuses to render, so a crafted
 * pack took the viewer's page down rather than reading as not-found.
 */
export function isValidRangePack(pack: unknown): pack is RangePack {
  return (
    isPlainObject(pack) &&
    pack.kind === RANGE_PACK_KIND &&
    pack.version === RANGE_PACK_VERSION &&
    (pack.name === undefined || typeof pack.name === 'string') &&
    Array.isArray(pack.ranges) &&
    pack.ranges.every(isValidSavedRange)
  )
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
  if (!Array.isArray(parsed.ranges) || !parsed.ranges.every(isValidSavedRange)) {
    throw new Error('Pack file is missing valid ranges.')
  }
  const name = typeof parsed.name === 'string' ? parsed.name : undefined
  return { name, ranges: parsed.ranges as unknown as SavedRange[] }
}
