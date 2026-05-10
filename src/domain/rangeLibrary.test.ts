import { describe, it, expect } from 'vitest'
import {
  distinctStackDepths,
  filterArchivedRanges,
  filterFavoriteRanges,
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesByName,
  filterRangesByPosition,
  filterRangesByStackDepth,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from './rangeLibrary'

/** Minimal stand-ins for saved ranges — only the name matters to the filter. */
const ranges = [
  { name: 'Button open' },
  { name: 'BB defend vs CO' },
  { name: 'SB 3-bet vs BTN' },
]

/** Mixed archive state so each branch has a distinct case. */
const archivable = [
  { name: 'Active A' },
  { name: 'Archived B', archived: true },
  { name: 'Active C', archived: false },
  { name: 'Archived D', archived: true },
]

describe('filterArchivedRanges', () => {
  it('drops archived ranges when showArchived is false, keeping active ones in order', () => {
    expect(filterArchivedRanges(archivable, false)).toEqual([
      { name: 'Active A' },
      { name: 'Active C', archived: false },
    ])
  })

  it('returns every range when showArchived is true', () => {
    expect(filterArchivedRanges(archivable, true)).toEqual(archivable)
  })

  it('treats archived: false the same as an absent flag (active)', () => {
    // Storage never persists archived: false, but the helper still counts it as
    // active by checking archived !== true rather than truthiness.
    expect(filterArchivedRanges([{ name: 'x', archived: false }], false)).toEqual([
      { name: 'x', archived: false },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [{ name: 'a' }, { name: 'b', archived: true }]
    const snapshot = structuredClone(input)
    filterArchivedRanges(input, false)
    filterArchivedRanges(input, true)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterArchivedRanges(archivable, true)).not.toBe(archivable)
    expect(filterArchivedRanges(archivable, false)).not.toBe(archivable)
  })
})

/** Mixed favorite state so each branch has a distinct case. */
const favoritable = [
  { name: 'Plain A' },
  { name: 'Favorite B', favorite: true },
  { name: 'Plain C', favorite: false },
  { name: 'Favorite D', favorite: true },
]

describe('filterFavoriteRanges', () => {
  it('keeps only favorited ranges when favoritesOnly is true, in order', () => {
    expect(filterFavoriteRanges(favoritable, true)).toEqual([
      { name: 'Favorite B', favorite: true },
      { name: 'Favorite D', favorite: true },
    ])
  })

  it('returns every range when favoritesOnly is false', () => {
    expect(filterFavoriteRanges(favoritable, false)).toEqual(favoritable)
  })

  it('treats favorite: false the same as an absent flag (not favorited)', () => {
    // Storage never persists favorite: false, but the helper still counts it as
    // not favorited by checking favorite === true rather than truthiness.
    expect(filterFavoriteRanges([{ name: 'x', favorite: false }], true)).toEqual([])
  })

  it('returns an empty array when nothing is favorited and favoritesOnly is true', () => {
    expect(filterFavoriteRanges([{ name: 'a' }, { name: 'b', favorite: false }], true)).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [{ name: 'a' }, { name: 'b', favorite: true }]
    const snapshot = structuredClone(input)
    filterFavoriteRanges(input, true)
    filterFavoriteRanges(input, false)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterFavoriteRanges(favoritable, true)).not.toBe(favoritable)
    expect(filterFavoriteRanges(favoritable, false)).not.toBe(favoritable)
  })
})

describe('filterRangesByName', () => {
  it('matches names containing the query as a substring', () => {
    expect(filterRangesByName(ranges, 'defend')).toEqual([{ name: 'BB defend vs CO' }])
  })

  it('is case-insensitive in both directions', () => {
    expect(filterRangesByName(ranges, 'BUTTON')).toEqual([{ name: 'Button open' }])
    expect(filterRangesByName(ranges, 'co')).toEqual([{ name: 'BB defend vs CO' }])
  })

  it('returns every range for an empty query', () => {
    expect(filterRangesByName(ranges, '')).toEqual(ranges)
  })

  it('treats a whitespace-only query as empty and returns every range', () => {
    expect(filterRangesByName(ranges, '   ')).toEqual(ranges)
  })

  it('ignores whitespace around the query', () => {
    expect(filterRangesByName(ranges, '  button  ')).toEqual([{ name: 'Button open' }])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterRangesByName(ranges, 'zzz')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByName(ranges, 'b')).toEqual([
      { name: 'Button open' },
      { name: 'BB defend vs CO' },
      { name: 'SB 3-bet vs BTN' },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [{ name: 'Button open' }, { name: 'BB defend vs CO' }]
    const snapshot = [...input]
    filterRangesByName(input, 'open')
    filterRangesByName(input, '')
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByName(ranges, '')).not.toBe(ranges)
  })
})

/** Mixed metadata so each filtering branch has a distinct case. */
const positioned = [
  { name: 'BTN open', metadata: { position: 'btn' } },
  { name: 'CO open', metadata: { position: 'co' } },
  { name: 'Another BTN', metadata: { position: 'btn' } },
  { name: 'Position-less metadata', metadata: {} },
  { name: 'No metadata' },
]

describe('filterRangesByPosition', () => {
  it('returns only the ranges whose metadata.position matches', () => {
    expect(filterRangesByPosition(positioned, 'btn')).toEqual([
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'Another BTN', metadata: { position: 'btn' } },
    ])
  })

  it('excludes ranges without metadata or without a position', () => {
    // 'co' matches a single positioned range; the metadata-less and
    // position-less entries are never included.
    expect(filterRangesByPosition(positioned, 'co')).toEqual([
      { name: 'CO open', metadata: { position: 'co' } },
    ])
  })

  it('returns every range for a null position', () => {
    expect(filterRangesByPosition(positioned, null)).toEqual(positioned)
  })

  it('treats an empty position as "all" and returns every range', () => {
    expect(filterRangesByPosition(positioned, '')).toEqual(positioned)
  })

  it('returns an empty array when no range has the position', () => {
    expect(filterRangesByPosition(positioned, 'sb')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByPosition(positioned, 'btn')).toEqual([
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'Another BTN', metadata: { position: 'btn' } },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'No metadata' },
    ]
    const snapshot = structuredClone(input)
    filterRangesByPosition(input, 'btn')
    filterRangesByPosition(input, null)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByPosition(positioned, null)).not.toBe(positioned)
  })
})

