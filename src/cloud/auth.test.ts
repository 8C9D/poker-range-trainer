import { describe, it, expect, vi } from 'vitest'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  CloudNotConfiguredError,
  getCurrentSession,
  onAuthChange,
  signIn,
  signOut,
  signUp,
} from './auth'

const fakeSession = { access_token: 'tok' } as unknown as Session

function clientWithAuth(auth: Partial<SupabaseClient['auth']>): SupabaseClient {
  return { auth } as unknown as SupabaseClient
}

describe('auth wrapper when cloud is unconfigured', () => {
  it('signUp throws CloudNotConfiguredError', async () => {
    await expect(signUp('a@b.c', 'pw', null)).rejects.toBeInstanceOf(CloudNotConfiguredError)
  })

  it('signIn throws CloudNotConfiguredError', async () => {
    await expect(signIn('a@b.c', 'pw', null)).rejects.toBeInstanceOf(CloudNotConfiguredError)
  })

  it('getCurrentSession returns null', async () => {
    await expect(getCurrentSession(null)).resolves.toBeNull()
  })

  it('onAuthChange is a no-op returning an unsubscribe fn', async () => {
    const unsub = await onAuthChange(() => {}, null)
    expect(() => unsub()).not.toThrow()
  })
})

describe('signIn', () => {
  it('returns the session on success', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    })
    const client = clientWithAuth({ signInWithPassword } as never)
    await expect(signIn('a@b.c', 'pw', client)).resolves.toBe(fakeSession)
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' })
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('bad creds')
    const client = clientWithAuth({
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error }),
    } as never)
    await expect(signIn('a@b.c', 'pw', client)).rejects.toBe(error)
  })
})

describe('signUp', () => {
  it('returns the session (or null) on success', async () => {
    const client = clientWithAuth({
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    } as never)
    await expect(signUp('a@b.c', 'pw', client)).resolves.toBeNull()
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('email already registered')
    const client = clientWithAuth({
      signUp: vi.fn().mockResolvedValue({ data: {}, error }),
    } as never)
    await expect(signUp('a@b.c', 'pw', client)).rejects.toBe(error)
  })
})

describe('signOut', () => {
  it('resolves on success', async () => {
    const signOutFn = vi.fn().mockResolvedValue({ error: null })
    await expect(signOut(clientWithAuth({ signOut: signOutFn } as never))).resolves.toBeUndefined()
    expect(signOutFn).toHaveBeenCalled()
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('sign-out failed')
    const client = clientWithAuth({ signOut: vi.fn().mockResolvedValue({ error }) } as never)
    await expect(signOut(client)).rejects.toBe(error)
  })
})

describe('getCurrentSession', () => {
  it('returns the active session on success', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: fakeSession }, error: null })
    await expect(getCurrentSession(clientWithAuth({ getSession } as never))).resolves.toBe(fakeSession)
  })

  it('throws the Supabase error on failure', async () => {
    const error = new Error('session read failed')
    const client = clientWithAuth({ getSession: vi.fn().mockResolvedValue({ data: {}, error }) } as never)
    await expect(getCurrentSession(client)).rejects.toBe(error)
  })
})

describe('onAuthChange', () => {
  it('forwards sessions and unsubscribes', async () => {
    const unsubscribe = vi.fn()
    let handler: ((event: string, session: Session | null) => void) | undefined
    const onAuthStateChange = vi.fn((cb) => {
      handler = cb
      return { data: { subscription: { unsubscribe } } }
    })
    const seen: (Session | null)[] = []
    const unsub = await onAuthChange(
      (s) => seen.push(s),
      clientWithAuth({ onAuthStateChange } as never),
    )
    handler?.('SIGNED_IN', fakeSession)
    expect(seen).toEqual([fakeSession])
    unsub()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
