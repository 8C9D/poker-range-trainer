import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearDrillPoolCache, readDrillPools, storeDrillPools } from './drill-handoff'

const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'

function storedKeys(): string[] {
  return Object.keys(window.sessionStorage).filter((key) => key.startsWith('prt.drill-pools.'))
}

describe('drill pool handoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    clearDrillPoolCache()
  })

  it('hands pools over under a generated key and clears storage on the first read', () => {
    const key = storeDrillPools({ [rangeId]: ['AA', 'KQs'] })
    expect(storedKeys()).toHaveLength(1)

    expect(readDrillPools(key)).toEqual({ [rangeId]: ['AA', 'KQs'] })
    expect(storedKeys()).toHaveLength(0)

    // Still answers the same within this page — a second render must not widen
    // the drill back to every hand — but a fresh page load finds nothing.
    expect(readDrillPools(key)).toEqual({ [rangeId]: ['AA', 'KQs'] })
    clearDrillPoolCache()
    expect(readDrillPools(key)).toEqual({})
  })

  it('drops hands that are not real and ranges left with none', () => {
    const key = storeDrillPools({
      [rangeId]: ['AA', 'ZZ', 'kqs', 'KQs', 'AA'],
      'empty-range': ['nonsense'],
      'not-a-list': 'AA' as unknown as string[],
    })
    expect(readDrillPools(key)).toEqual({ [rangeId]: ['AA', 'KQs'] })
  })

  it('treats an unknown key, a non-object payload, and unusable storage as no pools', () => {
    expect(readDrillPools('never-stored')).toEqual({})

    window.sessionStorage.setItem('prt.drill-pools.broken', '{not json')
    expect(readDrillPools('broken')).toEqual({})
    window.sessionStorage.setItem('prt.drill-pools.listy', '["AA"]')
    expect(readDrillPools('listy')).toEqual({})

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const key = storeDrillPools({ [rangeId]: ['AA'] })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(readDrillPools(key)).toEqual({})
  })
})
