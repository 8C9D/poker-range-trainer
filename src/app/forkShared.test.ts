import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { forkSharedPack, forkSharedRange } from './forkShared'
import { buildRangePack } from '../domain/rangeTransfer'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRange(id: string, name: string): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }
}

describe('forkSharedRange', () => {
  it('saves under a fresh id so a shared range never clobbers one you have', () => {
    saveSavedRange(makeRange('r1', 'My own chart'))

    const id = forkSharedRange(makeRange('r1', 'Their chart'), '2026-03-01T00:00:00.000Z')

    expect(id).not.toBe('r1')
    const saved = loadSavedRanges()
    expect(saved.map((range) => range.name)).toEqual(['My own chart', 'Their chart'])
    expect(saved[1].createdAt).toBe('2026-03-01T00:00:00.000Z')
    expect(saved[1].updatedAt).toBe('2026-03-01T00:00:00.000Z')
  })

  it('throws when the store refuses the write, so the page can report it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => forkSharedRange(makeRange('r1', 'Their chart'))).toThrow(/storage is full/)
  })
})

describe('forkSharedPack', () => {
  it('saves every range under a fresh id, in pack order', () => {
    saveSavedRange(makeRange('mine', 'My own chart'))
    const pack = buildRangePack('Openers', [makeRange('a', 'UTG'), makeRange('b', 'BTN')])

    forkSharedPack(pack, '2026-03-01T00:00:00.000Z')

    const saved = loadSavedRanges()
    expect(saved.map((range) => range.name)).toEqual(['My own chart', 'UTG', 'BTN'])
    expect(new Set(saved.map((range) => range.id)).size).toBe(3)
    expect(saved.map((range) => range.id)).not.toContain('a')
  })

  it('leaves no half-forked pack behind when the store fills up part-way', () => {
    saveSavedRange(makeRange('mine', 'My own chart'))
    const pack = buildRangePack('Openers', [makeRange('a', 'UTG'), makeRange('b', 'BTN')])
    // Room for exactly one more write. Saving range by range put UTG in the
    // library and then lost BTN; the whole pack is one write, so it lands.
    const real = Storage.prototype.setItem
    let writes = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (++writes > 1) throw new DOMException('quota', 'QuotaExceededError')
      real.call(this, key, value)
    })

    forkSharedPack(pack)

    expect(loadSavedRanges().map((range) => range.name)).toEqual([
      'My own chart',
      'UTG',
      'BTN',
    ])
  })
})
