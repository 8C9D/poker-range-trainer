import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedRange } from '../types/range'
import { CloudNotConfiguredError } from './auth'
import { NotSignedInError } from './rangesRepo'
import {
  getSharedRange,
  publishSharedRange,
  unpublishAllSharedRanges,
  unpublishSharedRange,
} from './sharedRangesRepo'

function makeRange(): SavedRange {
  return {
    id: 'r1',
    name: 'BTN open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }
}

const signedIn = { resolveUserId: async () => 'user-1' }
const ids = { generateId: () => 'shareid' }

describe('publishSharedRange', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(publishSharedRange(makeRange(), true, { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws when signed out', async () => {
    await expect(
      publishSharedRange(makeRange(), true, {
        client: {} as SupabaseClient,
        resolveUserId: async () => null,
      }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('inserts a public row with no token', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    const range = makeRange()
    const result = await publishSharedRange(range, true, { client, ...signedIn, ...ids })
    expect(insert).toHaveBeenCalledWith({
      id: 'shareid',
      owner_id: 'user-1',
      data: range,
      is_public: true,
      token: null,
    })
    expect(result).toEqual({ id: 'shareid', isPublic: true, token: null })
  })

  it('inserts a private row with a token', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    const result = await publishSharedRange(makeRange(), false, { client, ...signedIn, ...ids })
    expect(result).toEqual({ id: 'shareid', isPublic: false, token: 'shareid' })
  })

  it('throws the Supabase error when the insert fails', async () => {
    const error = new Error('conflict')
    const insert = vi.fn().mockResolvedValue({ error })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    await expect(
      publishSharedRange(makeRange(), true, { client, ...signedIn, ...ids }),
    ).rejects.toBe(error)
  })
})

describe('getSharedRange', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(getSharedRange('x', undefined, { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('returns the payload from the RPC', async () => {
    const range = makeRange()
    const rpc = vi.fn().mockResolvedValue({ data: range, error: null })
    const client = { rpc } as unknown as SupabaseClient
    await expect(getSharedRange('shareid', 'tok', { client })).resolves.toEqual(range)
    expect(rpc).toHaveBeenCalledWith('get_shared_range', { p_id: 'shareid', p_token: 'tok' })
  })

  it('returns null when nothing matches', async () => {
    const client = { rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient
    await expect(getSharedRange('nope', undefined, { client })).resolves.toBeNull()
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('db down')
    const client = { rpc: async () => ({ data: null, error }) } as unknown as SupabaseClient
    await expect(getSharedRange('x', undefined, { client })).rejects.toBe(error)
  })
})

describe('unpublishSharedRange', () => {
  it('deletes the row scoped to id and owner', async () => {
    const eqOwner = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqOwner }))
    const deleteFn = vi.fn(() => ({ eq: eqId }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(unpublishSharedRange('shareid', { client, ...signedIn })).resolves.toBeUndefined()
    expect(eqId).toHaveBeenCalledWith('id', 'shareid')
    expect(eqOwner).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  it('throws when signed out', async () => {
    await expect(
      unpublishSharedRange('x', { client: {} as SupabaseClient, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('throws when cloud is unconfigured', async () => {
    await expect(unpublishSharedRange('x', { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws the Supabase error when the delete fails', async () => {
    const error = new Error('db down')
    const eqOwner = vi.fn().mockResolvedValue({ error })
    const eqId = vi.fn(() => ({ eq: eqOwner }))
    const deleteFn = vi.fn(() => ({ eq: eqId }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(unpublishSharedRange('shareid', { client, ...signedIn })).rejects.toBe(error)
  })
})

describe('unpublishAllSharedRanges', () => {
  it('deletes every row scoped to the owner', async () => {
    const eqOwner = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn(() => ({ eq: eqOwner }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(unpublishAllSharedRanges({ client, ...signedIn })).resolves.toBeUndefined()
    expect(eqOwner).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  it('throws when signed out', async () => {
    await expect(
      unpublishAllSharedRanges({ client: {} as SupabaseClient, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('throws when cloud is unconfigured', async () => {
    await expect(unpublishAllSharedRanges({ client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws the Supabase error when the delete fails', async () => {
    const error = new Error('rls denied')
    const eqOwner = vi.fn().mockResolvedValue({ error })
    const deleteFn = vi.fn(() => ({ eq: eqOwner }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(unpublishAllSharedRanges({ client, ...signedIn })).rejects.toBe(error)
  })
})
