import { describe, it, expect } from 'vitest'
import { getCloudConfig, isCloudConfigured } from './cloudConfig'

describe('getCloudConfig', () => {
  it('returns the config when both env vars are set', () => {
    const env = {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    }
    expect(getCloudConfig(env)).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    })
  })

  it('trims surrounding whitespace', () => {
    const env = {
      VITE_SUPABASE_URL: '  https://example.supabase.co  ',
      VITE_SUPABASE_ANON_KEY: '  anon-key  ',
    }
    expect(getCloudConfig(env)).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    })
  })

  it('returns null when the URL is missing', () => {
    expect(getCloudConfig({ VITE_SUPABASE_ANON_KEY: 'anon-key' })).toBeNull()
  })

  it('returns null when the anon key is missing', () => {
    expect(getCloudConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull()
  })

  it('returns null when a var is blank', () => {
    expect(
      getCloudConfig({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_ANON_KEY: 'anon-key' }),
    ).toBeNull()
  })

  it('returns null for an empty env', () => {
    expect(getCloudConfig({})).toBeNull()
  })
})

describe('isCloudConfigured', () => {
  it('is true only when both vars are set', () => {
    expect(
      isCloudConfigured({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toBe(true)
    expect(isCloudConfigured({})).toBe(false)
  })
})
