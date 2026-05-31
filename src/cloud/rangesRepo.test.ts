import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedRange } from '../types/range'
import { CloudNotConfiguredError } from './auth'
import { NotSignedInError, pullRanges, pushRanges } from './rangesRepo'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

const signedIn = { resolveUserId: async () => 'user-1' }

describe('pushRanges', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(pushRanges([], { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws when signed out', async () => {
    const client = {} as SupabaseClient
    await expect(
      pushRanges([], { client, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('upserts rows mapped from the ranges', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient
    const range = makeRange()
    await pushRanges([range], { client, ...signedIn })
    expect(upsert).toHaveBeenCalledWith([
      { id: 'r1', user_id: 'user-1', data: range, updated_at: '2026-01-02T00:00:00.000Z' },
    ])
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('db down')
    const client = {
      from: () => ({ upsert: vi.fn().mockResolvedValue({ error }) }),
    } as unknown as SupabaseClient
    await expect(pushRanges([makeRange()], { client, ...signedIn })).rejects.toBe(error)
  })
})

describe('pullRanges', () => {
  it('returns the data column of each row', async () => {
    const range = makeRange()
    const eq = vi.fn().mockResolvedValue({ data: [{ data: range }], error: null })
    const client = {
      from: () => ({ select: () => ({ eq }) }),
    } as unknown as SupabaseClient
    await expect(pullRanges({ client, ...signedIn })).resolves.toEqual([range])
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns an empty array when there are no rows', async () => {
    const client = {
      from: () => ({ select: () => ({ eq: async () => ({ data: null, error: null }) }) }),
    } as unknown as SupabaseClient
    await expect(pullRanges({ client, ...signedIn })).resolves.toEqual([])
  })

  it('throws when signed out', async () => {
    const client = {} as SupabaseClient
    await expect(
      pullRanges({ client, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })
})
