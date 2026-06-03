import type { SavedRange } from '../types/range'

/**
 * Per-range interchange format (v3.2 import/export ecosystem).
 *
 * A versioned JSON envelope wrapping a single `SavedRange`, distinct from the
 * whole-library backup (v3). The `kind` tag lets an importer recognize the file.
 */

export const RANGE_EXPORT_KIND = 'poker-range'
export const RANGE_EXPORT_VERSION = 1

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
  const range = parsed.range
  if (
    !isPlainObject(range) ||
    typeof range.id !== 'string' ||
    typeof range.name !== 'string' ||
    !Array.isArray(range.hands)
  ) {
    throw new Error('Range file is missing a valid range.')
  }
  return range as unknown as SavedRange
}
