import {
  ACTION_TYPES,
  POSITIONS,
  TABLE_SIZES,
  type ActionType,
  type Position,
  type RangeMetadata,
  type TableSize,
} from '../types/range'

/**
 * Scenario metadata carried between screens as URL/route parameters.
 *
 * The v8.1 coverage map turns a missing spot into a link that opens the range
 * editor already describing that situation. Web puts the fields in a hash query
 * and mobile in expo-router search params, so the encode/validate pair lives here
 * and both platforms share one vocabulary check. Pure.
 */

/** The parameter names, kept short because they show up in a visible URL. */
export const SCENARIO_PARAM_KEYS = ['position', 'action', 'vs', 'table', 'stack'] as const

/** Loose shape of a router's parsed parameters, on either platform. */
export type ScenarioParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Read scenario metadata out of route parameters, or `null` when none are usable.
 *
 * Values are validated against their vocabularies and anything unrecognized is
 * dropped rather than trusted — these arrive from a URL a user can edit.
 */
export function parseScenarioParams(params: ScenarioParams): RangeMetadata | null {
  const metadata: RangeMetadata = {}

  const position = single(params.position)
  if (position && (POSITIONS as readonly string[]).includes(position)) {
    metadata.position = position as Position
  }
  const actionType = single(params.action)
  if (actionType && (ACTION_TYPES as readonly string[]).includes(actionType)) {
    metadata.actionType = actionType as ActionType
  }
  const versusPosition = single(params.vs)
  if (versusPosition && (POSITIONS as readonly string[]).includes(versusPosition)) {
    metadata.versusPosition = versusPosition as Position
  }
  const tableSize = single(params.table)
  if (tableSize && (TABLE_SIZES as readonly string[]).includes(tableSize)) {
    metadata.tableSize = tableSize as TableSize
  }
  const stack = Number(single(params.stack))
  if (Number.isFinite(stack) && stack > 0) metadata.stackDepthBb = stack

  return Object.keys(metadata).length > 0 ? metadata : null
}

/** The inverse: only the fields {@link parseScenarioParams} can read back. */
export function encodeScenarioParams(metadata: RangeMetadata): Record<string, string> {
  const params: Record<string, string> = {}
  if (metadata.position) params.position = metadata.position
  if (metadata.actionType) params.action = metadata.actionType
  if (metadata.versusPosition) params.vs = metadata.versusPosition
  if (metadata.tableSize) params.table = metadata.tableSize
  if (metadata.stackDepthBb !== undefined) params.stack = String(metadata.stackDepthBb)
  return params
}
