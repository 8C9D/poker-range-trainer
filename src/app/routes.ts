import { useSyncExternalStore } from 'react'

export const RANGE_TABS = ['overview', 'edit', 'actions', 'combos', 'frequencies', 'stats'] as const
export type RangeTab = (typeof RANGE_TABS)[number]

export type AppRoute =
  | { screen: 'today' }
  | { screen: 'library' }
  | { screen: 'range'; id: string; tab: RangeTab }
  | { screen: 'progress' }
  | { screen: 'account' }
  | { screen: 'legacy' }

/**
 * Parse the location hash into an app route. Share routes (#/r/:id, #/p/:id)
 * and #range= imports are handled before this in App and never reach here;
 * anything unrecognized falls back to the default screen.
 */
export function parseAppRoute(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  const parts = path.split('/').filter(Boolean)
  switch (parts[0]) {
    case 'today':
      return { screen: 'today' }
    case 'library': {
      if (!parts[1]) return { screen: 'library' }
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
    case 'legacy':
      // Migration escape hatch: the old single-page layout until slice 8 removes it.
      return { screen: 'legacy' }
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
    case 'range':
      return route.tab === 'overview'
        ? `#/library/${encodeURIComponent(route.id)}`
        : `#/library/${encodeURIComponent(route.id)}/${route.tab}`
    case 'progress':
      return '#/progress'
    case 'account':
      return '#/account'
    case 'legacy':
      return '#/legacy'
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
