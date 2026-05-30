import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, resetSupabaseClient } from './supabaseClient'

beforeEach(() => {
  resetSupabaseClient()
})

describe('getSupabaseClient', () => {
  it('returns null when cloud is not configured', () => {
    expect(getSupabaseClient({ config: null })).toBeNull()
  })

  it('creates a client from the injected config', () => {
    const fakeClient = {} as SupabaseClient
    const create = vi.fn(() => fakeClient)
    const client = getSupabaseClient({
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      create: create as never,
    })
    expect(client).toBe(fakeClient)
    expect(create).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key')
  })

  it('memoizes the client across calls (creates once)', () => {
    const fakeClient = {} as SupabaseClient
    const create = vi.fn(() => fakeClient)
    const deps = {
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      create: create as never,
    }
    getSupabaseClient(deps)
    getSupabaseClient(deps)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
