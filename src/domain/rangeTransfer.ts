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
