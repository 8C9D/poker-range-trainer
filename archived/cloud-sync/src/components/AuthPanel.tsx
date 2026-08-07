import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { signIn as defaultSignIn, signOut as defaultSignOut, signUp as defaultSignUp } from '../cloud/auth'
import './AuthPanel.css'

interface AuthPanelProps {
  /** Whether cloud sync is configured (Supabase env vars present). */
  isCloudConfigured: boolean
  /** Current auth session (parent owns it via `useAuthSession`); null = signed out. */
  session: Session | null
  // Auth operations are injectable so tests run without network.
  signIn?: typeof defaultSignIn
  signUp?: typeof defaultSignUp
  signOut?: typeof defaultSignOut
}

/**
 * Sign-in / sign-up / sign-out UI for cloud accounts (v3), built on `auth.ts`.
 *
 * Renders nothing actionable when cloud is unconfigured so local-only users are
 * unaffected. Signed-out shows an email/password form with Sign in / Sign up;
 * signed-in shows the user's email and Sign out. The component owns only local
 * loading/error state — the session itself comes from the parent.
 */
export function AuthPanel({
  isCloudConfigured,
  session,
  signIn = defaultSignIn,
  signUp = defaultSignUp,
  signOut = defaultSignOut,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isCloudConfigured) {
    return (
      <section className="auth-panel" aria-label="Cloud account">
        <p className="auth-panel-note">Cloud sync is not configured. You are using local-only mode.</p>
      </section>
    )
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (session) {
    return (
      <section className="auth-panel" aria-label="Cloud account">
        <p className="auth-panel-user">Signed in as {session.user.email}</p>
        <button type="button" disabled={busy} onClick={() => void run(() => signOut())}>
          Sign out
        </button>
        {error && (
          <p className="auth-panel-error" role="alert">
            {error}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="auth-panel" aria-label="Cloud account">
      <h2>Cloud account</h2>
      <div className="auth-panel-field">
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="auth-panel-field">
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div className="auth-panel-actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void run(() => signIn(email, password))}
        >
          Sign in
        </button>
        <button type="button" disabled={busy} onClick={() => void run(() => signUp(email, password))}>
          Sign up
        </button>
      </div>
      {error && (
        <p className="auth-panel-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
