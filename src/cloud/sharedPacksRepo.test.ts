import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedRange } from '../types/range'
import { buildRangePack, type RangePack } from '../domain/rangeTransfer'
import { CloudNotConfiguredError } from './auth'
import { NotSignedInError } from './rangesRepo'
import { getSharedPack, publishSharedPack, unpublishSharedPack } from './sharedPacksRepo'

function makeRange(): SavedRange {
  return {
    id: 'r1',
    name: 'BTN open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }
}

function makePack(): RangePack {
  return buildRangePack('My Pack', [makeRange()])
}

const signedIn = { resolveUserId: async () => 'user-1' }
const ids = { generateId: () => 'packid' }

describe('publishSharedPack', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(publishSharedPack(makePack(), true, { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('throws when signed out', async () => {
    await expect(
      publishSharedPack(makePack(), true, {
        client: {} as SupabaseClient,
        resolveUserId: async () => null,
      }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })

  it('inserts a public row with no token', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    const pack = makePack()
    const result = await publishSharedPack(pack, true, { client, ...signedIn, ...ids })
    expect(insert).toHaveBeenCalledWith({
      id: 'packid',
      owner_id: 'user-1',
      data: pack,
      is_public: true,
      token: null,
    })
    expect(result).toEqual({ id: 'packid', isPublic: true, token: null })
  })

  it('inserts a private row with a token', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    const result = await publishSharedPack(makePack(), false, { client, ...signedIn, ...ids })
    expect(result).toEqual({ id: 'packid', isPublic: false, token: 'packid' })
  })
})

describe('getSharedPack', () => {
  it('throws when cloud is unconfigured', async () => {
    await expect(getSharedPack('x', undefined, { client: null })).rejects.toBeInstanceOf(
      CloudNotConfiguredError,
    )
  })

  it('returns the payload from the RPC', async () => {
    const pack = makePack()
    const rpc = vi.fn().mockResolvedValue({ data: pack, error: null })
    const client = { rpc } as unknown as SupabaseClient
    await expect(getSharedPack('packid', 'tok', { client })).resolves.toEqual(pack)
    expect(rpc).toHaveBeenCalledWith('get_shared_pack', { p_id: 'packid', p_token: 'tok' })
  })

  it('returns null when nothing matches', async () => {
    const client = { rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient
    await expect(getSharedPack('nope', undefined, { client })).resolves.toBeNull()
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('db down')
    const client = { rpc: async () => ({ data: null, error }) } as unknown as SupabaseClient
    await expect(getSharedPack('x', undefined, { client })).rejects.toBe(error)
  })
})

describe('unpublishSharedPack', () => {
  it('deletes the row scoped to id and owner', async () => {
    const eqOwner = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqOwner }))
    const deleteFn = vi.fn(() => ({ eq: eqId }))
    const client = { from: vi.fn(() => ({ delete: deleteFn })) } as unknown as SupabaseClient
    await expect(unpublishSharedPack('packid', { client, ...signedIn })).resolves.toBeUndefined()
    expect(eqId).toHaveBeenCalledWith('id', 'packid')
    expect(eqOwner).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  it('throws when signed out', async () => {
    await expect(
      unpublishSharedPack('x', { client: {} as SupabaseClient, resolveUserId: async () => null }),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })
})
