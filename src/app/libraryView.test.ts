import { describe, it, expect, beforeEach } from 'vitest'
import {
  EMPTY_LIBRARY_VIEW,
  forgetLibraryView,
  readLibraryView,
  rememberLibraryView,
} from './libraryView'

beforeEach(() => {
  forgetLibraryView()
})

describe('the remembered library view', () => {
  it('starts on the defaults: everything shown, nothing filtered', () => {
    expect(readLibraryView()).toEqual(EMPTY_LIBRARY_VIEW)
  })

  it('hands back the view it was last left in', () => {
    const view = { ...EMPTY_LIBRARY_VIEW, query: '3-bet', position: 'btn' as const, sort: 'name' as const }

    rememberLibraryView(view)

    expect(readLibraryView()).toEqual(view)
  })

  it('reads the same view every time, since a read never consumes it', () => {
    // Unlike the pending undo, the view outlives the visit that set it — every
    // return to the Library restores it, not just the first.
    rememberLibraryView({ ...EMPTY_LIBRARY_VIEW, query: 'btn' })

    expect(readLibraryView().query).toBe('btn')
    expect(readLibraryView().query).toBe('btn')
  })

  it('keeps only the most recent view', () => {
    rememberLibraryView({ ...EMPTY_LIBRARY_VIEW, query: 'first' })
    rememberLibraryView({ ...EMPTY_LIBRARY_VIEW, query: 'second' })

    expect(readLibraryView().query).toBe('second')
  })

  it('goes back to the defaults once forgotten', () => {
    rememberLibraryView({ ...EMPTY_LIBRARY_VIEW, query: 'btn', favoritesOnly: true })

    forgetLibraryView()

    expect(readLibraryView()).toEqual(EMPTY_LIBRARY_VIEW)
  })
})
