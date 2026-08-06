import type { ActionType, GameType, Position } from '../types/range'

/**
 * The Library's view — what is searched, filtered, and sorted for — kept across a
 * visit to a range and back.
 *
 * Every screen is routed, so opening a range unmounts the Library and returning
 * mounts a fresh one. That reset the search box and every filter, which made the
 * ordinary way of working through a group of charts — filter to the 3-bet ones,
 * open one, come back for the next — re-type the filter on every single return.
 * The iOS app never had the problem: its Library is a tab that stays mounted, so
 * remembering the view here is what makes the two agree.
 *
 * Deliberately in memory only, and deliberately not the selection: a reload is a
 * clear "start fresh", and restoring a stale set of ticked ranges would put a
 * bulk delete one click away from ranges the user no longer has in mind.
 */
export type LibrarySortOrder = '' | 'name' | 'recent' | 'practiced' | 'accuracy'

export interface LibraryView {
  query: string
  filtersOpen: boolean
  position: Position | ''
  actionType: ActionType | ''
  stackDepth: number | ''
  gameType: GameType | ''
  sort: LibrarySortOrder
  showArchived: boolean
  favoritesOnly: boolean
}

export const EMPTY_LIBRARY_VIEW: LibraryView = {
  query: '',
  filtersOpen: false,
  position: '',
  actionType: '',
  stackDepth: '',
  gameType: '',
  sort: '',
  showArchived: false,
  favoritesOnly: false,
}

let lastView: LibraryView = EMPTY_LIBRARY_VIEW

/** The view the Library was last left in. A pure read, safe during a render. */
export function readLibraryView(): LibraryView {
  return lastView
}

/** Remember the view the Library is in now. */
export function rememberLibraryView(view: LibraryView): void {
  lastView = view
}

/** Forget the remembered view, so the next Library opens on its defaults. */
export function forgetLibraryView(): void {
  lastView = EMPTY_LIBRARY_VIEW
}