/** Mixed metadata so each action-type branch has a distinct case. */
const actioned = [
  { name: 'BTN open', metadata: { actionType: 'open' } },
  { name: 'SB 3-bet', metadata: { actionType: 'threeBet' } },
  { name: 'Another open', metadata: { actionType: 'open' } },
  { name: 'Action-less metadata', metadata: {} },
  { name: 'No metadata' },
]

describe('filterRangesByActionType', () => {
  it('returns only the ranges whose metadata.actionType matches', () => {
    expect(filterRangesByActionType(actioned, 'open')).toEqual([
      { name: 'BTN open', metadata: { actionType: 'open' } },
      { name: 'Another open', metadata: { actionType: 'open' } },
    ])
  })

  it('excludes ranges without metadata or without an action type', () => {
    // 'threeBet' matches a single actioned range; the metadata-less and
    // action-less entries are never included.
    expect(filterRangesByActionType(actioned, 'threeBet')).toEqual([
      { name: 'SB 3-bet', metadata: { actionType: 'threeBet' } },
    ])
  })

  it('returns every range for a null action type', () => {
    expect(filterRangesByActionType(actioned, null)).toEqual(actioned)
  })

  it('treats an empty action type as "all" and returns every range', () => {
    expect(filterRangesByActionType(actioned, '')).toEqual(actioned)
  })

  it('returns an empty array when no range has the action type', () => {
    expect(filterRangesByActionType(actioned, 'fourBet')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByActionType(actioned, 'open')).toEqual([
      { name: 'BTN open', metadata: { actionType: 'open' } },
      { name: 'Another open', metadata: { actionType: 'open' } },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'BTN open', metadata: { actionType: 'open' } },
      { name: 'No metadata' },
    ]
    const snapshot = structuredClone(input)
    filterRangesByActionType(input, 'open')
    filterRangesByActionType(input, null)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByActionType(actioned, null)).not.toBe(actioned)
  })
})

