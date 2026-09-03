'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

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

interface AuthenticatedShellProps {
  children?: ReactNode
}

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
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
      <nav className="app-nav" aria-label="Practice navigation">
        <Link href="/app/library">Library</Link>
        <span aria-disabled="true" title="Coming soon">
          Today
        </span>
        <span aria-disabled="true" title="Coming soon">
          Progress
        </span>
        <span aria-disabled="true" title="Coming soon">
          Account
        </span>
      </nav>
      <main id="main-content" className="app-main">
        {children}
        {logoutError ? (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        ) : null}
      </main>
    </div>
  )
}
