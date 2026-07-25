import { useSyncExternalStore } from 'react'
import {
  ACTION_TYPES,
  POSITIONS,
  TABLE_SIZES,
  type ActionType,
  type Position,
  type RangeMetadata,
  type TableSize,
} from '../types/range'

export const RANGE_TABS = ['overview', 'edit', 'actions', 'combos', 'frequencies', 'stats'] as const
export type RangeTab = (typeof RANGE_TABS)[number]

export type AppRoute =
  | { screen: 'today' }
  | { screen: 'library' }
  | { screen: 'newRange'; prefill?: RangeMetadata }
  | { screen: 'range'; id: string; tab: RangeTab }
  | { screen: 'progress' }
  | { screen: 'account' }

/**
 * Scenario metadata carried on the new-range route, so a link can open the
 * editor already describing a situation (used by the v8.1 spot coverage map to
 * turn a gap into a range). Only the fields that identify a spot travel; every
 * value is validated against its vocabulary, and anything unrecognized is
 * dropped rather than trusted.
 */
function parseMetadataQuery(query: string): RangeMetadata | null {
  const params = new URLSearchParams(query)
  const prefill: RangeMetadata = {}

  const position = params.get('position')
  if (position && (POSITIONS as readonly string[]).includes(position)) {
    prefill.position = position as Position
  }
  const actionType = params.get('action')
  if (actionType && (ACTION_TYPES as readonly string[]).includes(actionType)) {
    prefill.actionType = actionType as ActionType
  }
  const versusPosition = params.get('vs')
  if (versusPosition && (POSITIONS as readonly string[]).includes(versusPosition)) {
    prefill.versusPosition = versusPosition as Position
  }
  const tableSize = params.get('table')
  if (tableSize && (TABLE_SIZES as readonly string[]).includes(tableSize)) {
    prefill.tableSize = tableSize as TableSize
  }
  const stack = Number(params.get('stack'))
  if (Number.isFinite(stack) && stack > 0) prefill.stackDepthBb = stack

  return Object.keys(prefill).length > 0 ? prefill : null
}

/** Serialize {@link parseMetadataQuery}'s fields back into a query string. */
function metadataQuery(prefill: RangeMetadata | undefined): string {
  if (!prefill) return ''
  const params = new URLSearchParams()
  if (prefill.position) params.set('position', prefill.position)
  if (prefill.actionType) params.set('action', prefill.actionType)
  if (prefill.versusPosition) params.set('vs', prefill.versusPosition)
  if (prefill.tableSize) params.set('table', prefill.tableSize)
  if (prefill.stackDepthBb !== undefined) params.set('stack', String(prefill.stackDepthBb))
  return params.toString()
}

/**
 * Parse the location hash into an app route. Share routes (#/r/:id, #/p/:id)
 * and #range= imports are handled before this in App and never reach here;
 * anything unrecognized falls back to the default screen.
 */
export function parseAppRoute(hash: string): AppRoute {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  switch (parts[0]) {
    case 'today':
      return { screen: 'today' }
    case 'library': {
      if (!parts[1]) return { screen: 'library' }
      if (parts[1] === 'new') {
        const prefill = parseMetadataQuery(query)
        return prefill ? { screen: 'newRange', prefill } : { screen: 'newRange' }
      }
      const id = decodeURIComponent(parts[1])
      const tab = (RANGE_TABS as readonly string[]).includes(parts[2])
        ? (parts[2] as RangeTab)
        : 'overview'
      return { screen: 'range', id, tab }
    }
    case 'progress':
      return { screen: 'progress' }
    case 'account':
      return { screen: 'account' }
    default:
      return { screen: 'today' }
  }
}

export function routeHash(route: AppRoute): string {
  switch (route.screen) {
    case 'today':
      return '#/today'
    case 'library':
      return '#/library'
    case 'newRange': {
      const query = metadataQuery(route.prefill)
      return query ? `#/library/new?${query}` : '#/library/new'
    }
    case 'range':
      return route.tab === 'overview'
        ? `#/library/${encodeURIComponent(route.id)}`
        : `#/library/${encodeURIComponent(route.id)}/${route.tab}`
    case 'progress':
      return '#/progress'
    case 'account':
      return '#/account'
  }
}

export function navigate(route: AppRoute): void {
  window.location.hash = routeHash(route)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getHash(): string {
  return window.location.hash
}

export function useHashRoute(): AppRoute {
  const hash = useSyncExternalStore(subscribe, getHash)
  return parseAppRoute(hash)
}