/** Mixed metadata so each game-type branch has a distinct case. */
const gamed = [
  { name: 'Cash BTN', metadata: { gameType: 'cash' } },
  { name: 'MTT SB', metadata: { gameType: 'tournament' } },
  { name: 'Another cash', metadata: { gameType: 'cash' } },
  { name: 'Game-less metadata', metadata: {} },
  { name: 'No metadata' },
]

describe('filterRangesByGameType', () => {
  it('returns only the ranges whose metadata.gameType matches', () => {
    expect(filterRangesByGameType(gamed, 'cash')).toEqual([
      { name: 'Cash BTN', metadata: { gameType: 'cash' } },
      { name: 'Another cash', metadata: { gameType: 'cash' } },
    ])
  })

  it('excludes ranges without metadata or without a game type', () => {
    // 'tournament' matches a single gamed range; the metadata-less and
    // game-less entries are never included.
    expect(filterRangesByGameType(gamed, 'tournament')).toEqual([
      { name: 'MTT SB', metadata: { gameType: 'tournament' } },
    ])
  })

  it('returns every range for a null game type', () => {
    expect(filterRangesByGameType(gamed, null)).toEqual(gamed)
  })

  it('treats an empty game type as "all" and returns every range', () => {
    expect(filterRangesByGameType(gamed, '')).toEqual(gamed)
  })

  it('returns an empty array when no range has the game type', () => {
    expect(filterRangesByGameType(gamed, 'sitAndGo')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByGameType(gamed, 'cash')).toEqual([
      { name: 'Cash BTN', metadata: { gameType: 'cash' } },
      { name: 'Another cash', metadata: { gameType: 'cash' } },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'Cash BTN', metadata: { gameType: 'cash' } },
      { name: 'No metadata' },
    ]
    const snapshot = structuredClone(input)
    filterRangesByGameType(input, 'cash')
    filterRangesByGameType(input, null)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByGameType(gamed, null)).not.toBe(gamed)
  })
})

/** Mixed metadata so each stack-depth branch has a distinct case. */
const stacked = [
  { name: 'Deep BTN', metadata: { stackDepthBb: 100 } },
  { name: 'Short SB', metadata: { stackDepthBb: 20 } },
  { name: 'Another deep', metadata: { stackDepthBb: 100 } },
  { name: 'Depth-less metadata', metadata: {} },
  { name: 'No metadata' },
]

describe('filterRangesByStackDepth', () => {
  it('returns only the ranges whose metadata.stackDepthBb matches', () => {
    expect(filterRangesByStackDepth(stacked, 100)).toEqual([
      { name: 'Deep BTN', metadata: { stackDepthBb: 100 } },
      { name: 'Another deep', metadata: { stackDepthBb: 100 } },
    ])
  })

  it('excludes ranges without metadata or without a stack depth', () => {
    // 20 matches a single stacked range; the metadata-less and depth-less
    // entries are never included.
    expect(filterRangesByStackDepth(stacked, 20)).toEqual([
      { name: 'Short SB', metadata: { stackDepthBb: 20 } },
    ])
  })

  it('returns every range for a null stack depth', () => {
    expect(filterRangesByStackDepth(stacked, null)).toEqual(stacked)
  })

  it('returns an empty array when no range has the stack depth', () => {
    expect(filterRangesByStackDepth(stacked, 40)).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByStackDepth(stacked, 100)).toEqual([
      { name: 'Deep BTN', metadata: { stackDepthBb: 100 } },
      { name: 'Another deep', metadata: { stackDepthBb: 100 } },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'Deep BTN', metadata: { stackDepthBb: 100 } },
      { name: 'No metadata' },
    ]
    const snapshot = structuredClone(input)
    filterRangesByStackDepth(input, 100)
    filterRangesByStackDepth(input, null)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByStackDepth(stacked, null)).not.toBe(stacked)
  })
})

