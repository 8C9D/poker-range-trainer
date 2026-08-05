import { describe, it, expect } from 'vitest'
import { parseAppRoute, routeHash } from './routes'

describe('parseAppRoute', () => {
  it('parses the four destinations', () => {
    expect(parseAppRoute('#/today')).toEqual({ screen: 'today' })
    expect(parseAppRoute('#/library')).toEqual({ screen: 'library' })
    expect(parseAppRoute('#/progress')).toEqual({ screen: 'progress' })
    expect(parseAppRoute('#/account')).toEqual({ screen: 'account' })
  })

  it('parses the new-range route', () => {
    expect(parseAppRoute('#/library/new')).toEqual({ screen: 'newRange' })
  })

  it('parses scenario metadata pre-filled on the new-range route', () => {
    expect(parseAppRoute('#/library/new?position=bb&action=defend&vs=co&table=sixMax&stack=40')).toEqual(
      {
        screen: 'newRange',
        prefill: {
          position: 'bb',
          actionType: 'defend',
          versusPosition: 'co',
          tableSize: 'sixMax',
          stackDepthBb: 40,
        },
      },
    )
  })

  it('drops pre-fill values outside their vocabulary', () => {
    expect(parseAppRoute('#/library/new?position=lojack&action=snap&table=tenMax&stack=-5')).toEqual(
      { screen: 'newRange' },
    )
    expect(parseAppRoute('#/library/new?position=sb&action=nope')).toEqual({
      screen: 'newRange',
      prefill: { position: 'sb' },
    })
  })

  it('parses a range page with a default overview tab', () => {
    expect(parseAppRoute('#/library/abc-123')).toEqual({
      screen: 'range',
      id: 'abc-123',
      tab: 'overview',
    })
  })

  it('parses every range tab', () => {
    for (const tab of ['overview', 'edit', 'actions', 'combos', 'frequencies', 'stats'] as const) {
      expect(parseAppRoute(`#/library/abc/${tab}`)).toEqual({ screen: 'range', id: 'abc', tab })
    }
  })

  it('falls back to overview for an unknown tab', () => {
    expect(parseAppRoute('#/library/abc/bogus')).toEqual({
      screen: 'range',
      id: 'abc',
      tab: 'overview',
    })
  })

  it('decodes percent-encoded range ids', () => {
    expect(parseAppRoute('#/library/a%20b')).toEqual({ screen: 'range', id: 'a b', tab: 'overview' })
  })

  // The parse runs during render, so a throw here took the whole app down behind
  // the root error boundary, with no way back: "Try again" re-read the same hash.
  it('keeps a malformed percent-escape raw instead of throwing', () => {
    expect(parseAppRoute('#/library/%')).toEqual({ screen: 'range', id: '%', tab: 'overview' })
    expect(parseAppRoute('#/library/a%b/edit')).toEqual({
      screen: 'range',
      id: 'a%b',
      tab: 'edit',
    })
    expect(parseAppRoute('#/library/%E0%A4%A')).toEqual({
      screen: 'range',
      id: '%E0%A4%A',
      tab: 'overview',
    })
  })

  it('falls back to Today for empty and unknown hashes', () => {
    expect(parseAppRoute('')).toEqual({ screen: 'today' })
    expect(parseAppRoute('#/')).toEqual({ screen: 'today' })
    expect(parseAppRoute('#/nope')).toEqual({ screen: 'today' })
  })
})

describe('routeHash', () => {
  it('round-trips every route through parseAppRoute', () => {
    const routes = [
      { screen: 'today' },
      { screen: 'library' },
      { screen: 'newRange' },
      { screen: 'range', id: 'abc', tab: 'overview' },
      { screen: 'range', id: 'a b', tab: 'stats' },
      { screen: 'progress' },
      { screen: 'account' },
    ] as const
    for (const route of routes) {
      expect(parseAppRoute(routeHash(route))).toEqual(route)
    }
  })

  it('round-trips a pre-filled new-range route', () => {
    const route = {
      screen: 'newRange',
      prefill: { position: 'btn', actionType: 'open', tableSize: 'headsUp', stackDepthBb: 20 },
    } as const

    expect(parseAppRoute(routeHash(route))).toEqual(route)
  })
})
