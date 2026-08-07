import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { useAuthSession } from './useAuthSession'

const sessionWithUser = {
  access_token: 'tok',
  user: { id: 'u1', email: 'a@b.c' },
} as unknown as Session

describe('useAuthSession when cloud is unconfigured', () => {
  it('resolves immediately to signed-out, not loading', () => {
    const { result } = renderHook(() =>
      useAuthSession({ cloudConfigured: false }),
    )
    expect(result.current).toEqual({
      session: null,
      user: null,
      loading: false,
      isCloudConfigured: false,
    })
  })
})

describe('useAuthSession when cloud is configured', () => {
  it('seeds the session from getCurrentSession', async () => {
    const { result } = renderHook(() =>
      useAuthSession({
        cloudConfigured: true,
        getCurrentSession: vi.fn().mockResolvedValue(sessionWithUser),
        onAuthChange: () => () => {},
      }),
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBe(sessionWithUser)
    expect(result.current.user?.id).toBe('u1')
  })

  it('updates when an auth-change fires', async () => {
    let emit: ((s: Session | null) => void) | undefined
    const { result } = renderHook(() =>
      useAuthSession({
        cloudConfigured: true,
        getCurrentSession: vi.fn().mockResolvedValue(null),
        onAuthChange: (cb) => {
          emit = cb
          return () => {}
        },
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    act(() => emit?.(sessionWithUser))
    expect(result.current.session).toBe(sessionWithUser)
  })

  it('unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    const { unmount, result } = renderHook(() =>
      useAuthSession({
        cloudConfigured: true,
        getCurrentSession: vi.fn().mockResolvedValue(null),
        onAuthChange: () => unsubscribe,
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
