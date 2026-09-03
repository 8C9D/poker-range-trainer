'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ApiClientError, getCurrentUser, logout } from '@/lib/api-client'

type ShellState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unauthenticated' }
  | { status: 'ready'; email: string }

async function loadSession(): Promise<ShellState> {
  try {
    const response = await getCurrentUser()
    return response.data.authenticated
      ? { status: 'ready', email: response.data.user.email }
      : { status: 'unauthenticated' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiClientError ? error.message : 'Could not load your session.',
    }
  }
}

export function AuthenticatedShell() {
  const [state, setState] = useState<ShellState>({ status: 'loading' })
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string>()

  const load = useCallback(async () => {
    setState(await loadSession())
  }, [])

  useEffect(() => {
    let active = true
    void loadSession().then((nextState) => {
      if (active) setState(nextState)
    })
    return () => {
      active = false
    }
  }, [])

  function retryLoad(): void {
    setState({ status: 'loading' })
    void load()
  }

  async function signOut(): Promise<void> {
    setLoggingOut(true)
    setLogoutError(undefined)
    try {
      await logout()
      setState({ status: 'unauthenticated' })
    } catch (error) {
      setLogoutError(
        error instanceof ApiClientError ? error.message : 'Could not sign out. Try again.',
      )
    } finally {
      setLoggingOut(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="state-page" aria-busy="true">
        <p>Loading your practice room…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="state-page">
        <section className="state-card" role="alert">
          <h1>We could not load your practice room</h1>
          <p>{state.message}</p>
          <button className="button button-primary" type="button" onClick={retryLoad}>
            Try again
          </button>
        </section>
      </main>
    )
  }
  if (state.status === 'unauthenticated') {
    return (
      <main className="state-page">
        <section className="state-card">
          <p className="eyebrow">Your practice room</p>
          <h1>Sign in to continue</h1>
          <p>Your saved range library is available after you sign in.</p>
          <Link className="button button-primary" href="/login">
            Sign in
          </Link>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link className="brand" href="/">
          <span aria-hidden="true">♠</span> Rangecraft
        </Link>
        <div className="account-actions">
          <span className="account-email">{state.email}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => void signOut()}
            disabled={loggingOut}
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <main id="main-content" className="app-main">
        <p className="eyebrow">Practice library</p>
        <h1>Your training space is ready</h1>
        <p className="app-lede">
          Your saved range library will connect next. This foundation keeps authentication and
          navigation ready without inventing records that are not here yet.
        </p>
        <section className="next-card" aria-labelledby="library-next">
          <h2 id="library-next">What’s coming next</h2>
          <p>Build, organize, and drill your own preflop ranges from this space.</p>
        </section>
        {logoutError ? (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        ) : null}
      </main>
    </div>
  )
}