describe('distinctStackDepths', () => {
  it('returns the unique depths present, sorted ascending', () => {
    expect(distinctStackDepths(stacked)).toEqual([20, 100])
  })

  it('collapses duplicate depths to a single entry', () => {
    const input = [
      { name: 'a', metadata: { stackDepthBb: 100 } },
      { name: 'b', metadata: { stackDepthBb: 100 } },
      { name: 'c', metadata: { stackDepthBb: 100 } },
    ]
    expect(distinctStackDepths(input)).toEqual([100])
  })

  it('sorts numerically rather than lexicographically', () => {
    const input = [
      { name: 'a', metadata: { stackDepthBb: 100 } },
      { name: 'b', metadata: { stackDepthBb: 20 } },
      { name: 'c', metadata: { stackDepthBb: 40 } },
    ]
    expect(distinctStackDepths(input)).toEqual([20, 40, 100])
  })

  it('ignores ranges with no metadata or no stack depth', () => {
    expect(
      distinctStackDepths([
        { name: 'a', metadata: { stackDepthBb: 50 } },
        { name: 'b', metadata: {} },
        { name: 'c' },
      ]),
    ).toEqual([50])
  })

  it('returns an empty array when no range has a stack depth', () => {
    expect(distinctStackDepths([{ name: 'a', metadata: {} }, { name: 'b' }])).toEqual([])
  })
})

describe('sortRangesByName', () => {
  it('sorts by name ascending', () => {
    expect(
      sortRangesByName([{ name: 'Cutoff' }, { name: 'Button' }, { name: 'Hijack' }]),
    ).toEqual([{ name: 'Button' }, { name: 'Cutoff' }, { name: 'Hijack' }])
  })

  it('is case-insensitive: "apple" sorts before "Banana"', () => {
    expect(sortRangesByName([{ name: 'Banana' }, { name: 'apple' }])).toEqual([
      { name: 'apple' },
      { name: 'Banana' },
    ])
  })

  it('preserves input order for names that compare equal (stable)', () => {
    // All three names compare equal under case-insensitive ordering, so the
    // distinguishing ids must stay in their input order.
    const input = [
      { name: 'open', id: 1 },
      { name: 'Open', id: 2 },
      { name: 'OPEN', id: 3 },
    ]
    expect(sortRangesByName(input)).toEqual([
      { name: 'open', id: 1 },
      { name: 'Open', id: 2 },
      { name: 'OPEN', id: 3 },
    ])
  })

  it('returns an empty array for an empty input', () => {
    expect(sortRangesByName([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [{ name: 'Cutoff' }, { name: 'Button' }]
    const snapshot = structuredClone(input)
    sortRangesByName(input)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    const input = [{ name: 'Button' }]
    expect(sortRangesByName(input)).not.toBe(input)
  })
})

describe('sortRangesByUpdatedAt', () => {
  it('sorts by updatedAt descending — most recently edited first', () => {
    expect(
      sortRangesByUpdatedAt([
        { name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' },
        { name: 'Newest', updatedAt: '2026-03-01T00:00:00.000Z' },
        { name: 'Middle', updatedAt: '2026-02-01T00:00:00.000Z' },
      ]),
    ).toEqual([
      { name: 'Newest', updatedAt: '2026-03-01T00:00:00.000Z' },
      { name: 'Middle', updatedAt: '2026-02-01T00:00:00.000Z' },
      { name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('preserves input order for equal timestamps (stable)', () => {
    // All three share a timestamp, so the distinguishing ids must stay in their
    // input order.
    const input = [
      { name: 'a', id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'b', id: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'c', id: 3, updatedAt: '2026-01-01T00:00:00.000Z' },
    ]
    expect(sortRangesByUpdatedAt(input)).toEqual([
      { name: 'a', id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'b', id: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'c', id: 3, updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('returns an empty array for an empty input', () => {
    expect(sortRangesByUpdatedAt([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'Newest', updatedAt: '2026-03-01T00:00:00.000Z' },
    ]
    const snapshot = structuredClone(input)
    sortRangesByUpdatedAt(input)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    const input = [{ name: 'Button', updatedAt: '2026-01-01T00:00:00.000Z' }]
    expect(sortRangesByUpdatedAt(input)).not.toBe(input)
  })
})
