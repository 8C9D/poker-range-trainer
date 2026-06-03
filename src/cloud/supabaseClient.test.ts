import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, resetSupabaseClient } from './supabaseClient'

beforeEach(() => {
  resetSupabaseClient()
})

describe('getSupabaseClient', () => {
  it('returns null when cloud is not configured', async () => {
    await expect(getSupabaseClient({ config: null })).resolves.toBeNull()
  })

  it('creates a client from the injected config', async () => {
    const fakeClient = {} as SupabaseClient
    const create = vi.fn(() => fakeClient)
    const client = await getSupabaseClient({
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      create: create as never,
    })
    expect(client).toBe(fakeClient)
    expect(create).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key')
  })

  it('memoizes the client across calls (creates once)', async () => {
    const fakeClient = {} as SupabaseClient
    const create = vi.fn(() => fakeClient)
    const deps = {
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      create: create as never,
    }
    await getSupabaseClient(deps)
    await getSupabaseClient(deps)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
