import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Backup } from '../storage/backup'
import { CloudNotConfiguredError } from './auth'
import { NotSignedInError } from './rangesRepo'
import { deleteBackup, pullBackup, pushBackup } from './backupRepo'

function makeBackup(): Backup {
  return {
    version: 1,
    exportedAt: '2026-06-08T00:00:00.000Z',
    ranges: [],
    practiceStats: {},
    handAccuracy: {},
    actionAccuracy: {},
    sessionHistory: {},
    reviewStates: {},
  }
}

const signedIn = { resolveUserId: async () => 'user-1' }

describe('pushBackup', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(pushBackup(makeBackup(), { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws when signed out', async () => {
    await expect(
      pushBackup(makeBackup(), { client: {} as SupabaseClient, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('upserts the single backup row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient
    const backup = makeBackup()
    await pushBackup(backup, { client, ...signedIn })
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      data: backup,
      updated_at: '2026-06-08T00:00:00.000Z',
    })
  })

  it('throws the Supabase error when the upsert fails', async () => {
    const error = new Error('db down')
    const upsert = vi.fn().mockResolvedValue({ error })
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient
    await expect(pushBackup(makeBackup(), { client, ...signedIn })).rejects.toBe(error)
  })
})

describe('pullBackup', () => {
  it('returns the data column when a row exists', async () => {
    const backup = makeBackup()
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: backup }, error: null })
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as unknown as SupabaseClient
    await expect(pullBackup({ client, ...signedIn })).resolves.toEqual(backup)
  })

  it('returns null when no row exists', async () => {
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as unknown as SupabaseClient
    await expect(pullBackup({ client, ...signedIn })).resolves.toBeNull()
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('db down')
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error }) }) }),
      }),
    } as unknown as SupabaseClient
    await expect(pullBackup({ client, ...signedIn })).rejects.toBe(error)
  })

  // A pull REPLACES the whole local library, so a row this app cannot read has
  // to fail here rather than be written over a working one.
  function clientReturning(row: unknown): SupabaseClient {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { data: row }, error: null }) }),
        }),
      }),
    } as unknown as SupabaseClient
  }

  it('rejects a row written by a newer app version', async () => {
    const client = clientReturning({ ...makeBackup(), version: 2 })
    await expect(pullBackup({ client, ...signedIn })).rejects.toThrow(
      /Unsupported backup version: 2/,
    )
  })

  it('rejects a row missing a data slice', async () => {
    const partial: Partial<Backup> = makeBackup()
    delete partial.sessionHistory
    const client = clientReturning(partial)
    await expect(pullBackup({ client, ...signedIn })).rejects.toThrow(/sessionHistory/)
  })

  it('rejects a row whose data column is not an object', async () => {
    await expect(pullBackup({ client: clientReturning(null), ...signedIn })).rejects.toThrow(
      /not a backup object/,
    )
  })
})

describe('deleteBackup', () => {
  it("deletes the user's backup row", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn(() => ({ eq }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(deleteBackup({ client, ...signedIn })).resolves.toBeUndefined()
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws when signed out', async () => {
    await expect(
      deleteBackup({ client: {} as SupabaseClient, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })
})
