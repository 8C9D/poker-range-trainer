import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getCurrentSession, onAuthChange } from './auth'
import { isCloudConfigured } from './cloudConfig'

export interface AuthSessionState {
  session: Session | null
  user: User | null
  loading: boolean
  isCloudConfigured: boolean
}

interface UseAuthSessionDeps {
  getCurrentSession?: typeof getCurrentSession
  onAuthChange?: typeof onAuthChange
  cloudConfigured?: boolean
}

/**
 * Expose the current Supabase auth session to React, built on `auth.ts`.
 *
 * On mount it seeds state from `getCurrentSession()` and subscribes via
 * `onAuthChange` (unsubscribing on unmount). When cloud is unconfigured it
 * resolves immediately to a signed-out, not-loading state so local-only users
 * see no change. `deps` is injectable so tests run without any network.
 */
export function useAuthSession(deps: UseAuthSessionDeps = {}): AuthSessionState {
  const cloudConfigured = deps.cloudConfigured ?? isCloudConfigured()
  const getSession = deps.getCurrentSession ?? getCurrentSession
  const subscribe = deps.onAuthChange ?? onAuthChange

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)

  useEffect(() => {
    // Unconfigured: initial state is already signed-out/not-loading, so there
    // is nothing to do — local-only users see no change.
    if (!cloudConfigured) return
    let active = true
    getSession()
      .then((current) => {
        if (active) setSession(current)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const unsubscribe = subscribe((next) => {
      if (active) setSession(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [cloudConfigured, getSession, subscribe])

  return {
    session,
    user: session?.user ?? null,
    loading,
    isCloudConfigured: cloudConfigured,
  }
}
